"""Run and validate exhaustive delivery-route ordering on the OSM graph."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import networkx as nx

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))

from backend.algorithms.route_optimizer import optimize_route  # noqa: E402

OUTPUT_DIR = PROJECT_ROOT / "backend" / "outputs"
GRAPH_PATH = OUTPUT_DIR / "road_network.graphml"
LOCATIONS_PATH = OUTPUT_DIR / "locations.json"
RESULT_PATH = OUTPUT_DIR / "route_optimization.json"


def validate_result(result: dict) -> None:
    warehouse = result["warehouse"]
    destinations = result["destinations"]
    route = result["optimal_route"]
    if len(result["candidates"]) != 6:
        raise AssertionError("Expected exactly six route candidates")
    candidate_orders = {
        tuple(candidate["order"][1:-1]) for candidate in result["candidates"]
    }
    if len(candidate_orders) != 6 or any(set(order) != set(destinations) for order in candidate_orders):
        raise AssertionError("Candidates do not contain all six unique destination permutations")
    if route[0] != warehouse or route[-1] != warehouse:
        raise AssertionError("Optimal route must start and end at the warehouse")
    if route[1:-1].count(warehouse) != 0:
        raise AssertionError("Warehouse must only occur at route start and end")
    if len(route[1:-1]) != len(destinations) or set(route[1:-1]) != set(destinations):
        raise AssertionError("Every destination must be visited exactly once")
    if sum(candidate["is_optimal"] for candidate in result["candidates"]) != 1:
        raise AssertionError("Exactly one candidate must be marked optimal")

    expected_pairs = {
        (origin, target)
        for origin in [warehouse, *destinations]
        for target in [warehouse, *destinations]
        if origin != target
    }
    if len(result["pair_results"]) != 12:
        raise AssertionError("Expected A* result for all 12 directed location pairs")
    for origin, target in expected_pairs:
        pair = result["pair_results"][f"{origin}->{target}"]
        if pair["path"][0] != pair["start_node"] or pair["path"][-1] != pair["goal_node"]:
            raise AssertionError(f"Path endpoints are invalid for {origin}->{target}")
        if not pair["search_steps"] or pair["evaluated_node_count"] != len(pair["search_steps"]):
            raise AssertionError(f"Missing A* search trace for {origin}->{target}")
        if result["distance_matrix_m"][origin][target] != pair["distance_m"]:
            raise AssertionError(f"Matrix value did not come from cached A* for {origin}->{target}")

    optimal = result["candidates"][0]
    for candidate in result["candidates"]:
        expected_total = sum(
            result["distance_matrix_m"][origin][target]
            for origin, target in zip(candidate["order"], candidate["order"][1:])
        )
        if abs(candidate["total_distance_m"] - expected_total) > 1e-6:
            raise AssertionError(f"Candidate total is invalid for {' -> '.join(candidate['order'])}")
    if result["total_distance_m"] != optimal["total_distance_m"]:
        raise AssertionError("Selected route is not the minimum candidate")
    leg_total = sum(leg["distance_m"] for leg in result["legs"])
    if abs(leg_total - result["total_distance_m"]) > 1e-6:
        raise AssertionError("Total distance does not equal the sum of optimal legs")
    if len(result["legs"]) != len(destinations) + 1:
        raise AssertionError("Optimal route must contain one leg per stop plus return")
    if result["combined_path"][0] != result["legs"][0]["path"][0]:
        raise AssertionError("Combined path start does not match the first leg")
    for left, right in zip(result["legs"], result["legs"][1:]):
        if left["path"][-1] != right["path"][0]:
            raise AssertionError("Consecutive leg paths do not connect")
    expected_combined_length = sum(len(leg["path"]) for leg in result["legs"]) - len(result["legs"]) + 1
    if len(result["combined_path"]) != expected_combined_length:
        raise AssertionError("Combined path contains a duplicated or missing leg junction")


def main() -> int:
    if not GRAPH_PATH.is_file() or not LOCATIONS_PATH.is_file():
        print("Required OSM graph or locations.json is missing. Run build_osm_graph.py first.")
        return 1

    graph = nx.read_graphml(GRAPH_PATH, node_type=int)
    location_data = json.loads(LOCATIONS_PATH.read_text(encoding="utf-8"))
    warehouse = location_data["warehouse"]
    destinations = location_data["destinations"]
    result = optimize_route(graph, warehouse, destinations)
    validate_result(result)

    print("=" * 72)
    print("ROUTEBAWANG AI")
    print("MULTI-DESTINATION ROUTE OPTIMIZATION")
    print("=" * 72)
    print("Locations:")
    print(f"- Warehouse : {warehouse['name']}")
    for index, destination in enumerate(destinations, start=1):
        print(f"- Destination {index} : {destination['name']}")

    names = [warehouse["name"], *(destination["name"] for destination in destinations)]
    label_width = max(12, max(map(len, names)) + 2)
    print("\n" + "-" * 72)
    print("DISTANCE MATRIX (meters)")
    print("-" * 72)
    print(f"{'From / To':<{label_width}}" + "".join(f"{name:>14}" for name in names))
    for origin in names:
        row = f"{origin:<{label_width}}"
        for target in names:
            value = "-" if origin == target else f"{result['distance_matrix_m'][origin][target]:,.2f}"
            row += f"{value:>14}"
        print(row)

    print("\n" + "-" * 72)
    print("ROUTE CANDIDATES (sorted by total distance)")
    print("-" * 72)
    for index, candidate in enumerate(result["candidates"], start=1):
        marker = " [OPTIMAL]" if candidate["is_optimal"] else ""
        print(f"{index}. {' -> '.join(candidate['order'])}{marker}")
        print(f"   Total: {candidate['total_distance_m']:,.2f} m ({candidate['total_distance_m'] / 1000:,.3f} km)")

    print("\n" + "-" * 72)
    print("OPTIMAL ROUTE")
    print("-" * 72)
    print(" -> ".join(result["optimal_route"]))
    print(f"Total distance: {result['total_distance_m']:,.2f} m ({result['total_distance_m'] / 1000:,.3f} km)")
    print("\nOptimal route legs:")
    for leg in result["legs"]:
        print(
            f"- {leg['from']} -> {leg['to']}: {leg['distance_m']:,.2f} m; "
            f"path nodes={leg['path_node_count']}; evaluated={leg['evaluated_node_count']}; "
            f"time={leg['execution_time_ms']:.2f} ms"
        )

    # Keep all 12 cached A* paths and traces available for future API/frontend use.
    RESULT_PATH.write_text(
        json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
    )
    print(f"\nSaved result: {RESULT_PATH.relative_to(PROJECT_ROOT)}")
    print("\nValidation:")
    print("A* result: VALID")
    print("All destinations visited: YES")
    print("Return to warehouse: YES")
    print(f"Candidate routes: {len(result['candidates'])}")
    print("Optimal route selected: YES")
    print("Total distance validated: YES")
    print("=" * 72)
    print("OPTIMIZATION SUCCESS")
    print("=" * 72)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
