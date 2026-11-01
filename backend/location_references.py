"""Vetted reference points that must not be replaced by ambiguous geocoding."""
from __future__ import annotations

import json
import math
from pathlib import Path

REFERENCES_PATH = Path(__file__).resolve().parent / "data" / "location_references.json"


def get_location_reference(name):
    references = json.loads(REFERENCES_PATH.read_text(encoding="utf-8"))
    return references.get(name)


def validate_location_reference(location):
    reference = get_location_reference(location.get("name"))
    if reference is None:
        return
    for key in ["reference_id", "postal_code", "district", "locality"]:
        if location.get(key) != reference[key]:
            raise ValueError(f"Referensi {location['name']} tidak cocok: {key}. Gunakan Kecamatan Gondang 64451, bukan desa senama.")
    lat, lon = float(location["latitude"]), float(location["longitude"])
    if not math.isfinite(lat) or not math.isfinite(lon):
        raise ValueError("Koordinat referensi tidak finite.")
    # Pin the cited reference, not a large postal-code area. Postal code alone
    # cannot disambiguate settlements, and must never override bad coordinates.
    if not math.isclose(lat, reference["latitude"], abs_tol=1e-7) or not math.isclose(lon, reference["longitude"], abs_tol=1e-7):
        raise ValueError("Koordinat Gondang berbeda dari titik referensi kecamatan yang telah diperiksa.")


def prepared_reference(name):
    reference = get_location_reference(name)
    if reference is None:
        return None
    return {**reference, "query": "Referensi terkurasi Kecamatan Gondang 64451; tidak memakai geocoding nama ambigu",
            "source": "BPS Kabupaten Nganjuk 2016 dan Kemendukbangga/BKKBN; graf jalan OpenStreetMap",
            "place_class": "government_reference", "osm_type": None, "osm_id": None,
            "geocoding_candidates": []}
