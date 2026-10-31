"""In-process API integration checks using FastAPI's TestClient."""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))

from fastapi.testclient import TestClient  # noqa: E402

from backend.api.main import app  # noqa: E402

OUTPUT_DIR = PROJECT_ROOT / "backend" / "outputs"
client = TestClient(app)


def check(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> int:
    optimization = json.loads((OUTPUT_DIR / "route_optimization.json").read_text(encoding="utf-8"))
    location_data = json.loads((OUTPUT_DIR / "locations.json").read_text(encoding="utf-8"))

    response = client.get("/api/health")
    check(response.status_code == 200, f"Health returned {response.status_code}: {response.text}")
    check(response.json() == {
        "status": "ok",
        "service": "RouteBawang AI API",
        "version": "1.0.0",
    }, "Health response content is incorrect")
    print("Health API                 PASS")

    response = client.get("/api/locations")
    check(response.status_code == 200, f"Locations returned {response.status_code}: {response.text}")
    locations = response.json()
    required_names = {"Sukomoro", "Nganjuk", "Rejoso", "Gondang"}
    actual_names = {locations["warehouse"]["name"], *(item["name"] for item in locations["destinations"])}
    check(actual_names == required_names, f"Unexpected location names: {actual_names}")
    expected_locations = [location_data["warehouse"], *location_data["destinations"]]
    actual_locations = [locations["warehouse"], *locations["destinations"]]
    expected_by_name = {location["name"]: location for location in expected_locations}
    for actual in actual_locations:
        expected = expected_by_name[actual["name"]]
        check(actual["latitude"] == expected["latitude"], f"{actual['name']} latitude differs from locations.json")
        check(actual["longitude"] == expected["longitude"], f"{actual['name']} longitude differs from locations.json")
    print("Locations API              PASS")

    response = client.get("/api/route/optimize")
    check(response.status_code == 200, f"Optimization returned {response.status_code}: {response.text[:500]}")
    optimized = response.json()
    check(optimized["optimal_route"] == optimization["optimal_route"], "API optimal route differs from optimizer output")
    check(optimized["total_distance_m"] == optimization["total_distance_m"], "API distance differs from optimizer output")
    check(optimized["total_distance_km"] == optimization["total_distance_m"] / 1000, "API km conversion is incorrect")
    check(len(optimized["legs"]) == 4 and len(optimized["candidates"]) == 6, "Optimization response is missing legs or candidates")
    print("Optimization API           PASS")

    response = client.get("/api/route/optimal")
    check(response.status_code == 200, f"Optimal route returned {response.status_code}: {response.text[:500]}")
    optimal = response.json()
    check(optimal["route"][0] == "Sukomoro" and optimal["route"][-1] == "Sukomoro", "Optimal route does not return to warehouse")
    check(optimal["route"] == optimization["optimal_route"], "Optimal route endpoint differs from optimizer output")
    check(optimal["combined_path"] == optimization["combined_path"], "Combined path differs from optimizer output")
    path_coordinates = optimal["path_coordinates"]
    check(len(path_coordinates) >= len(optimal["combined_path"]), "Route geometry omits one or more A* graph nodes")
    check(len(path_coordinates) > len(optimal["route"]), "Route geometry does not contain road-level detail")
    check(all(
        math.isfinite(point["latitude"])
        and math.isfinite(point["longitude"])
        and -90 <= point["latitude"] <= 90
        and -180 <= point["longitude"] <= 180
        for point in path_coordinates
    ), "Route geometry contains invalid coordinates")
    print("Optimal Route API          PASS")

    response = client.get("/api/routes/alternatives")
    check(response.status_code == 200, f"Alternatives returned {response.status_code}: {response.text[:500]}")
    alternatives = response.json()
    check(alternatives["count"] == 6 and len(alternatives["routes"]) == 6, "Expected six alternative routes")
    distances = [route["total_distance_m"] for route in alternatives["routes"]]
    check(distances == sorted(distances), "Alternative routes are not sorted by distance")
    check(alternatives["routes"][0]["is_optimal"], "Shortest candidate is not marked optimal")
    print("Alternative Routes API     PASS")

    response = client.get("/api/astar", params={"from": "Sukomoro", "to": "Gondang"})
    check(response.status_code == 200, f"A* returned {response.status_code}: {response.text[:500]}")
    astar = response.json()
    cached_astar = optimization["pair_results"]["Sukomoro->Gondang"]
    check(astar["from"] == "Sukomoro" and astar["to"] == "Gondang", "A* endpoint locations are incorrect")
    check(astar["distance_m"] == cached_astar["distance_m"] > 0, "A* distance differs from the actual cached custom A* result")
    check(astar["path"] == cached_astar["path"] and len(astar["path"]) > 0, "A* path is missing or does not match cached result")
    check(astar["evaluated_nodes"] == cached_astar["evaluated_node_count"], "A* evaluated node count is incorrect")
    check(astar["search_steps"] == cached_astar["search_steps"], "A* search trace differs from cached custom A* trace")
    check(astar["search_steps"][-1]["node"] == astar["path"][-1], "A* trace does not finish at the goal")
    print("A* API                     PASS")

    unknown = client.get("/api/astar", params={"from": "NotAPlace", "to": "Gondang"})
    check(unknown.status_code == 404, "Unknown A* location should return HTTP 404")
    same_node = client.get("/api/astar", params={"from": "Sukomoro", "to": "Sukomoro"})
    check(same_node.status_code == 400, "Uncached same-location pair should return HTTP 400")

    preflight = client.options(
        "/api/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    check(preflight.status_code == 200, f"CORS preflight failed: {preflight.status_code}")
    check(preflight.headers.get("access-control-allow-origin") == "http://localhost:5173", "CORS origin is not allowed")

    docs = client.get("/docs")
    redoc = client.get("/redoc")
    openapi = client.get("/openapi.json")
    check(docs.status_code == 200 and redoc.status_code == 200 and openapi.status_code == 200, "Swagger/ReDoc/OpenAPI docs are unavailable")
    check(openapi.json()["info"]["title"] == "RouteBawang AI API", "OpenAPI title is incorrect")
    print("Error handling and CORS    PASS")
    print("Swagger / ReDoc            PASS")
    print("\nAPI tests: ALL PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
