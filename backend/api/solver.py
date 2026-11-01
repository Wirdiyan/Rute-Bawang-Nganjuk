"""Live route computation on the versioned local OSM graph (no geocoding)."""
from __future__ import annotations

import hashlib
import json
import math
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from time import perf_counter
from uuid import uuid4

import networkx as nx
from shapely import wkt

from backend.algorithms.astar import AStarError, _edge_length, _validate_graph, haversine_m
from backend.algorithms.multi_goal import multi_goal_astar
from backend.algorithms.route_optimizer import optimize_route

OUTPUT = Path(__file__).resolve().parents[1] / "outputs"


@lru_cache(maxsize=2)
def _load_dataset(graph_signature, location_signature):
    graph = nx.read_graphml(OUTPUT / "road_network.graphml", node_type=int)
    _validate_graph(graph)
    raw = json.loads((OUTPUT / "locations.json").read_text(encoding="utf-8"))
    references = [raw["warehouse"], *raw["destinations"]]
    if len({x["name"] for x in references}) != len(references):
        raise AStarError("Nama referensi lokasi tidak unik.")
    if len({x["nearest_node"] for x in references}) != len(references):
        raise AStarError("Dua lokasi dipetakan ke node jalan yang sama.")
    points = []
    for item in references:
        node = item["nearest_node"]
        if node not in graph:
            raise AStarError(f"Node referensi {item['name']} tidak ditemukan.")
        lat, lon = float(item["latitude"]), float(item["longitude"])
        if not math.isfinite(lat) or not math.isfinite(lon) or not -90 <= lat <= 90 or not -180 <= lon <= 180:
            raise AStarError("Koordinat referensi tidak valid.")
        temporary = nx.DiGraph()
        temporary.add_node("reference", x=lon, y=lat)
        temporary.add_node("road", **graph.nodes[node])
        snap = haversine_m(temporary, "reference", "road")
        if snap > 500:
            raise AStarError(f"Titik {item['name']} lebih dari 500 m dari node jalan; periksa pemetaan.")
        points.append({"name": item["name"], "latitude": lat, "longitude": lon,
                       "road_latitude": float(graph.nodes[node]["y"]),
                       "road_longitude": float(graph.nodes[node]["x"]), "nearest_node": node,
                       "snap_distance_m": snap, "display_name": item.get("display_name", item["name"]),
                       "place_type": item.get("place_type", "unknown"), "confirmed_delivery_point": False})
    edge_bound_valid = all(float(attrs["length"]) + 1e-7 >= haversine_m(graph, u, v)
                           for u, v, attrs in graph.edges(data=True))
    digest = hashlib.sha256()
    for name in ["road_network.graphml", "locations.json"]:
        with (OUTPUT / name).open("rb") as file:
            for chunk in iter(lambda: file.read(1 << 20), b""):
                digest.update(chunk)
    dataset = {"version": digest.hexdigest()[:16], "source": "OpenStreetMap",
               "extracted_at_utc": raw.get("metadata", {}).get("extracted_at_utc"),
               "node_count": graph.number_of_nodes(), "edge_count": graph.number_of_edges(),
               "distance_unit": "meters", "geometric_lower_bound_valid": edge_bound_valid,
               "simulation": True, "locations": points,
               "notice": "Simulasi pada titik referensi OSM. Gudang dan penerima barang belum diverifikasi. "
                         "Jarak dihitung antar-node jalan; jarak akses dari titik referensi tidak ditambahkan."}
    return graph, raw, dataset


def load_dataset():
    try:
        paths = [OUTPUT / name for name in ["road_network.graphml", "locations.json"]]
        signatures = [(p.stat().st_mtime_ns, p.stat().st_size) for p in paths]
        return _load_dataset(*signatures)
    except (OSError, ValueError, KeyError, nx.NetworkXError) as exc:
        raise AStarError(f"Dataset jalan belum siap: {exc}") from exc


def run_solver(request):
    started = perf_counter()
    original, raw, dataset = load_dataset()
    by_name = {item["name"]: item for item in [raw["warehouse"], *raw["destinations"]]}
    if request.warehouse not in by_name:
        raise AStarError("Gudang tidak dikenal dalam dataset.")
    if len(set(request.destinations)) != len(request.destinations):
        raise AStarError("Tujuan tidak boleh duplikat.")
    if request.warehouse in request.destinations:
        raise AStarError("Gudang tidak boleh menjadi tujuan distribusi.")
    if any(name not in by_name for name in request.destinations):
        raise AStarError("Ada tujuan yang tidak dikenal dalam dataset.")
    if request.heuristic == "mst" and not dataset["geometric_lower_bound_valid"]:
        raise AStarError("MST belum aman untuk bobot dataset ini; pilih h = 0.")
    graph = original.copy() if request.blocked_edges else original
    for edge in request.blocked_edges:
        if not graph.has_edge(edge.source, edge.target):
            raise AStarError(f"Ruas berarah {edge.source} → {edge.target} tidak ada atau sudah ditutup.")
        if graph.is_multigraph():
            graph.remove_edges_from([(edge.source, edge.target, key)
                                     for key in list(graph[edge.source][edge.target])])
        else:
            graph.remove_edge(edge.source, edge.target)
    warehouse = by_name[request.warehouse]
    destinations = [by_name[name] for name in request.destinations]
    result = multi_goal_astar(graph, warehouse["nearest_node"],
                             [item["nearest_node"] for item in destinations], heuristic=request.heuristic)
    by_node = {item["nearest_node"]: item["name"] for item in destinations}
    visited = set()
    order = [request.warehouse]
    legs = []
    boundary = 0
    path = result["path"]
    for index, node in enumerate(path):
        first_visit = node in by_node and node not in visited
        if first_visit or index == len(path)-1:
            name = by_node[node] if first_visit else request.warehouse
            if first_visit:
                visited.add(node)
            segment = path[boundary:index+1]
            distance = sum(_edge_length(graph, u, v) for u, v in zip(segment, segment[1:]))
            legs.append({"from": order[-1], "to": name, "distance_m": distance,
                         "path": segment, "path_node_count": len(segment)})
            order.append(name)
            boundary = index
    baseline_started = perf_counter()
    baseline = optimize_route(graph, warehouse, destinations) if request.compare_baseline else None
    baseline_ms = (perf_counter()-baseline_started)*1000 if baseline else None
    matches = math.isclose(result["distance_m"], baseline["total_distance_m"], abs_tol=1e-5,
                           rel_tol=1e-10) if baseline else None
    if matches is False:
        raise AStarError("Hasil A* multi-tujuan berbeda dari baseline; hasil tidak diterbitkan.")
    candidates = []
    for rank, candidate in enumerate(baseline["candidates"] if baseline else [], 1):
        candidates.append({"rank": rank, "route": candidate["order"],
                           "total_distance_m": candidate["total_distance_m"],
                           "is_optimal": math.isclose(candidate["total_distance_m"], baseline["total_distance_m"], abs_tol=1e-5),
                           "is_selected": candidate["order"] == order})
    return {"run_id": str(uuid4()), "computed_at_utc": datetime.now(timezone.utc).isoformat(),
            "request": request.model_dump(), "route": order, "total_distance_m": result["distance_m"],
            "total_distance_km": result["distance_m"]/1000, "combined_path": path, "legs": legs,
            "trace": result["search_steps"], "initial_state": result["initial_state"],
            "statistics": {**result["statistics"], "total_execution_time_ms": (perf_counter()-started)*1000},
            "comparison": {"enabled": bool(baseline), "matches": matches,
                           "distance_m": baseline["total_distance_m"] if baseline else None,
                           "candidate_count": len(candidates), "execution_time_ms": baseline_ms},
            "candidates": candidates, "dataset": dataset,
            "path_coordinates": expand_geometry(graph, path)}


def expand_geometry(graph, path):
    """Read geometry from the same graph used by the search, never a stale CSV."""
    points = []
    def append(lat, lon):
        if not points or points[-1] != {"latitude": lat, "longitude": lon}:
            points.append({"latitude": lat, "longitude": lon})
    for u, v in zip(path, path[1:]):
        attrs = graph.get_edge_data(u, v)
        if attrs is None:
            raise AStarError("Ruas hasil pencarian tidak ditemukan pada graf.")
        edge = min(attrs.values(), key=lambda x: float(x["length"])) if graph.is_multigraph() else attrs
        start = (float(graph.nodes[u]["y"]), float(graph.nodes[u]["x"]))
        end = (float(graph.nodes[v]["y"]), float(graph.nodes[v]["x"]))
        raw_geometry = edge.get("geometry")
        coords = []
        if raw_geometry:
            try:
                geometry = wkt.loads(raw_geometry) if isinstance(raw_geometry, str) else raw_geometry
                if geometry.geom_type != "LineString":
                    raise AStarError("Geometri ruas harus berupa LineString.")
                coords = [(float(lat), float(lon)) for lon, lat, *_ in geometry.coords]
            except (ValueError, TypeError) as exc:
                raise AStarError(f"Geometri jalan tidak valid: {exc}") from exc
            if sum(abs(a-b) for a,b in zip(coords[-1],start)) < sum(abs(a-b) for a,b in zip(coords[0],start)):
                coords.reverse()
        append(*start)
        for point in coords:
            if not all(math.isfinite(x) for x in point):
                raise AStarError("Geometri jalan mengandung koordinat non-finite.")
            append(*point)
        append(*end)
    return points
