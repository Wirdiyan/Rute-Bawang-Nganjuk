"""Run standalone A* checks for the three configured destinations."""

from __future__ import annotations

import json
import math
import sys
import time
from pathlib import Path

import networkx as nx

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))

from backend.algorithms.astar import astar_search  # noqa: E402

OUTPUT_DIR = PROJECT_ROOT / "backend" / "outputs"
GRAPH_PATH = OUTPUT_DIR / "road_network.graphml"
LOCATIONS_PATH = OUTPUT_DIR / "locations.json"


def load_locations() -> tuple[dict, list[dict]]:
    data = json.loads(LOCATIONS_PATH.read_text(encoding="utf-8"))
    return data["warehouse"], data["destinations"]


def main() -> int:
    if not GRAPH_PATH.is_file() or not LOCATIONS_PATH.is_file():
        print("Required OSM graph or locations.json is missing. Run build_osm_graph.py first.")
        return 1

    graph = nx.read_graphml(GRAPH_PATH, node_type=int)
    warehouse, destinations = load_locations()
    start = warehouse["nearest_node"]
    failures = 0

    for destination in destinations:
        goal = destination["nearest_node"]
        print("=" * 48)
        print("A* TEST")
        print("=" * 48)
        print(f"Start       : {warehouse['name']} ({start})")
        print(f"Goal        : {destination['name']} ({goal})")
        try:
            started = time.perf_counter()
            result = astar_search(graph, start, goal)
            elapsed = time.perf_counter() - started

            # Confirm returned path and distance against the directed graph and
            # NetworkX's Dijkstra result (reference only, never used by A*).
            assert result["path"][0] == start and result["path"][-1] == goal
            recomputed = sum(
                min(float(attrs["length"]) for attrs in graph.get_edge_data(u, v).values())
                for u, v in zip(result["path"], result["path"][1:])
            )
            assert math.isclose(result["distance_m"], recomputed, rel_tol=1e-10, abs_tol=1e-6)
            # GraphML stores untyped OSMnx attributes as strings, so normalize
            # the parallel-edge data explicitly for NetworkX's reference.
            def reference_weight(_u, _v, edge_data):
                if graph.is_multigraph():
                    return min(float(attrs["length"]) for attrs in edge_data.values())
                return float(edge_data["length"])

            reference_distance = nx.shortest_path_length(
                graph, start, goal, weight=reference_weight
            )
            agrees = math.isclose(result["distance_m"], reference_distance, rel_tol=1e-9, abs_tol=1e-5)
            assert agrees, (
                f"Custom A* distance {result['distance_m']} differs from "
                f"NetworkX reference {reference_distance}"
            )

            named_path = [
                warehouse["name"] if node == start else
                destination["name"] if node == goal else str(node)
                for node in result["path"]
            ]
            print(f"Path        : {' -> '.join(named_path)}")
            print(f"Path nodes  : {result['path_node_count']}")
            print(f"Evaluated   : {result['evaluated_node_count']}")
            print(f"Distance    : {result['distance_m']:.2f} m")
            print(f"Time        : {elapsed:.4f} s")
            print(f"NetworkX    : {'CONSISTENT' if agrees else 'MISMATCH'} ({reference_distance:.2f} m)")
            print("A* SUCCESS")
        except Exception as exc:
            failures += 1
            print(f"A* FAILED: {exc}")
        print("=" * 48)

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
