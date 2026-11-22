import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export default function Prix() {
  const [prix, setPrix] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [prixWfp, setPrixWfp] = useState(null);
  const [chargementWfp, setChargementWfp] = useState(true);
  const [erreurWfp, setErreurWfp] = useState("");
  const [filtreWfp, setFiltreWfp] = useState("");
  const [limiteWfp, setLimiteWfp] = useState(50);
  const [joursDepuisReleve, setJoursDepuisReleve] = useState(null);

  useEffect(() => {
    let actif = true;

    const charger = async () => {
      try {
        const { data, error } = await supabase
          .from("prix_marche")
          .select("*")
          .order("produit");

        if (error) throw error;
        if (actif) setPrix(data || []);
      } catch (error) {
        console.error("Impossible de charger les prix du marché:", error);
        if (actif) setErreur("Impossible de charger les prix. Vérifiez les droits de lecture dans Supabase.");
      } finally {
        if (actif) setChargement(false);
      }
    };

    charger();
    return () => {
      actif = false;
    };
  }, []);

  useEffect(() => {
    let actif = true;

    const chargerPrixWfp = async () => {
      try {
        const response = await fetch("/api/prix-wfp");
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.erreur || "Impossible de charger la source WFP.");
        }
        if (actif) {
          setPrixWfp(data);
          const dateReleve = new Date(`${data.latestDate}T00:00:00`);
          setJoursDepuisReleve(
            Number.isNaN(dateReleve.getTime())
              ? null
              : Math.floor((Date.now() - dateReleve.getTime()) / 86400000)
          );
        }
      } catch (error) {
        console.error("Impossible de charger les prix WFP:", error);
        if (actif) {
          setErreurWfp(
            error instanceof Error ? error.message : "La source externe est indisponible."
          );
        }
      } finally {
        if (actif) setChargementWfp(false);
      }
    };

    chargerPrixWfp();
    return () => {
      actif = false;
    };
  }, []);

  const donneesGraphique = prix
    .map((item) => ({ ...item, valeur: Number(item.prix_kg) }))
    .filter((item) => Number.isFinite(item.valeur) && item.valeur > 0);
  const prixMax = Math.max(...donneesGraphique.map((item) => item.valeur), 0);
  const normaliserTexte = (texte) =>
    String(texte ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("fr");
  const texteWfp = normaliserTexte(filtreWfp);
  const prixWfpFiltres = (prixWfp?.records || []).filter((item) =>
    normaliserTexte(`${item.produit} ${item.region} ${item.marche}`).includes(texteWfp)
  );
  const prixWfpVisibles = prixWfpFiltres.slice(0, limiteWfp);
  const dateDernierReleve = prixWfp?.latestDate
    ? new Date(`${prixWfp.latestDate}T00:00:00`)
    : null;
  return (
    <div className="card">
      <h2>Prix du marché (FCFA/kg)</h2>
      {chargement ? (
        <p>Chargement des prix...</p>
      ) : erreur ? (
        <p role="alert">{erreur}</p>
      ) : prix.length === 0 ? (
        <p>Aucun prix du marché n'est disponible.</p>
      ) : (
        <>
          {donneesGraphique.length > 0 && (
            <section className="price-chart" aria-labelledby="price-chart-title">
              <h3 id="price-chart-title">Comparaison des prix par produit et région</h3>
              <p>Les barres sont proportionnelles au prix le plus élevé : {prixMax} FCFA/kg.</p>
              <div className="price-chart__list">
                {donneesGraphique.map((item) => (
                  <div className="price-chart__item" key={item.id}>
                    <div className="price-chart__label">
                      <span>{item.produit} — {item.region}</span>
                      <strong>{item.valeur} FCFA/kg</strong>
                    </div>
                    <div
                      className="price-chart__track"
                      role="img"
                      aria-label={`${item.produit}, ${item.region} : ${item.valeur} FCFA/kg`}
                    >
                      <span
                        className="price-chart__bar"
                        style={{ width: `${(item.valeur / prixMax) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
          <table>
            <thead>
              <tr><th>Produit</th><th>Région</th><th>Prix</th><th>Date</th></tr>
            </thead>
            <tbody>
              {prix.map((p) => (
                <tr key={p.id}>
                  <td>{p.produit}</td><td>{p.region}</td><td>{p.prix_kg}</td><td>{p.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <section className="external-prices" aria-labelledby="external-prices-title">
        <h2 id="external-prices-title">Derniers prix observés par le PAM</h2>
        <p>
          Données du Programme alimentaire mondial (WFP), diffusées via HDX.
          Il s’agit de prix de détail observés, pas de prix garantis à la production.
        </p>
        <p>
          Fréquence variable, séries généralement mensuelles. Dernière observation
          disponible :{" "}
          {dateDernierReleve
            ? dateDernierReleve.toLocaleDateString("fr-FR")
            : "en attente"}.
          {joursDepuisReleve !== null && joursDepuisReleve > 30
            ? " Ce relevé date de plus d’un mois."
            : ""}
          {prixWfp?.stale ? " La copie en cache est utilisée car la source n’a pas répondu." : ""}
        </p>
        <p className="external-prices__source">
          Source et attribution :{" "}
          <a href="https://data.humdata.org/dataset/wfp-food-prices-for-senegal" target="_blank" rel="noreferrer">
            WFP Food Prices for Senegal — HDX
          </a>
          {" "}· Licence CC BY-IGO · Unité filtrée : XOF/kg.
        </p>

        {chargementWfp ? (
          <p>Chargement des relevés externes...</p>
        ) : erreurWfp ? (
          <p role="alert">{erreurWfp}</p>
        ) : (
          <>
            <input
              type="search"
              aria-label="Filtrer les prix externes"
              placeholder="Filtrer par produit, région ou marché"
              value={filtreWfp}
              onChange={(event) => {
                setFiltreWfp(event.target.value);
                setLimiteWfp(50);
              }}
            />
            <p>{prixWfpFiltres.length} relevés correspondent à la recherche.</p>
            <div className="external-prices__table">
              <table>
                <thead>
                  <tr><th>Date</th><th>Produit</th><th>Région / marché</th><th>Prix</th></tr>
                </thead>
                <tbody>
                  {prixWfpVisibles.map((item) => (
                    <tr key={`${item.date}-${item.region}-${item.marche}-${item.produit}`}>
                      <td>{new Date(`${item.date}T00:00:00`).toLocaleDateString("fr-FR")}</td>
                      <td>{item.produit}</td>
                      <td>{item.region} — {item.marche}</td>
                      <td>{item.prix_kg} FCFA/kg</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {prixWfpFiltres.length === 0 && <p>Aucun relevé ne correspond à cette recherche.</p>}
            {prixWfpFiltres.length > prixWfpVisibles.length && (
              <button type="button" onClick={() => setLimiteWfp((limite) => limite + 50)}>
                Afficher 50 relevés supplémentaires
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}