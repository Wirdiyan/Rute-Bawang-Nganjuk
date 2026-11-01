"""FastAPI application entry point for RouteBawang AI."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from .routes import router

app = FastAPI(
    title="RouteBawang AI API",
    description="REST API untuk optimasi rute distribusi bawang merah multi-destinasi di Kabupaten Nganjuk.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(router)
app.add_middleware(GZipMiddleware, minimum_size=1000, compresslevel=5)
