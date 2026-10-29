# RouteBawang AI — OSM road graph preparation

This backend stage geocodes the four named locations with OSMnx/Nominatim,
downloads a simplified `drive` road network from OpenStreetMap, validates the
directed NetworkX graph, maps each location to its nearest road node, and saves
the results under `backend/outputs/`.

Data source attribution: © OpenStreetMap contributors, Open Database License
(ODbL) 1.0. See https://www.openstreetmap.org/copyright.

The standalone custom A* implementation is documented below. It does not
implement TSP or multi-destination route ordering.

## Run

From the project root:

```powershell
python -m pip install -r backend/requirements.txt
python backend/scripts/build_osm_graph.py
```

The default bounding-box margin is 0.08 degrees around the geocoded points. It
can be changed with `--margin-degrees`; the script calculates the bounds from
the locations returned by Nominatim, rather than using hand-entered coordinates.

OSMnx caches API responses in `backend/data/raw/osmnx-cache/` to reduce repeated
requests. That cache is local and excluded from Git. Generated outputs are:

- `road_network.graphml`: directed `MultiDiGraph`, with road direction and
  OSM attributes preserved.
- `nodes.csv`: node ID, latitude, longitude, and available node attributes.
- `edges.csv`: source, target, length in meters, road attributes, and geometry
  WKT where present.
- `locations.json`: selected Nominatim result, other returned candidates,
  nearest graph node, graph metadata, and connectivity validation.

For ambiguous names, the script prints the returned candidates and selects an
OSM settlement (`place=city/town/village/...`) before considering an
administrative boundary. Transport features such as similarly named railway
stations are not selected as localities.

## A* Algorithm

`algorithms/astar.py` runs custom A* on `outputs/road_network.graphml`, loaded
as a directed NetworkX `MultiDiGraph`. `scripts/test_astar.py` gets the
Sukomoro start node and each destination node from `outputs/locations.json`;
it does not geocode or select nodes manually.

- `g(n)` is the accumulated road-edge `length` in meters.
- `h(n)` is Haversine great-circle distance from the node's OSM `y`/`x`
  coordinates to the goal, in meters. Straight-line distance is an admissible
  lower bound for road distance, so it can guide search without overestimating
  the remaining route cost.
- `f(n) = g(n) + h(n)`; Python's `heapq` priority queue expands the lowest
  `f(n)` first.
- Directed edges are preserved. If parallel directed edges connect the same
  pair of nodes, the search uses the smallest positive `length` among them.
- Parent links reconstruct the final start-to-goal path. The result includes
  distance, evaluated-node records (`step`, `node`, `parent`, `g`, `h`, `f`,
  `status`), and OPEN/CLOSED node lists for later visualization.
- The script checks the reconstructed distance from graph edge lengths and
  compares the result with NetworkX weighted shortest-path distance as a
  reference only. NetworkX is not used to implement the A* result.

Run all three single-pair checks from the project root:

```powershell
python backend/scripts/test_astar.py
```

This tests Sukomoro → Nganjuk, Sukomoro → Rejoso, and Sukomoro → Gondang.
No A* algorithm is used to order multiple destinations (TSP).

## Multi-Destination Route Optimization

`algorithms/route_optimizer.py` uses the existing custom A* implementation to
compute a directed distance matrix for every ordered pair among Sukomoro,
Nganjuk, Rejoso, and Gondang. Both directions are calculated because the OSM
drive graph preserves one-way roads, so a route from A to B can differ from B
to A. Each A* path and search trace is cached once per ordered pair and reused
while evaluating route orders.

With three required destinations there are `3! = 6` visit orders. The optimizer
enumerates all six using `itertools.permutations`, sums the four directed A*
leg distances for each round trip, and selects the smallest total. Exact ties
are resolved lexicographically by destination names for deterministic output.
The selected leg paths are concatenated while omitting the repeated junction
node at each boundary. The output retains all six alternatives and all 12
directed pair paths/traces for later visualization.

Run the standalone optimizer from the project root:

```powershell
python backend/scripts/test_route_optimizer.py
```

The script validates the route, writes the actual matrix/candidates/legs and
cached A* traces to `outputs/route_optimization.json`, and prints a readable
summary. A* remains the road-graph search algorithm; exhaustive permutation
evaluation only chooses the visit order. FastAPI and frontend integration are
not part of this stage.
