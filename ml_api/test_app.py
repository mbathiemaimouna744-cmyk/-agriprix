import unittest

import pandas as pd

from ml_api.app import app


class PredictionApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = app.test_client()

    def test_root_confirms_flask_service(self):
        response = self.client.get("/")

        self.assertEqual(response.status_code, 200)
        self.assertIn("/predict", response.get_json()["endpoints"])

    def test_health_and_options_report_trained_model(self):
        health = self.client.get("/health")
        options = self.client.get("/options")

        self.assertEqual(health.status_code, 200)
        self.assertTrue(health.get_json()["modele_charge"])
        self.assertEqual(options.status_code, 200)
        self.assertTrue(options.get_json()["options"])

    def test_prediction_returns_forecast_and_validation(self):
        option = self.client.get("/options").get_json()["options"][0]
        response = self.client.post(
            "/predict",
            json={
                "produit": option["produit"],
                "region": option["region"],
                "marche": option["marche"],
            },
        )
        body = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertGreater(body["prevision"]["prix_fcfa_kg"], 0)
        expected_month = pd.Period(option["dernier_releve"][:7], freq="M") + 1
        self.assertEqual(body["prevision"]["mois"], str(expected_month))
        self.assertIn("mae_fcfa_kg", body["evaluation"])
        self.assertIn("expérimentale", body["avertissement"])

    def test_prediction_rejects_missing_fields_and_unknown_series(self):
        missing = self.client.post("/predict", json={"produit": "Mil"})
        unknown = self.client.post(
            "/predict",
            json={"produit": "Inconnu", "region": "Dakar", "marche": "Inconnu"},
        )

        self.assertEqual(missing.status_code, 400)
        self.assertEqual(unknown.status_code, 404)


if __name__ == "__main__":
    unittest.main()
