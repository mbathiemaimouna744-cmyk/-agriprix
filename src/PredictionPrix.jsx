import { useEffect, useState } from "react";

const obtenirApiBase = () =>
  (import.meta.env.VITE_ML_API_URL || "").replace(/\/+$/, "");

const lireJson = async (response) => {
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      response.ok
        ? "L'API de prévision a renvoyé une réponse JSON invalide."
        : `L'API de prévision a répondu avec le statut ${response.status}.`
    );
  }
  if (!response.ok) {
    throw new Error(data.erreur || "L'API de prévision est indisponible.");
  }
  return data;
};

export default function PredictionPrix() {
  const [options, setOptions] = useState([]);
  const [selection, setSelection] = useState("");
  const [chargement, setChargement] = useState(true);
  const [chargementPrevision, setChargementPrevision] = useState(false);
  const [erreur, setErreur] = useState("");
  const [prevision, setPrevision] = useState(null);

  useEffect(() => {
    let actif = true;

    const chargerOptions = async () => {
      const apiBase = obtenirApiBase();
      if (!apiBase) {
        setErreur("L'URL de l'API ML n'est pas configurée.");
        setChargement(false);
        return;
      }

      try {
        const data = await lireJson(await fetch(`${apiBase}/options`));
        if (!Array.isArray(data.options)) {
          throw new Error("L'API de prévision a renvoyé une liste de marchés invalide.");
        }
        if (actif) {
          setOptions(data.options);
          if (data.options?.length) setSelection("0");
        }
      } catch (error) {
        console.error("Impossible de charger les marchés du modèle:", error);
        if (actif) {
          setErreur(
            error instanceof Error
              ? error.message
              : "Impossible de charger les marchés du modèle."
          );
        }
      } finally {
        if (actif) setChargement(false);
      }
    };

    chargerOptions();
    return () => {
      actif = false;
    };
  }, []);

  const demanderPrevision = async (event) => {
    event.preventDefault();
    const option = options[Number(selection)];
    const apiBase = obtenirApiBase();
    if (!option || !apiBase) return;

    setChargementPrevision(true);
    setErreur("");
    setPrevision(null);
    try {
      const response = await fetch(`${apiBase}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          produit: option.produit,
          region: option.region,
          marche: option.marche,
        }),
      });
      setPrevision(await lireJson(response));
    } catch (error) {
      console.error("Impossible de calculer la prévision:", error);
      setErreur(
        error instanceof Error
          ? error.message
          : "Impossible de calculer la prévision."
      );
    } finally {
      setChargementPrevision(false);
    }
  };

  return (
    <section className="ml-prediction" aria-labelledby="ml-prediction-title">
      <h2 id="ml-prediction-title">Estimation expérimentale par marché</h2>
      <p>
        Le modèle apprend à partir des historiques mensuels WFP et estime le
        prochain mois après le dernier relevé disponible. Il s’agit d’un prix de
        détail indicatif, pas d’une garantie ni d’un prix producteur.
      </p>

      {chargement ? (
        <p>Chargement des marchés disponibles...</p>
      ) : options.length > 0 ? (
        <form onSubmit={demanderPrevision}>
          <label htmlFor="ml-market">
            Produit, région et marché
          </label>
          <select
            id="ml-market"
            value={selection}
            onChange={(event) => {
              setSelection(event.target.value);
              setPrevision(null);
            }}
          >
            {options.map((option, index) => (
              <option key={`${option.produit}-${option.region}-${option.marche}`} value={index}>
                {option.produit_libelle} — {option.region_libelle} — {option.marche}
              </option>
            ))}
          </select>
          <button type="submit" disabled={chargementPrevision || !selection}>
            {chargementPrevision ? "Calcul en cours..." : "Estimer le prochain mois"}
          </button>
        </form>
      ) : (
        !erreur && <p>Aucun marché ne possède assez de relevés récents.</p>
      )}

      {erreur && <p role="alert">{erreur}</p>}
      {prevision && (
        <div className="ml-prediction__result" aria-live="polite">
          <h3>
            {prevision.prevision.produit} — {prevision.prevision.region} —{" "}
            {prevision.prevision.marche}
          </h3>
          <p>
            Estimation pour {prevision.prevision.mois} :{" "}
            <strong>
              {Number(prevision.prevision.prix_fcfa_kg).toLocaleString("fr-FR")} FCFA/kg
            </strong>
          </p>
          <p>
            Dernier prix mensuel observé (référence) :{" "}
            {Number(prevision.prevision.prix_reference_fcfa_kg).toLocaleString("fr-FR")} FCFA/kg.
          </p>
          <p>
            Dernier relevé :{" "}
            {new Date(`${prevision.prevision.dernier_releve}T00:00:00`).toLocaleDateString("fr-FR")}.
            {" "}Évaluation chronologique : erreur absolue moyenne du modèle{" "}
            {prevision.evaluation.mae_fcfa_kg} FCFA/kg, contre{" "}
            {prevision.evaluation.mae_baseline_fcfa_kg} FCFA/kg pour le dernier prix connu.
          </p>
          {!prevision.evaluation.meilleur_que_baseline && (
            <p role="status">
              Sur la période de validation, le modèle n'a pas fait mieux que le
              dernier prix connu. Utilisez cette estimation avec une prudence
              particulière.
            </p>
          )}
          <p>{prevision.avertissement}</p>
          <a href={prevision.source_url} target="_blank" rel="noreferrer">
            Source : {prevision.source}
          </a>
        </div>
      )}
    </section>
  );
}
