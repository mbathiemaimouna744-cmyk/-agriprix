import json
from pathlib import Path

import numpy as np
import pandas as pd
from joblib import dump
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.metrics import mean_absolute_error, mean_squared_error


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "prix_releves.csv"
MODEL_PATH = ROOT / "ml" / "model.joblib"
METADATA_PATH = ROOT / "ml" / "metadata.json"
SOURCE_URL = "https://data.humdata.org/dataset/wfp-food-prices-for-senegal"
SOURCE_DATA_URL = (
    "https://data.humdata.org/dataset/77b76bc7-1edd-43f6-a5e4-784498ff6aca/"
    "resource/04ffc070-6d05-4653-a9f6-9f3f893a229e/download/wfp_food_prices_sen.csv"
)

CATEGORY_COLUMNS = ["product", "region", "market"]
NUMERIC_COLUMNS = [
    "year",
    "month_number",
    "lag_1",
    "lag_2",
    "lag_3",
    "lag_12",
    "mean_3",
    "change_1",
    "change_2",
    "change_3",
    "seasonal_change",
]
FEATURE_COLUMNS = CATEGORY_COLUMNS + NUMERIC_COLUMNS
GROUP_COLUMNS = ["product", "region", "market"]

REGION_LABELS = {
    "Thies": "Thiès",
    "Kedougou": "Kédougou",
    "Sedhiou": "Sédhiou",
}
PRODUCT_LABELS = {
    "Bananas (local)": "Bananes locales",
    "Beans (niebe)": "Niébé",
    "Cabbage": "Chou",
    "Carrots": "Carottes",
    "Cassava": "Manioc",
    "Fonio": "Fonio",
    "Groundnuts (shelled)": "Arachide décortiquée",
    "Groundnuts (unshelled)": "Arachide non décortiquée",
    "Maize (imported)": "Maïs importé",
    "Maize (local)": "Maïs local",
    "Mangoes (local)": "Mangues locales",
    "Millet": "Mil",
    "Onions (dry)": "Oignon sec",
    "Onions (imported)": "Oignon importé",
    "Oranges": "Oranges",
    "Oranges (imported)": "Oranges importées",
    "Potatoes": "Pommes de terre",
    "Potatoes (imported)": "Pommes de terre importées",
    "Rice (imported)": "Riz importé",
    "Rice (local)": "Riz local",
    "Rice (ordinary, first quality)": "Riz ordinaire, première qualité",
    "Rice (ordinary, second quality)": "Riz ordinaire, deuxième qualité",
    "Sorghum": "Sorgho",
    "Sorghum (imported)": "Sorgho importé",
    "Sweet potatoes": "Patates douces",
    "Tomatoes": "Tomates",
    "Watermelons": "Pastèques",
}


def load_monthly_prices(path=DATA_PATH):
    required_columns = [
        "date",
        "admin1",
        "market",
        "commodity",
        "unit",
        "pricetype",
        "currency",
        "price",
    ]
    raw = pd.read_csv(path, usecols=required_columns)
    raw_rows = len(raw)
    raw["price"] = pd.to_numeric(raw["price"], errors="coerce")
    raw["date"] = pd.to_datetime(raw["date"], errors="coerce")
    valid = (
        raw["currency"].eq("XOF")
        & raw["unit"].eq("KG")
        & raw["pricetype"].eq("Retail")
        & ~raw["commodity"].fillna("").str.startswith("Livestock")
        & raw["admin1"].fillna("").ne("")
        & raw["market"].fillna("").ne("")
        & raw["commodity"].fillna("").ne("")
        & raw["date"].notna()
        & raw["price"].gt(0)
    )
    usable = raw.loc[valid, required_columns].copy()
    usable["month"] = usable["date"].dt.to_period("M")
    monthly = (
        usable.groupby(
            ["commodity", "admin1", "market", "month"], as_index=False
        )
        .agg(price=("price", "median"), observed_date=("date", "max"))
        .rename(
            columns={
                "commodity": "product",
                "admin1": "region",
            }
        )
    )
    monthly["observed_date"] = monthly["observed_date"].dt.strftime("%Y-%m-%d")
    return monthly, raw_rows, int(valid.sum())


def _features_for_target(prices, product, region, market, target_month):
    row = {
        "product": product,
        "region": region,
        "market": market,
        "year": target_month.year,
        "month_number": target_month.month,
        "target_month": target_month,
    }
    previous_prices = []
    for lag in (1, 2, 3, 12):
        value = prices.get(target_month - lag, np.nan)
        row[f"lag_{lag}"] = float(value) if pd.notna(value) else np.nan
        if lag <= 3 and pd.notna(value):
            previous_prices.append(float(value))
    row["mean_3"] = (
        float(np.mean(previous_prices)) if previous_prices else np.nan
    )
    change_pairs = {
        "change_1": (row["lag_1"], row["lag_2"]),
        "change_2": (row["lag_2"], row["lag_3"]),
        "change_3": (row["lag_3"], row["lag_12"]),
        "seasonal_change": (row["lag_1"], row["lag_12"]),
    }
    for name, (current, previous) in change_pairs.items():
        row[name] = (
            float(np.log(current / previous))
            if pd.notna(current) and pd.notna(previous) and current > 0 and previous > 0
            else np.nan
        )
    return row


def build_supervised_examples(monthly):
    examples = []
    for (product, region, market), group in monthly.groupby(
        GROUP_COLUMNS, sort=False
    ):
        periods = pd.PeriodIndex(group["month"], freq="M")
        observed_prices = pd.Series(
            group["price"].to_numpy(dtype=float), index=periods
        ).sort_index()
        full_months = pd.period_range(
            observed_prices.index.min(), observed_prices.index.max(), freq="M"
        )
        prices = observed_prices.reindex(full_months)

        for target_month in full_months[1:]:
            target_price = prices.get(target_month, np.nan)
            if pd.isna(target_price) or pd.isna(prices.get(target_month - 1, np.nan)):
                continue
            row = _features_for_target(
                prices, product, region, market, target_month
            )
            row["target_price"] = float(target_price)
            examples.append(row)

    if not examples:
        raise ValueError("Aucune paire de relevés mensuels consécutifs exploitable.")
    return pd.DataFrame(examples)


def build_prediction_features(monthly, product, region, market):
    selected = monthly.loc[
        monthly["product"].eq(product)
        & monthly["region"].eq(region)
        & monthly["market"].eq(market)
    ].sort_values("month")
    if selected.empty:
        raise KeyError("Aucune série WFP ne correspond à ce produit et ce marché.")

    periods = pd.PeriodIndex(selected["month"], freq="M")
    observed_prices = pd.Series(
        selected["price"].to_numpy(dtype=float), index=periods
    ).sort_index()
    last_month = observed_prices.index.max()
    target_month = last_month + 1
    row = _features_for_target(
        observed_prices, product, region, market, target_month
    )
    features = pd.DataFrame(
        [{column: row[column] for column in FEATURE_COLUMNS}]
    )
    return features, target_month, last_month, selected.iloc[-1]["observed_date"], len(selected)


def build_options(monthly):
    latest_month = monthly["month"].max()
    recent_cutoff = latest_month - 11
    summaries = (
        monthly.groupby(GROUP_COLUMNS, as_index=False)
        .agg(
            dernier_mois=("month", "max"),
            dernier_releve=("observed_date", "max"),
            observations=("price", "count"),
        )
    )
    summaries = summaries.loc[
        summaries["observations"].ge(6)
        & summaries["dernier_mois"].ge(recent_cutoff)
    ]
    options = []
    for row in summaries.to_dict(orient="records"):
        options.append(
            {
                "produit": row["product"],
                "produit_libelle": PRODUCT_LABELS.get(
                    row["product"], row["product"]
                ),
                "region": row["region"],
                "region_libelle": REGION_LABELS.get(
                    row["region"], row["region"]
                ),
                "marche": row["market"],
                "dernier_releve": row["dernier_releve"],
                "observations": int(row["observations"]),
            }
        )
    return sorted(
        options,
        key=lambda item: (
            item["produit_libelle"],
            item["region_libelle"],
            item["marche"],
        ),
    )


def _create_model():
    preprocessing = ColumnTransformer(
        transformers=[
            (
                "categories",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                CATEGORY_COLUMNS,
            ),
            ("numeriques", SimpleImputer(strategy="median"), NUMERIC_COLUMNS),
        ],
        remainder="drop",
    )
    return Pipeline(
        steps=[
            ("preprocessing", preprocessing),
            (
                "regression",
                HistGradientBoostingRegressor(
                    learning_rate=0.06,
                    max_iter=160,
                    max_leaf_nodes=15,
                    l2_regularization=1.0,
                    random_state=42,
                ),
            ),
        ]
    )


def train_model(
    data_path=DATA_PATH,
    model_path=MODEL_PATH,
    metadata_path=METADATA_PATH,
):
    monthly, raw_rows, usable_rows = load_monthly_prices(data_path)
    examples = build_supervised_examples(monthly)
    unique_months = sorted(examples["target_month"].unique())
    split_month = unique_months[max(1, int(len(unique_months) * 0.8))]
    train_rows = examples.loc[examples["target_month"].lt(split_month)]
    test_rows = examples.loc[examples["target_month"].ge(split_month)]
    if train_rows.empty or test_rows.empty:
        raise ValueError("Impossible de constituer une validation chronologique.")

    validation_model = _create_model()
    validation_model.fit(
        train_rows[FEATURE_COLUMNS],
        np.log(train_rows["target_price"] / train_rows["lag_1"]),
    )
    predicted = test_rows["lag_1"].to_numpy(dtype=float) * np.exp(
        validation_model.predict(test_rows[FEATURE_COLUMNS])
    )
    actual = test_rows["target_price"].to_numpy(dtype=float)
    baseline = test_rows["lag_1"].to_numpy(dtype=float)
    metrics = {
        "debut_validation": str(split_month),
        "fin_validation": str(test_rows["target_month"].max()),
        "observations_validation": int(len(test_rows)),
        "mae_fcfa_kg": round(float(mean_absolute_error(actual, predicted)), 2),
        "mae_baseline_fcfa_kg": round(
            float(mean_absolute_error(actual, baseline)), 2
        ),
        "rmse_fcfa_kg": round(
            float(np.sqrt(mean_squared_error(actual, predicted))), 2
        ),
        "meilleur_que_baseline": bool(
            mean_absolute_error(actual, predicted)
            < mean_absolute_error(actual, baseline)
        ),
    }

    model = _create_model()
    model.fit(
        examples[FEATURE_COLUMNS],
        np.log(examples["target_price"] / examples["lag_1"]),
    )
    data_as_of = max(monthly["observed_date"])
    metadata = {
        "source": "WFP Food Prices for Senegal, diffusé par HDX",
        "source_url": SOURCE_URL,
        "source_data_url": SOURCE_DATA_URL,
        "licence": "CC BY-IGO",
        "premiere_date_donnees": min(monthly["observed_date"]),
        "date_donnees": data_as_of,
        "lignes_source": int(raw_rows),
        "observations_xof_kg_retail": int(usable_rows),
        "observations_mensuelles": int(len(monthly)),
        "exemples_entrainement": int(len(examples)),
        "produits": int(monthly["product"].nunique()),
        "regions": int(monthly["region"].nunique()),
        "marches": int(monthly["market"].nunique()),
        "validation": metrics,
        "methodologie": (
            "Prévision d'un mois à l'avance sur des prix mensuels médians "
            "XOF/kg; validation chronologique comparée au dernier prix connu."
        ),
    }
    model_path = Path(model_path)
    metadata_path = Path(metadata_path)
    model_path.parent.mkdir(parents=True, exist_ok=True)
    metadata_path.parent.mkdir(parents=True, exist_ok=True)
    dump(
        {
            "model": model,
            "monthly_prices": monthly,
            "metadata": metadata,
            "options": build_options(monthly),
        },
        model_path,
    )
    metadata_path.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return metadata


if __name__ == "__main__":
    print(json.dumps(train_model(), ensure_ascii=False, indent=2))
