"""A* on (road node, visited-goal mask), including the return to the depot.

MST is a lower bound, never a second route solver. Closed states can reopen.
The trace records OPEN changes after each expansion for exact UI playback.
"""
from __future__ import annotations

import heapq
import math
from functools import lru_cache
from itertools import count
from time import perf_counter

import networkx as nx

from .astar import AStarError, _edge_length, _validate_graph, haversine_m


def multi_goal_astar(graph, start, goals, *, heuristic="mst", max_expansions=200_000,
                     timeout_seconds=30, record_trace=True):
    _validate_graph(graph)
    if heuristic not in {"mst", "zero"}:
        raise AStarError("Heuristik harus mst atau zero.")
    if not 1 <= len(goals) <= 6 or len(set(goals)) != len(goals) or start in goals:
        raise AStarError("Pilih 1–6 tujuan unik yang berbeda dari gudang.")
    for node in [start, *goals]:
        if node not in graph:
            raise AStarError(f"Node {node} tidak terdapat dalam graf.")
    for node in graph:
        haversine_m(graph, node, node)
    # The geometric bound is safe only when every road cost dominates its
    # endpoint great-circle distance. Reject, rather than silently overestimate.
    if heuristic == "mst":
        for u, v, attrs in graph.edges(data=True):
            if float(attrs["length"]) + 1e-7 < haversine_m(graph, u, v):
                raise AStarError("Bobot jalan lebih kecil dari jarak geometris; gunakan h = 0.")
    started = perf_counter()
    terminals = [start, *goals]
    goal_bits = {node: 1 << i for i, node in enumerate(goals)}
    full_mask = (1 << len(goals)) - 1
    terminal_distance = {}
    if heuristic == "mst":
        terminal_distance = {node: tuple(haversine_m(graph, node, t) for t in terminals)
                             for node in graph}

    @lru_cache(maxsize=None)
    def estimate(node, mask):
        if heuristic == "zero":
            return 0.0
        required = [start, *(goal for i, goal in enumerate(goals) if not mask & (1 << i))]
        if node not in required:
            required.append(node)
        if len(required) == 1:
            return 0.0
        # All pairs involve a terminal; use the precomputed distances.
        index = {t: i for i, t in enumerate(terminals)}
        def distance(a, b):
            return terminal_distance[a][index[b]] if b in index else terminal_distance[b][index[a]]
        best = {n: distance(required[0], n) for n in required[1:]}
        total = 0.0
        while best:
            selected = min(best, key=best.get)
            total += best.pop(selected)
            for n in best:
                best[n] = min(best[n], distance(selected, n))
        return total

    adjacency = {u: [(v, _edge_length(graph, u, v)) for v in graph.successors(u)] for u in graph}
    initial = (start, 0)
    serial = count()
    g_score = {initial: 0.0}
    parents = {}
    frontier = [(estimate(*initial), next(serial), initial, 0.0)]
    opened = {initial}
    closed = set()
    trace = []
    expanded = 0
    reopened = 0
    peak_open = 1
    def state_record(state, g):
        node, mask = state
        h = estimate(node, mask)
        return {"key": f"{node}:{mask}", "node": node, "mask": mask, "g": g, "h": h, "f": g+h}

    while frontier:
        _, _, current, queued_g = heapq.heappop(frontier)
        if queued_g != g_score.get(current) or current in closed:
            continue
        if expanded >= max_expansions:
            raise AStarError("Batas ekspansi tercapai. Kurangi tujuan atau gunakan heuristik MST.")
        if expanded % 100 == 0 and perf_counter() - started > timeout_seconds:
            raise AStarError("Batas waktu pencarian tercapai. Hasil belum dinyatakan optimal.")
        node, mask = current
        g = g_score[current]
        opened.discard(current)
        closed.add(current)
        expanded += 1
        is_goal = node == start and mask == full_mask
        changes = []
        if not is_goal:
            for neighbor, length in adjacency[node]:
                nxt = (neighbor, mask | goal_bits.get(neighbor, 0))
                tentative = g + length
                if tentative < g_score.get(nxt, math.inf):
                    if nxt in closed:
                        closed.remove(nxt)
                        reopened += 1
                    g_score[nxt] = tentative
                    parents[nxt] = current
                    heapq.heappush(frontier, (tentative + estimate(*nxt), next(serial), nxt, tentative))
                    opened.add(nxt)
                    if record_trace:
                        changes.append(state_record(nxt, tentative))
        peak_open = max(peak_open, len(opened))
        if record_trace:
            trace.append({**state_record(current, g), "step": expanded,
                          "parent": f"{parents[current][0]}:{parents[current][1]}" if current in parents else None,
                          "opened": changes, "open_count": len(opened), "closed_count": len(closed),
                          "status": "goal" if is_goal else "expanded",
                          "latitude": float(graph.nodes[node]["y"]), "longitude": float(graph.nodes[node]["x"])})
        if is_goal:
            states = [current]
            while states[-1] != initial:
                states.append(parents[states[-1]])
            states.reverse()
            path = [state[0] for state in states]
            distance = sum(_edge_length(graph, u, v) for u, v in zip(path, path[1:]))
            if not math.isclose(distance, g, rel_tol=1e-10, abs_tol=1e-6):
                raise AStarError("Rekonstruksi jarak tidak cocok dengan biaya pencarian.")
            return {"path": path, "states": [{"node": n, "mask": m} for n, m in states],
                    "distance_m": distance, "search_steps": trace,
                    "statistics": {"expanded_states": expanded, "discovered_states": len(g_score),
                                   "reopened_states": reopened, "peak_open": peak_open,
                                   "execution_time_ms": (perf_counter()-started)*1000,
                                   "heuristic": heuristic},
                    "initial_state": state_record(initial, 0.0)}
    raise AStarError("Tidak ada perjalanan berarah yang mengunjungi semua tujuan dan kembali ke gudang.")
