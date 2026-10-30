"""Typed response models exposed by the RouteBawang AI API."""

from typing import Literal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    version: str


class Location(BaseModel):
    name: str
    latitude: float
    longitude: float


class LocationsResponse(BaseModel):
    warehouse: Location
    destinations: list[Location]


class Leg(BaseModel):
    from_location: str = Field(alias="from")
    to_location: str = Field(alias="to")
    distance_m: float
    path: list[int]
    path_node_count: int
    evaluated_nodes: int
    execution_time_ms: float


class CandidateRoute(BaseModel):
    rank: int
    route: list[str]
    total_distance_m: float
    total_distance_km: float
    is_optimal: bool


class AlternativeRoutesResponse(BaseModel):
    count: int
    routes: list[CandidateRoute]


class OptimizationResponse(BaseModel):
    warehouse: str
    destinations: list[str]
    optimal_route: list[str]
    total_distance_m: float
    total_distance_km: float
    distance_matrix_m: dict[str, dict[str, float]]
    legs: list[Leg]
    candidates: list[CandidateRoute]


class OptimalRouteResponse(BaseModel):
    route: list[str]
    total_distance_m: float
    total_distance_km: float
    legs: list[Leg]
    combined_path: list[int]


class SearchStep(BaseModel):
    step: int
    node: int
    parent: int | None
    g: float
    h: float
    f: float
    status: str


class AStarResponse(BaseModel):
    from_location: str = Field(alias="from")
    to_location: str = Field(alias="to")
    distance_m: float
    path: list[int]
    evaluated_nodes: int
    search_steps: list[SearchStep]
    open_nodes: list[int]
    closed_nodes: list[int]
    path_node_count: int
    execution_time_ms: float
