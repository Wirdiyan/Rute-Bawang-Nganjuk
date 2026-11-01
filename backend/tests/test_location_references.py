import json
import unittest
import tempfile
from unittest.mock import patch
import networkx as nx
from fastapi.testclient import TestClient
from backend.api import solver
from backend.api.main import app
from pathlib import Path

from backend.location_references import prepared_reference, validate_location_reference


class GondangReferenceTests(unittest.TestCase):
    def test_government_reference_is_in_correct_district(self):
        reference = prepared_reference("Gondang")
        self.assertEqual(reference["postal_code"], "64451")
        self.assertEqual(reference["district"], "Gondang")
        self.assertEqual(reference["locality"], "Gondangkulon")
        self.assertEqual((reference["latitude"], reference["longitude"]), (-7.527964, 111.956318))
        self.assertFalse(reference["confirmed_delivery_point"])
        validate_location_reference(reference)

    def test_api_rejects_previous_reference_before_serving_dataset(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            graph = nx.MultiDiGraph()
            graph.add_node(0, x=0, y=0); graph.add_node(1, x=0, y=0)
            graph.add_edge(0, 1, length=1)
            nx.write_graphml(graph, root / "road_network.graphml")
            data = {"warehouse":{"name":"Sukomoro","nearest_node":0,"latitude":0,"longitude":0},
                    "destinations":[{"name":"Gondang","nearest_node":1,"latitude":-7.6876995,"longitude":111.9162959}]}
            (root / "locations.json").write_text(json.dumps(data), encoding="utf-8")
            solver._load_dataset.cache_clear()
            try:
                with patch.object(solver,"OUTPUT",root), TestClient(app) as client:
                    response = client.get("/api/dataset")
                    self.assertEqual(response.status_code,503)
                    self.assertIn("64451",response.json()["detail"])
            finally:
                solver._load_dataset.cache_clear()

    def test_previous_64472_settlement_is_rejected(self):
        previous = {"name":"Gondang", "latitude":-7.6876995, "longitude":111.9162959,
                    "display_name":"Gondang, Nganjuk, East Java, 64472, Indonesia"}
        with self.assertRaises(ValueError): validate_location_reference(previous)

    def test_changing_postcode_label_does_not_fix_wrong_coordinates(self):
        previous = {**prepared_reference("Gondang"), "latitude":-7.6876995, "longitude":111.9162959}
        with self.assertRaisesRegex(ValueError,"Koordinat"):validate_location_reference(previous)

    def test_committed_point_matches_reference_and_is_near_rejoso(self):
        data=json.loads((Path(__file__).resolve().parents[1]/"outputs"/"locations.json").read_text(encoding="utf-8"))
        points={point["name"]:point for point in data["destinations"]}
        validate_location_reference(points["Gondang"])
        self.assertLess(abs(points["Gondang"]["latitude"]-points["Rejoso"]["latitude"]),0.01)
        self.assertLess(abs(points["Gondang"]["longitude"]-points["Rejoso"]["longitude"]),0.08)
        self.assertNotEqual(points["Gondang"]["nearest_node"],6794469099)


if __name__ == "__main__":unittest.main()
