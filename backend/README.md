# RouteBawang AI — OSM road graph preparation

This backend stage geocodes the four named locations with OSMnx/Nominatim,
downloads a simplified `drive` road network from OpenStreetMap, validates the
directed NetworkX graph, maps each location to its nearest road node, and saves
the results under `backend/outputs/`.

Data source attribution: © OpenStreetMap contributors, Open Database License
(ODbL) 1.0. See https://www.openstreetmap.org/copyright.

It does **not** implement A*, shortest-path search, TSP, or route ordering.

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
