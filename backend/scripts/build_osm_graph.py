"""Geocode RouteBawang AI locations and build an OSMnx driving graph.

This prepares road-network data only. It intentionally does not calculate
routes, run A*, or optimize delivery order.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import networkx as nx
import osmnx as ox
import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = PROJECT_ROOT / "backend"
RAW_DIR = BACKEND_DIR / "data" / "raw"
OUTPUT_DIR = BACKEND_DIR / "outputs"
GRAPH_PATH = OUTPUT_DIR / "road_network.graphml"
NODES_PATH = OUTPUT_DIR / "nodes.csv"
EDGES_PATH = OUTPUT_DIR / "edges.csv"
LOCATIONS_PATH = OUTPUT_DIR / "locations.json"

NETWORK_TYPE = "drive"
LOCATION_QUERIES = {
    "warehouse": ("Sukomoro", "Sukomoro, Kabupaten Nganjuk, Jawa Timur, Indonesia"),
    "destinations": [
        ("Nganjuk", "Nganjuk, Kabupaten Nganjuk, Jawa Timur, Indonesia"),
        ("Rejoso", "Rejoso, Kabupaten Nganjuk, Jawa Timur, Indonesia"),
        ("Gondang", "Gondang, Kabupaten Nganjuk, Jawa Timur, Indonesia"),
    ],
}


class PreparationError(RuntimeError):
    """An actionable failure while preparing the road graph."""


def log(message: str) -> None:
    print(message, flush=True)


def configure_osmnx() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    ox.settings.use_cache = True
    ox.settings.cache_folder = str(RAW_DIR / "osmnx-cache")
    ox.settings.requests_timeout = 180
    ox.settings.overpass_rate_limit = True

    # Retain useful road attributes in addition to OSMnx's defaults.
    useful_way_tags = {
        *ox.settings.useful_tags_way,
        "highway", "name", "maxspeed", "oneway", "access", "service",
        "ref", "surface", "lanes", "bridge", "tunnel",
    }
    ox.settings.useful_tags_way = sorted(useful_way_tags)


def geocode_one(name: str, query: str) -> dict[str, Any]:
    """Find and select the most relevant Nominatim result for a locality."""
    candidates = []
    for result_number in range(1, 6):
        try:
            result = ox.geocoder.geocode_to_gdf(query, which_result=result_number)
        except Exception as exc:  # Nominatim errors vary by HTTP/library version.
            if exc.__class__.__name__ == "InsufficientResponseError" and candidates:
                break
            raise PreparationError(
                f"Geocoding '{name}' gagal untuk query '{query}': {exc}. "
                "Periksa koneksi internet, lalu jalankan ulang."
            ) from exc

        if result.empty:
            break
        row = result.iloc[0]
        osm_type = str(row.get("osm_type", ""))
        osm_id = int(row["osm_id"]) if pd.notna(row.get("osm_id")) else None
        # A repeated result can occur for nearby names. Keep one copy.
        if not any(item["osm_type"] == osm_type and item["osm_id"] == osm_id for item in candidates):
            candidates.append({"row": row, "result_number": result_number, "osm_type": osm_type, "osm_id": osm_id})

    if not candidates:
        raise PreparationError(
            f"Lokasi '{name}' tidak ditemukan oleh Nominatim dengan query: {query}"
        )

    # Prefer actual mapped settlements (place=city/town/village) over similarly
    # named transport features such as railway stations. Use the first result
    # only when Nominatim returned no place feature at all.
    place_candidates = [
        candidate for candidate in candidates
        if str(candidate["row"].get("class", "")) == "place"
        and str(candidate["row"].get("type", "")) in {"city", "town", "village", "hamlet", "suburb", "locality"}
    ]
    boundary_candidates = [
        candidate for candidate in candidates
        if str(candidate["row"].get("class", "")) == "boundary"
        and str(candidate["row"].get("type", "")) == "administrative"
    ]
    relevant_candidates = place_candidates or boundary_candidates
    if not relevant_candidates:
        found = "; ".join(
            f"{item['row'].get('class')}/{item['row'].get('type')}: {item['row'].get('display_name')}"
            for item in candidates
        )
        raise PreparationError(
            f"Nominatim tidak menemukan entitas permukiman/admin yang jelas untuk '{name}'. "
            f"Kandidat yang ditemukan: {found}"
        )
    selected = relevant_candidates[0]
    row = selected["row"]
    display_name = str(row.get("display_name", "")).strip()
    normalized = display_name.casefold()
    if "nganjuk" not in normalized or "indonesia" not in normalized:
        raise PreparationError(
            f"Hasil geocoding '{name}' tidak cocok dengan konteks Nganjuk: "
            f"{display_name or 'nama hasil tidak tersedia'}. "
            "Script berhenti agar tidak menyimpan koordinat ambigu."
        )

    latitude = row.get("lat")
    longitude = row.get("lon")
    if pd.isna(latitude) or pd.isna(longitude):
        # OSMnx normally returns Nominatim's lat/lon fields. The geometry
        # fallback supports OSMnx/geocoder responses that omit those columns.
        point = row.geometry.representative_point()
        longitude, latitude = point.x, point.y
    latitude, longitude = float(latitude), float(longitude)
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        raise PreparationError(f"Koordinat hasil geocoding '{name}' tidak valid.")

    candidate_summaries = []
    for candidate in candidates:
        result_row = candidate["row"]
        candidate_summaries.append({
            "result_number": candidate["result_number"],
            "display_name": str(result_row.get("display_name", "")),
            "latitude": float(result_row["lat"]) if pd.notna(result_row.get("lat")) else None,
            "longitude": float(result_row["lon"]) if pd.notna(result_row.get("lon")) else None,
            "osm_type": candidate["osm_type"],
            "osm_id": candidate["osm_id"],
            "place_class": str(result_row.get("class", "")),
            "place_type": str(result_row.get("type", "")),
            "selected": candidate is selected,
        })
    for candidate in candidate_summaries:
        marker = " [dipilih]" if candidate["selected"] else ""
        log(
            f"  Kandidat {candidate['result_number']}: "
            f"{candidate['place_class']}/{candidate['place_type']} — "
            f"{candidate['display_name']}{marker}"
        )

    return {
        "name": name,
        "query": query,
        "latitude": latitude,
        "longitude": longitude,
        "display_name": display_name,
        "osm_type": str(row.get("osm_type", "")),
        "osm_id": int(row["osm_id"]) if pd.notna(row.get("osm_id")) else None,
        "place_class": str(row.get("class", "")),
        "place_type": str(row.get("type", "")),
        "importance": float(row["importance"]) if pd.notna(row.get("importance")) else None,
        "selected_result_number": selected["result_number"],
        "geocoding_candidates": candidate_summaries,
        "source": "OpenStreetMap Nominatim via OSMnx",
    }


def geocode_locations() -> dict[str, Any]:
    log("\n[1/6] Geocoding locations with OSMnx/Nominatim...")
    warehouse_name, warehouse_query = LOCATION_QUERIES["warehouse"]
    warehouse = geocode_one(warehouse_name, warehouse_query)
    log(f"✓ {warehouse_name}: {warehouse['display_name']}")
    time.sleep(1.1)  # Respect the public Nominatim service's request cadence.

    destinations: list[dict[str, Any]] = []
    for index, (name, query) in enumerate(LOCATION_QUERIES["destinations"]):
        location = geocode_one(name, query)
        destinations.append(location)
        log(f"✓ {name}: {location['display_name']}")
        if index < len(LOCATION_QUERIES["destinations"]) - 1:
            time.sleep(1.1)

    return {"warehouse": warehouse, "destinations": destinations}


def calculate_bbox(locations: dict[str, Any], margin_degrees: float) -> tuple[float, float, float, float]:
    points = [locations["warehouse"], *locations["destinations"]]
    longitudes = [point["longitude"] for point in points]
    latitudes = [point["latitude"] for point in points]
    west = min(longitudes) - margin_degrees
    south = min(latitudes) - margin_degrees
    east = max(longitudes) + margin_degrees
    north = max(latitudes) + margin_degrees
    return west, south, east, north


def download_graph(bbox: tuple[float, float, float, float]) -> nx.MultiDiGraph:
    log("\n[2/6] Downloading the drive road network from OpenStreetMap...")
    log(
        "    Bounding box (west, south, east, north): "
        + ", ".join(f"{coordinate:.6f}" for coordinate in bbox)
    )
    try:
        graph = ox.graph.graph_from_bbox(
            bbox,
            network_type=NETWORK_TYPE,
            simplify=True,
            retain_all=True,
            truncate_by_edge=True,
        )
    except Exception as exc:
        raise PreparationError(
            f"Unduhan jaringan jalan dari Overpass gagal: {exc}. "
            "Periksa koneksi internet atau coba lagi ketika layanan OpenStreetMap tersedia."
        ) from exc

    if graph.number_of_nodes() == 0 or graph.number_of_edges() == 0:
        raise PreparationError("Graph OSM kosong; tidak ada jaringan jalan untuk diproses.")

    log("✓ Road network downloaded")
    log("\n[3/6] Graph built as a simplified, directed OSMnx MultiDiGraph")
    return graph


def validate_graph(graph: nx.MultiDiGraph, locations: dict[str, Any]) -> tuple[list[str], dict[str, Any]]:
    log("\n[4/6] Validating graph nodes, coordinates, edges, and lengths...")
    issues: list[str] = []
    node_count = graph.number_of_nodes()
    edge_count = graph.number_of_edges()

    missing_coordinates = [node for node, data in graph.nodes(data=True) if "x" not in data or "y" not in data]
    if missing_coordinates:
        raise PreparationError(f"{len(missing_coordinates)} node tidak mempunyai koordinat x/y.")

    lengths = [data.get("length") for _, _, _, data in graph.edges(keys=True, data=True)]
    invalid_lengths = [
        length for length in lengths
        if length is None or not isinstance(length, (int, float)) or not math.isfinite(float(length)) or float(length) < 0
    ]
    if invalid_lengths:
        raise PreparationError(f"{len(invalid_lengths)} edge tidak mempunyai length yang valid.")

    weak_components = list(nx.weakly_connected_components(graph))
    component_by_node = {node: index for index, component in enumerate(weak_components) for node in component}
    targets = [locations["warehouse"], *locations["destinations"]]

    log("\n[5/6] Mapping locations to the nearest graph nodes...")
    try:
        nearest_nodes = ox.distance.nearest_nodes(
            graph,
            X=[item["longitude"] for item in targets],
            Y=[item["latitude"] for item in targets],
        )
    except Exception as exc:
        raise PreparationError(f"Nearest-node lookup gagal: {exc}") from exc

    if hasattr(nearest_nodes, "tolist"):
        nearest_nodes = nearest_nodes.tolist()
    elif not isinstance(nearest_nodes, (list, tuple)):
        nearest_nodes = [nearest_nodes]

    target_node_ids: list[Any] = []
    for location, node_id in zip(targets, nearest_nodes, strict=True):
        location["nearest_node"] = int(node_id) if isinstance(node_id, (int,)) else node_id.item() if hasattr(node_id, "item") else node_id
        target_node_ids.append(node_id)
        log(f"✓ {location['name']} -> node {location['nearest_node']}")

    component_ids = {component_by_node[node] for node in target_node_ids}
    if len(component_ids) != 1:
        issues.append("Target nodes tidak semuanya berada pada weakly connected component yang sama.")

    reachable_pairs = 0
    unreachable_pairs: list[dict[str, Any]] = []
    for origin_index, origin in enumerate(target_node_ids):
        for destination_index, destination in enumerate(target_node_ids):
            if origin_index == destination_index:
                continue
            if nx.has_path(graph, origin, destination):
                reachable_pairs += 1
            else:
                unreachable_pairs.append({
                    "from": targets[origin_index]["name"],
                    "to": targets[destination_index]["name"],
                })
    if unreachable_pairs:
        issues.append(
            f"Ada {len(unreachable_pairs)} pasangan arah lokasi yang tidak terjangkau pada graph satu arah."
        )

    validation = {
        "node_coordinates_present": True,
        "edge_length_valid": True,
        "edge_length_unit": "meters",
        "weakly_connected_component_count": len(weak_components),
        "target_nodes_share_weak_component": len(component_ids) == 1,
        "directed_reachable_target_pairs": reachable_pairs,
        "directed_target_pair_count": len(target_node_ids) * (len(target_node_ids) - 1),
        "unreachable_directed_pairs": unreachable_pairs,
        "warnings": issues,
    }
    summary = {"nodes": node_count, "edges": edge_count, "validation": validation}
    log(f"✓ Nodes: {node_count:,}")
    log(f"✓ Edges: {edge_count:,}")
    log("✓ Node coordinates (x=longitude, y=latitude): OK")
    log("✓ Edge lengths (meters): OK")
    log(f"✓ Weakly connected components: {len(weak_components)}")
    log(
        "✓ Directed target reachability: "
        f"{reachable_pairs}/{validation['directed_target_pair_count']} ordered pairs"
    )
    for issue in issues:
        log(f"⚠ {issue}")
    return issues, summary


def csv_value(value: Any) -> Any:
    if value is None:
        return ""
    if hasattr(value, "is_empty") and hasattr(value, "wkt"):
        return value.wkt if not value.is_empty else ""
    if isinstance(value, (list, tuple, set)):
        return json.dumps(list(value), ensure_ascii=False)
    if isinstance(value, float) and not math.isfinite(value):
        return ""
    return value


def export_nodes(graph: nx.MultiDiGraph) -> None:
    rows = []
    for node_id, data in graph.nodes(data=True):
        row = {
            "node_id": node_id,
            "latitude": float(data["y"]),
            "longitude": float(data["x"]),
        }
        row.update({key: csv_value(value) for key, value in data.items() if key not in {"x", "y"}})
        rows.append(row)
    pd.DataFrame(rows).to_csv(NODES_PATH, index=False, encoding="utf-8")


def export_edges(graph: nx.MultiDiGraph) -> None:
    rows = []
    for source, target, key, data in graph.edges(keys=True, data=True):
        rows.append({
            "source": source,
            "target": target,
            "key": key,
            "length": float(data["length"]),
            "name": csv_value(data.get("name")),
            "highway": csv_value(data.get("highway")),
            "oneway": csv_value(data.get("oneway")),
            "maxspeed": csv_value(data.get("maxspeed")),
            "geometry": csv_value(data.get("geometry")),
            "ref": csv_value(data.get("ref")),
            "access": csv_value(data.get("access")),
            "surface": csv_value(data.get("surface")),
        })
    pd.DataFrame(rows).to_csv(EDGES_PATH, index=False, encoding="utf-8")


def save_outputs(graph: nx.MultiDiGraph, locations: dict[str, Any], bbox: tuple[float, float, float, float], summary: dict[str, Any]) -> None:
    log("\n[6/6] Saving outputs...")
    extracted_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    metadata = {
        "source": "OpenStreetMap",
        "data_attribution": "© OpenStreetMap contributors",
        "data_license": "Open Database License (ODbL) 1.0",
        "copyright_url": "https://www.openstreetmap.org/copyright",
        "geocoder": "Nominatim via OSMnx",
        "network_type": NETWORK_TYPE,
        "extracted_at_utc": extracted_at,
        "bbox_west_south_east_north": list(bbox),
        "osmnx_version": ox.__version__,
        "networkx_version": nx.__version__,
        "node_count": summary["nodes"],
        "edge_count": summary["edges"],
        "graph_type": "directed MultiDiGraph",
        "simplified": True,
        "oneway_preserved": True,
        "validation": summary["validation"],
    }

    graph.graph["routebawang_source"] = "OpenStreetMap"
    graph.graph["routebawang_network_type"] = NETWORK_TYPE
    graph.graph["routebawang_extracted_at_utc"] = extracted_at
    graph.graph["routebawang_bbox"] = ",".join(f"{value:.8f}" for value in bbox)
    ox.io.save_graphml(graph, filepath=GRAPH_PATH)
    export_nodes(graph)
    export_edges(graph)

    locations_payload = {
        "metadata": metadata,
        "warehouse": locations["warehouse"],
        "destinations": locations["destinations"],
    }
    LOCATIONS_PATH.write_text(
        json.dumps(locations_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    for output_path in (GRAPH_PATH, NODES_PATH, EDGES_PATH, LOCATIONS_PATH):
        log(f"✓ {output_path.relative_to(PROJECT_ROOT)}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--margin-degrees",
        type=float,
        default=0.08,
        help="Margin in degrees around the geocoded target locations (default: 0.08).",
    )
    if len(sys.argv) == 1:
        return parser.parse_args([])
    return parser.parse_args()


def main() -> int:
    # Windows consoles may default to a legacy code page that cannot display
    # the progress checkmarks used in the requested terminal summary.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    args = parse_args()
    if not 0 < args.margin_degrees <= 1:
        print("ERROR: --margin-degrees harus lebih besar dari 0 dan maksimal 1.", file=sys.stderr)
        return 2

    print("=" * 40)
    print("RouteBawang AI - OSM Data Preparation")
    print("=" * 40)
    print(f"OSMnx {ox.__version__} | NetworkX {nx.__version__} | network_type={NETWORK_TYPE}")

    try:
        configure_osmnx()
        locations = geocode_locations()
        bbox = calculate_bbox(locations, args.margin_degrees)
        graph = download_graph(bbox)
        _, summary = validate_graph(graph, locations)
        save_outputs(graph, locations, bbox, summary)
    except PreparationError as exc:
        print(f"\nERROR: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"\nERROR: Proses persiapan OSM gagal: {exc}", file=sys.stderr)
        return 1

    print("\nSummary")
    print("=" * 40)
    print(f"Locations: {len(locations['destinations']) + 1}")
    for location in [locations["warehouse"], *locations["destinations"]]:
        print(
            f"- {location['name']} -> node {location['nearest_node']} "
            f"({location['latitude']:.6f}, {location['longitude']:.6f})"
        )
    print(f"Graph: {summary['nodes']:,} nodes, {summary['edges']:,} directed edges")
    print(f"Network type: {NETWORK_TYPE}; edge distance: length (meters)")
    print("A* and route optimization: not implemented")
    print("=" * 40)
    print("OSM GRAPH READY FOR A*")
    if summary["validation"]["warnings"]:
        print("Periksa warning connectivity di locations.json sebelum tahap berikutnya.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
