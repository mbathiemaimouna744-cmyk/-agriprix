import os
from functools import lru_cache
from pathlib import Path

import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS
from joblib import load

from ml.train import (
    MODEL_PATH,
    build_prediction_features,
)


app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024
origins = [
    origin.strip()
    for origin in os.environ.get(
        "ML_API_ALLOWED_ORIGINS",
        "https://agriprix.vercel.app,http://localhost:5173",
    ).split(",")
    if origin.strip()
]
CORS(app, resources={r"/*": {"origins": origins}})


@lru_cache(maxsize=1)
def _load_trained_bundle():
    return load(MODEL_PATH)


def _load_bundle():
    if not Path(MODEL_PATH).is_file():
        return None
    return _load_trained_bundle()


def _model_unavailable():
    return (
        jsonify(
            {
                "erreur": (
                    "Le modèle n'est pas encore disponible. "
                    "L'entraînement doit réussir sur Render."
                )
            }
        ),
        503,
    )


@app.get("/")
def index():
    return jsonify(
        {
            "service": "AgriPrix — API de prévision expérimentale",
            "endpoints": ["/health", "/options", "/predict"],
        }
    )


@app.get("/health")
def health():
    bundle = _load_bundle()
    if bundle is None:
        return _model_unavailable()
    return jsonify(
        {
            "status": "ok",
            "modele_charge": True,
            "date_donnees": bundle["metadata"]["date_donnees"],
            "validation": bundle["metadata"]["validation"],
        }
    )


@app.get("/options")
def options():
    bundle = _load_bundle()
    if bundle is None:
        return _model_unavailable()
    return jsonify({"options": bundle["options"]})


@app.post("/predict")
def predict():
    bundle = _load_bundle()
    if bundle is None:
        return _model_unavailable()

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"erreur": "Envoyez un objet JSON valide."}), 400
    required = ("produit", "region", "marche")
    if any(
        not isinstance(payload.get(field), str) or not payload[field].strip()
        for field in required
    ):
        return (
            jsonify(
                {
                    "erreur": (
                        "Les champs produit, région et marché sont obligatoires."
                    )
                }
            ),
            400,
        )

    product, region, market = (
        payload["produit"].strip(),
        payload["region"].strip(),
        payload["marche"].strip(),
    )
    chosen = next(
        (
            item
            for item in bundle["options"]
            if item["produit"] == product
            and item["region"] == region
            and item["marche"] == market
        ),
        None,
    )
    if chosen is None:
        return (
            jsonify(
                {
                    "erreur": (
                        "Cette série n'est pas disponible pour la prévision. "
                        "Choisissez un marché proposé par l'API."
                    )
                }
            ),
            404,
        )

    features, target_month, last_month, last_date, observation_count = (
        build_prediction_features(
            bundle["monthly_prices"], product, region, market
        )
    )
    latest_month = bundle["monthly_prices"]["month"].max()
    if last_month < latest_month - 11:
        return (
            jsonify(
                {
                    "erreur": (
                        "Le dernier relevé de cette série est trop ancien "
                        "pour produire une prévision."
                    )
                }
            ),
            422,
        )

    model = bundle["model"]
    predicted_price = float(
        features["lag_1"].iloc[0] * np.exp(model.predict(features)[0])
    )
    if not np.isfinite(predicted_price) or predicted_price <= 0:
        app.logger.error("Le modèle a produit un prix invalide pour %s.", market)
        return (
            jsonify({"erreur": "Le modèle n'a pas produit de prévision exploitable."}),
            500,
        )
    validation = bundle["metadata"]["validation"]
    return jsonify(
        {
            "prevision": {
                "produit": chosen["produit_libelle"],
                "region": chosen["region_libelle"],
                "marche": market,
                "mois": str(target_month),
                "prix_fcfa_kg": round(predicted_price, 2),
                "prix_reference_fcfa_kg": round(
                    float(features["lag_1"].iloc[0]), 2
                ),
                "dernier_releve": last_date,
                "observations": observation_count,
            },
            "evaluation": validation,
            "source": bundle["metadata"]["source"],
            "source_url": bundle["metadata"]["source_url"],
            "avertissement": (
                "Estimation expérimentale à partir des prix de détail WFP. "
                "Ce n'est ni un prix garanti ni un prix producteur."
            ),
        }
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")))
