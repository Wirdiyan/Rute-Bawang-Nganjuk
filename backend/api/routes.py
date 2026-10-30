"""Read-only REST endpoints backed by generated OSM/optimizer outputs."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from .schemas import (
    AStarResponse,
    AlternativeRoutesResponse,
    CandidateRoute,
    HealthResponse,
    Leg,
    LocationsResponse,
    Location,
    OptimalRouteResponse,
    OptimizationResponse,
)

router = APIRouter(prefix="/api")
PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = PROJECT_ROOT / "backend" / "outputs"
LOCATIONS_PATH = OUTPUT_DIR / "locations.json"
OPTIMIZATION_PATH = OUTPUT_DIR / "route_optimization.json"
API_VERSION = "1.0.0"
SERVICE_NAME = "RouteBawang AI API"


def _read_json(path: Path, label: str) -> dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as file:
            data = json.load(file)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"{label} file is missing: {path}. Generate the required backend output first.",
        ) from exc
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to read {label} file at {path}: {exc}",
        ) from exc
    if not isinstance(data, dict):
        raise HTTPException(status_code=500, detail=f"{label} file must contain a JSON object")
    return data


def _location_response(raw: dict[str, Any]) -> Location:
    try:
        return Location(
            name=raw["name"],
            latitude=raw["latitude"],
            longitude=raw["longitude"],
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=500, detail=f"Invalid location entry in locations.json: {exc}") from exc


def _optimization_data() -> dict[str, Any]:
    return _read_json(OPTIMIZATION_PATH, "Route optimization output")


def _leg_response(raw: dict[str, Any]) -> Leg:
    return Leg(
        **{
            "from": raw["from"],
            "to": raw["to"],
            "distance_m": raw["distance_m"],
            "path": raw["path"],
            "path_node_count": raw["path_node_count"],
            "evaluated_nodes": raw["evaluated_node_count"],
            "execution_time_ms": raw["execution_time_ms"],
        }
    )


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Check API health",
    description="Confirms the RouteBawang AI API process is available.",
)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service=SERVICE_NAME, version=API_VERSION)


@router.get(
    "/locations",
    response_model=LocationsResponse,
    summary="Get configured locations",
    description="Reads warehouse and destination names and coordinates from the generated OSM location data.",
)
def get_locations() -> LocationsResponse:
    data = _read_json(LOCATIONS_PATH, "Location data")
    try:
        return LocationsResponse(
            warehouse=_location_response(data["warehouse"]),
            destinations=[_location_response(location) for location in data["destinations"]],
        )
    except (KeyError, TypeError) as exc:
        raise HTTPException(status_code=500, detail=f"Location data has an invalid structure: {exc}") from exc


@router.get(
    "/route/optimize",
    response_model=OptimizationResponse,
    summary="Get optimized multi-destination route",
    description="Returns the already computed optimizer output, including all candidates and detailed optimal legs.",
)
def get_optimization() -> OptimizationResponse:
    data = _optimization_data()
    try:
        candidates = [
            CandidateRoute(
                rank=index,
                route=candidate["order"],
                total_distance_m=candidate["total_distance_m"],
                total_distance_km=candidate["total_distance_m"] / 1000,
                is_optimal=candidate["is_optimal"],
            )
            for index, candidate in enumerate(data["candidates"], start=1)
        ]
        return OptimizationResponse(
            warehouse=data["warehouse"],
            destinations=data["destinations"],
            optimal_route=data["optimal_route"],
            total_distance_m=data["total_distance_m"],
            total_distance_km=data["total_distance_m"] / 1000,
            distance_matrix_m=data["distance_matrix_m"],
            legs=[_leg_response(leg) for leg in data["legs"]],
            candidates=candidates,
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=500, detail=f"Route optimization output has an invalid structure: {exc}") from exc


@router.get(
    "/route/optimal",
    response_model=OptimalRouteResponse,
    summary="Get optimal route details",
    description="Returns the selected round trip, its A* legs, and the concatenated OSM graph path.",
)
def get_optimal_route() -> OptimalRouteResponse:
    data = _optimization_data()
    try:
        return OptimalRouteResponse(
            route=data["optimal_route"],
            total_distance_m=data["total_distance_m"],
            total_distance_km=data["total_distance_m"] / 1000,
            legs=[_leg_response(leg) for leg in data["legs"]],
            combined_path=data["combined_path"],
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=500, detail=f"Optimal route output has an invalid structure: {exc}") from exc


@router.get(
    "/routes/alternatives",
    response_model=AlternativeRoutesResponse,
    summary="Get alternative route orders",
    description="Returns all six destination orders sorted by total road distance.",
)
def get_alternative_routes() -> AlternativeRoutesResponse:
    data = _optimization_data()
    try:
        routes = [
            CandidateRoute(
                rank=index,
                route=candidate["order"],
                total_distance_m=candidate["total_distance_m"],
                total_distance_km=candidate["total_distance_m"] / 1000,
                is_optimal=candidate["is_optimal"],
            )
            for index, candidate in enumerate(data["candidates"], start=1)
        ]
        routes.sort(key=lambda route: route.total_distance_m)
        return AlternativeRoutesResponse(count=len(routes), routes=routes)
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=500, detail=f"Alternative route output has an invalid structure: {exc}") from exc


@router.get(
    "/astar",
    response_model=AStarResponse,
    summary="Get custom A* search details",
    description="Returns the cached custom A* path and actual search trace for a directed pair of configured locations.",
)
def get_astar(
    from_location: str = Query(alias="from", min_length=1, description="Configured origin location name"),
    to_location: str = Query(alias="to", min_length=1, description="Configured destination location name"),
) -> AStarResponse:
    data = _optimization_data()
    normalized_from = from_location.strip()
    normalized_to = to_location.strip()
    pair_key = f"{normalized_from}->{normalized_to}"
    pair = data.get("pair_results", {}).get(pair_key)
    if pair is None:
        known_locations = [data.get("warehouse"), *data.get("destinations", [])]
        known_locations = [name for name in known_locations if name]
        if normalized_from not in known_locations or normalized_to not in known_locations:
            raise HTTPException(
                status_code=404,
                detail=f"Unknown location pair. Use configured locations: {', '.join(known_locations)}.",
            )
        raise HTTPException(
            status_code=400,
            detail=f"No cached directed A* result exists for {normalized_from!r} -> {normalized_to!r}.",
        )
    try:
        return AStarResponse(
            **{
                "from": pair["from"],
                "to": pair["to"],
                "distance_m": pair["distance_m"],
                "path": pair["path"],
                "evaluated_nodes": pair["evaluated_node_count"],
                "search_steps": pair["search_steps"],
                "open_nodes": pair["open_nodes"],
                "closed_nodes": pair["closed_nodes"],
                "path_node_count": pair["path_node_count"],
                "execution_time_ms": pair["execution_time_ms"],
            }
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=500, detail=f"Cached A* result has an invalid structure: {exc}") from exc
