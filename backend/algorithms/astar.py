"""Custom A* search for directed OSM road graphs.

Edge costs and the Haversine heuristic are both measured in meters. The
straight-line distance is admissible for road-length edges and helps A* focus
the search toward the selected goal.
"""

from __future__ import annotations

import heapq
import math
from itertools import count
from typing import Any, Hashable

import networkx as nx


class AStarError(ValueError):
    """Raised when the graph or requested route is invalid/unreachable."""


def haversine_m(graph: nx.Graph, node: Hashable, goal: Hashable) -> float:
    """Return great-circle distance between graph nodes, in meters."""
    try:
        lat1, lon1 = float(graph.nodes[node]["y"]), float(graph.nodes[node]["x"])
        lat2, lon2 = float(graph.nodes[goal]["y"]), float(graph.nodes[goal]["x"])
    except (KeyError, TypeError, ValueError) as exc:
        raise AStarError(f"Node {node!r} or goal {goal!r} has invalid x/y coordinates") from exc
    if not all(map(math.isfinite, (lat1, lon1, lat2, lon2))):
        raise AStarError(f"Node {node!r} or goal {goal!r} has non-finite coordinates")

    radius_m = 6_371_000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = phi2 - phi1
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * radius_m * math.asin(math.sqrt(min(1.0, a)))


def _validate_graph(graph: nx.Graph) -> None:
    if not graph.is_directed():
        raise AStarError("The road graph must remain directed")
    if graph.number_of_edges() == 0:
        raise AStarError("The graph has no edges")
    for source, target, data in graph.edges(data=True):
        raw_length = data.get("length")
        try:
            length = float(raw_length)
        except (TypeError, ValueError) as exc:
            raise AStarError(f"Edge {source!r} → {target!r} has missing/non-numeric length") from exc
        if not math.isfinite(length) or length <= 0:
            raise AStarError(f"Edge {source!r} → {target!r} must have a finite positive length")


def _edge_length(graph: nx.Graph, source: Hashable, target: Hashable) -> float:
    """Use the shortest parallel directed edge between two OSM nodes."""
    edge_data = graph.get_edge_data(source, target)
    if graph.is_multigraph():
        return min(float(attrs["length"]) for attrs in edge_data.values())
    return float(edge_data["length"])


def astar_search(
    graph: nx.Graph, start_node: Hashable, goal_node: Hashable
) -> dict[str, Any]:
    """Run custom A* and return path, distance, and one record per evaluation.

    The directed graph is never converted to undirected. For a MultiDiGraph,
    parallel edges are represented by their least ``length`` cost, as is
    appropriate when the search state contains only the OSM node ID.
    """
    _validate_graph(graph)
    if start_node not in graph:
        raise AStarError(f"Start node {start_node!r} is not present in the graph")
    if goal_node not in graph:
        raise AStarError(f"Goal node {goal_node!r} is not present in the graph")
    # Validate coordinates up-front so malformed goal data fails clearly.
    haversine_m(graph, start_node, goal_node)

    sequence = count()
    g_score: dict[Hashable, float] = {start_node: 0.0}
    came_from: dict[Hashable, Hashable] = {}
    h_start = haversine_m(graph, start_node, goal_node)
    frontier: list[tuple[float, int, Hashable, float]] = [
        (h_start, next(sequence), start_node, 0.0)
    ]
    closed: set[Hashable] = set()
    steps: list[dict[str, Any]] = []

    while frontier:
        f_score, _, current, queued_g = heapq.heappop(frontier)
        if current in closed or queued_g > g_score.get(current, math.inf):
            continue  # Ignore stale heap entries after a better relaxation.

        current_g = g_score[current]
        parent = came_from.get(current)
        current_h = haversine_m(graph, current, goal_node)
        closed.add(current)
        steps.append({
            "step": len(steps) + 1,
            "node": current,
            "parent": parent,
            "g": current_g,
            "h": current_h,
            "f": current_g + current_h,
            "status": "evaluated",
        })

        if current == goal_node:
            path = [goal_node]
            while path[-1] != start_node:
                path.append(came_from[path[-1]])
            path.reverse()
            # Recalculate from actual directed graph edges for independent result validation.
            path_distance = sum(_edge_length(graph, u, v) for u, v in zip(path, path[1:]))
            if not math.isclose(path_distance, current_g, rel_tol=1e-10, abs_tol=1e-6):
                raise AStarError("Reconstructed path distance does not match the search cost")
            return {
                "path": path,
                "distance_m": path_distance,
                "evaluated_nodes": [step["node"] for step in steps],
                "steps": steps,
                "open_nodes": [node for node in g_score if node not in closed],
                "closed_nodes": list(closed),
                "path_node_count": len(path),
                "evaluated_node_count": len(steps),
            }

        for neighbor in graph.successors(current):
            if neighbor in closed:
                continue
            tentative_g = current_g + _edge_length(graph, current, neighbor)
            if tentative_g < g_score.get(neighbor, math.inf):
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g
                h_score = haversine_m(graph, neighbor, goal_node)
                heapq.heappush(
                    frontier,
                    (tentative_g + h_score, next(sequence), neighbor, tentative_g),
                )

    raise AStarError(f"No directed path exists from {start_node!r} to {goal_node!r}")
