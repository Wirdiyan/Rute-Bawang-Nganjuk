"""Exhaustive multi-destination ordering built on the project's custom A*."""

from __future__ import annotations

from itertools import permutations
from time import perf_counter
from typing import Any, Hashable

import networkx as nx

from .astar import astar_search


def optimize_route(
    graph: nx.Graph,
    warehouse: dict[str, Any],
    destinations: list[dict[str, Any]],
) -> dict[str, Any]:
    """Evaluate every directed location pair and every destination ordering.

    A* is cached once per ordered pair. Permutations only combine those road
    distances; no route-search algorithm other than the existing A* is added.
    Exact distance ties are broken lexicographically by destination names.
    """
    warehouse_name = str(warehouse["name"])
    locations = [warehouse, *destinations]
    names = [str(location["name"]) for location in locations]
    if len(names) != len(set(names)):
        raise ValueError("Warehouse and destination names must be unique")
    node_by_name: dict[str, Hashable] = {}
    for location in locations:
        if "nearest_node" not in location:
            raise ValueError(f"Location {location.get('name')!r} has no nearest_node")
        node_by_name[str(location["name"])] = location["nearest_node"]

    distance_matrix: dict[str, dict[str, float]] = {name: {} for name in names}
    pair_results: dict[str, dict[str, Any]] = {}
    for origin in names:
        for target in names:
            if origin == target:
                continue
            started = perf_counter()
            result = astar_search(graph, node_by_name[origin], node_by_name[target])
            execution_time_ms = (perf_counter() - started) * 1000
            distance_matrix[origin][target] = result["distance_m"]
            pair_result = {key: value for key, value in result.items() if key != "steps"}
            pair_results[f"{origin}->{target}"] = {
                **pair_result,
                "search_steps": result["steps"],
                "from": origin,
                "to": target,
                "start_node": node_by_name[origin],
                "goal_node": node_by_name[target],
                "execution_time_ms": execution_time_ms,
            }

    candidate_orders: list[tuple[str, ...]] = list(
        permutations(str(location["name"]) for location in destinations)
    )
    if len(candidate_orders) != 6:
        raise ValueError(
            f"Expected 6 candidate routes for 3 destinations; got {len(candidate_orders)}"
        )

    candidates: list[dict[str, Any]] = []
    for order in candidate_orders:
        full_order = (warehouse_name, *order, warehouse_name)
        leg_keys = [f"{origin}->{target}" for origin, target in zip(full_order, full_order[1:])]
        total_distance_m = sum(distance_matrix[origin][target]
                               for origin, target in zip(full_order, full_order[1:]))
        candidates.append({
            "order": list(full_order),
            "total_distance_m": total_distance_m,
            "leg_keys": leg_keys,
            "is_optimal": False,
        })

    # Sorting establishes deterministic tie-breaking for exactly equal totals.
    candidates.sort(key=lambda candidate: (candidate["total_distance_m"], tuple(candidate["order"][1:-1])))
    candidates[0]["is_optimal"] = True
    optimal = candidates[0]
    optimal_legs = [pair_results[key] for key in optimal["leg_keys"]]

    combined_path: list[Hashable] = []
    for leg in optimal_legs:
        leg_path = leg["path"]
        if not leg_path:
            raise ValueError(f"A* returned an empty path for {leg['from']}->{leg['to']}")
        if combined_path and combined_path[-1] != leg_path[0]:
            raise ValueError("Consecutive A* leg paths do not meet at the same node")
        combined_path.extend(leg_path if not combined_path else leg_path[1:])

    reconstructed_total = sum(leg["distance_m"] for leg in optimal_legs)
    if abs(reconstructed_total - optimal["total_distance_m"]) > 1e-6:
        raise ValueError("Optimal total does not match the sum of its A* legs")

    return {
        "warehouse": warehouse_name,
        "destinations": [str(location["name"]) for location in destinations],
        "distance_matrix_m": distance_matrix,
        "pair_results": pair_results,
        "optimal_route": optimal["order"],
        "total_distance_m": optimal["total_distance_m"],
        "legs": optimal_legs,
        "combined_path": combined_path,
        "combined_path_node_count": len(combined_path),
        "candidates": candidates,
    }
