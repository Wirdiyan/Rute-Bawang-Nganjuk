"""A bounded, auditable road-corridor lesson, separate from whole-trip A*.

Every displayed edge expands to directed edges of the active road graph.
The selected full-graph shortest path is included, so compression cannot
improve its cost or remove the true minimum. Alternatives are illustrative,
not an enumeration of all roads or all possible village routes.
"""
from __future__ import annotations

import heapq
import json
import math
from functools import lru_cache
from itertools import count
from pathlib import Path

import networkx as nx

from backend.algorithms.astar import AStarError, _edge_length, haversine_m

LOCALITIES_PATH = Path(__file__).parent / 'data' / 'locality_references.json'


@lru_cache(maxsize=1)
def locality_references():
    if not LOCALITIES_PATH.exists():
        return {'places': [], 'source': 'OpenStreetMap'}
    return json.loads(LOCALITIES_PATH.read_text(encoding='utf-8'))


def simple_road_graph(graph):
    road = nx.DiGraph()
    road.add_nodes_from(graph.nodes(data=True))
    for u in graph:
        for v in graph.successors(u):
            road.add_edge(u, v, length=_edge_length(graph, u, v))
    return road


def _nearby_place(graph, node):
    places = locality_references()['places']
    if not places:
        return None
    lon, lat = float(graph.nodes[node]['x']), float(graph.nodes[node]['y'])
    # Distance to a settlement label, NOT a point-in-village claim.
    nearest = min(places, key=lambda p: ((p['longitude']-lon)*math.cos(math.radians(lat)))**2+(p['latitude']-lat)**2)
    temp = nx.DiGraph()
    temp.add_node(0, x=lon, y=lat)
    temp.add_node(1, x=nearest['longitude'], y=nearest['latitude'])
    distance = haversine_m(temp, 0, 1)
    return {**nearest, 'distance_m': distance} if distance <= 2400 else None


def compress_corridor(road, paths, start, goal):
    # At most four intermediate reference nodes. All omitted junctions remain
    # inside the auditable directed road chain carried by each displayed edge.
    primary = paths[0]
    keep = {start, goal}
    measures = [0.0]
    for u,v in zip(primary,primary[1:]):
        measures.append(measures[-1]+road[u][v]['length'])
    for fraction in (1/3, 2/3):
        candidates = [i for i,n in enumerate(primary) if n not in keep]
        if candidates:
            i = min(candidates, key=lambda i:abs(measures[i]-measures[-1]*fraction))
            keep.add(primary[i])
    primary_set = set(primary)
    for path in paths[1:]:
        candidates = [n for n in path if n not in keep and n not in primary_set]
        if candidates and len(keep)<6:
            # Choose a visibly distinct branch reference, not a tiny detour
            # just beside the same intersection.
            n = max(candidates,key=lambda n:min(haversine_m(road,n,p) for p in primary))
            keep.add(n)
    for n in primary[1:-1]:
        if len(keep)>=4:
            break
        keep.add(n)
    compressed = nx.MultiDiGraph()
    compressed.add_nodes_from((n, road.nodes[n]) for n in keep)
    seen = set()
    for path in paths:
        chain = [path[0]]
        for node in path[1:]:
            chain.append(node)
            if node not in keep:
                continue
            key = tuple(chain)
            if key not in seen:
                seen.add(key)
                cost = sum(road[u][v]['length'] for u,v in zip(chain,chain[1:]))
                compressed.add_edge(chain[0],chain[-1],length=cost,path=chain[:])
            chain = [node]
    return compressed


def search_lesson(nodes, edges, start, goal, *, zero=False):
    """Exact small-graph A* snapshots, including the initial unsolved state."""
    graph = nx.DiGraph()
    graph.add_nodes_from((n['id'], {'x': n['longitude'], 'y': n['latitude']}) for n in nodes)
    adjacency = {n['id']: [] for n in nodes}
    for edge in edges:
        adjacency[edge['source']].append(edge)
    h = {n: 0.0 if zero else haversine_m(graph, n, goal) for n in graph}
    g, parents, closed = {start: 0.0}, {}, set()
    serial = count()
    queue = [(h[start], next(serial), start, 0.0)]
    opened = {start}
    def record(node):
        return {'node': node, 'g': g[node], 'h': h[node], 'f': g[node]+h[node]}
    def frontier():
        return sorted((record(n) for n in opened), key=lambda row: (row['f'], row['g'], row['node']))
    steps = [{'node': None, 'open': frontier(), 'closed': [], 'updates': [], 'goal': False}]
    while queue:
        _, _, current, queued = heapq.heappop(queue)
        if queued != g.get(current) or current in closed:
            continue
        before = frontier()
        opened.discard(current)
        closed.add(current)
        updates = []
        finished = current == goal
        if not finished:
            for edge in adjacency[current]:
                neighbor, length = edge['target'], edge['distance_m']
                tentative = g[current]+length
                previous = g.get(neighbor)
                improved = previous is None or tentative < previous
                if improved:
                    g[neighbor] = tentative
                    parents[neighbor] = (current, edge['id'])
                    closed.discard(neighbor)
                    opened.add(neighbor)
                    heapq.heappush(queue, (tentative+h[neighbor], next(serial), neighbor, tentative))
                updates.append({'edge': edge['id'], 'node': neighbor, 'edge_m': length,
                                'candidate_g': tentative, 'old_g': previous, 'improved': improved,
                                'h': h[neighbor], 'f': tentative+h[neighbor]})
        steps.append({**record(current), 'open_before': before, 'open': frontier(),
                      'closed': sorted(closed), 'updates': updates, 'goal': finished})
        if finished:
            path, path_edges = [goal], []
            while path[-1] != start:
                parent, edge_id = parents[path[-1]]
                path.append(parent)
                path_edges.append(edge_id)
            return {'steps': steps, 'path': list(reversed(path)),
                    'path_edges': list(reversed(path_edges)), 'distance_m': g[goal],
                    'expanded': len(steps)-1}
    raise AStarError('Tujuan diagram tidak terjangkau.')


def build_road_lesson(road, leg, index):
    start, goal = leg['path'][0], leg['path'][-1]
    shortest = nx.shortest_path(road, start, goal, weight='length')
    paths = [shortest]
    used = set(zip(shortest, shortest[1:]))
    for penalty in (3, 12):
        candidate = nx.shortest_path(road, start, goal,
            weight=lambda u, v, attrs: attrs['length']*(penalty if (u,v) in used else 1))
        if candidate not in paths:
            paths.append(candidate)
    graph = compress_corridor(road, paths, start, goal)
    distances = nx.single_source_dijkstra_path_length(road, start, weight='length')
    ordered = [start, *sorted((n for n in graph if n not in {start,goal}), key=lambda n:(distances[n],n)), goal]
    labels = {node: ('S' if node == start else 'T' if node == goal else chr(64+i)) for i,node in enumerate(ordered)}
    nodes = []
    for node in ordered:
        place = _nearby_place(road, node)
        terminal = node in {start,goal}
        nodes.append({'id': str(node), 'code': labels[node], 'latitude': float(road.nodes[node]['y']),
                      'longitude': float(road.nodes[node]['x']),
                      'name': leg['from'] if node == start else leg['to'] if node == goal else f"Dekat {place['name']}" if place else 'Simpang jalan',
                      'kind': 'start' if node == start else 'goal' if node == goal else 'junction',
                      'locality': None if terminal else place})
    edges = []
    for u,v,key,attrs in graph.edges(keys=True,data=True):
        edges.append({'id':f'{u}:{v}:{key}', 'source':str(u), 'target':str(v),
                      'distance_m':attrs['length'], 'path':attrs['path'], 'road_node_count':len(attrs['path'])})
    # Compare educational A* and Dijkstra on exactly the same corridor.
    guided = search_lesson(nodes, edges, str(start), str(goal))
    zero = search_lesson(nodes, edges, str(start), str(goal), zero=True)
    full_minimum = nx.path_weight(road, shortest, 'length')
    if not math.isclose(guided['distance_m'], full_minimum, abs_tol=1e-5) or not math.isclose(zero['distance_m'], full_minimum, abs_tol=1e-5):
        raise AStarError('Diagram tidak cocok dengan minimum graf jalan.')
    selected_edges = {edge['id']: edge for edge in edges}
    expanded_path = []
    for edge_id in guided['path_edges']:
        chain = selected_edges[edge_id]['path']
        expanded_path.extend(chain if not expanded_path else chain[1:])
    return {'leg_index': index, 'from':leg['from'], 'to':leg['to'], 'nodes':nodes, 'edges':edges,
            'start':str(start), 'goal':str(goal), 'searches':{'guided':guided,'zero':zero},
            'distance_m':full_minimum, 'expanded_path':expanded_path,
            'alternative_corridors':len(paths), 'road_node_count':len(set(n for p in paths for n in p)),
            'locality_source':{k:v for k,v in locality_references().items() if k != 'places'},
            'scope':'Koridor contoh dari beberapa pilihan jalan OSM. Setiap panah merangkum ruas jalan berarah; minimum koridor diperiksa terhadap graf penuh. Nama dekat permukiman bukan bukti batas desa atau titik yang disinggahi.'}


def build_road_lessons(graph, legs):
    road = simple_road_graph(graph)
    return [build_road_lesson(road, leg, index) for index,leg in enumerate(legs)]
