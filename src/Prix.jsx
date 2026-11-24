import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import {
  datePrixAffichee,
  libelleTypePrix,
  valeurPrixAffichee,
} from "./prixUtils";

const produitsHistorique = [
  { code: "maize", nom: "Maïs" },
  { code: "millet", nom: "Mil" },
  { code: "rice", nom: "Riz" },
  { code: "sorghum", nom: "Sorgho" },
];

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
  const [historiqueBanqueMondiale, setHistoriqueBanqueMondiale] = useState(null);
  const [chargementHistorique, setChargementHistorique] = useState(true);
  const [erreurHistorique, setErreurHistorique] = useState("");
  const [produitHistorique, setProduitHistorique] = useState("maize");

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

    const chargerHistorique = async () => {
      try {
        const response = await fetch("/api/prix-banque-mondiale");
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.erreur || "Impossible de charger l'historique des prix.");
        }
        if (actif) setHistoriqueBanqueMondiale(data);
      } catch (error) {
        console.error("Impossible de charger l'historique de la Banque mondiale:", error);
        if (actif) {
          setErreurHistorique(
            error instanceof Error ? error.message : "La source historique est indisponible."
          );
        }
      } finally {
        if (actif) setChargementHistorique(false);
      }
    };

    chargerHistorique();
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
  const serieHistorique = (historiqueBanqueMondiale?.records || [])
    .filter((record) => record.codeProduit === produitHistorique)
    .sort((a, b) => a.date.localeCompare(b.date));
  const produitHistoriqueSelectionne = produitsHistorique.find(
    (produit) => produit.code === produitHistorique
  );
  const largeurGraphique = 800;
  const hauteurGraphique = 300;
  const margeGraphique = { gauche: 64, droite: 20, haut: 20, bas: 42 };
  const valeursHistorique = serieHistorique.map((record) => record.prix_kg);
  const minimumHistorique = Math.min(...valeursHistorique);
  const maximumHistorique = Math.max(...valeursHistorique);
  const plageHistorique = maximumHistorique - minimumHistorique || 1;
  const pointsHistorique = serieHistorique.map((record, index) => {
    const largeurUtile = largeurGraphique - margeGraphique.gauche - margeGraphique.droite;
    const hauteurUtile = hauteurGraphique - margeGraphique.haut - margeGraphique.bas;
    return {
      ...record,
      x: margeGraphique.gauche
        + (serieHistorique.length > 1 ? index / (serieHistorique.length - 1) : 0) * largeurUtile,
      y: margeGraphique.haut
        + ((maximumHistorique - record.prix_kg) / plageHistorique) * hauteurUtile,
    };
  });
  const ligneHistorique = pointsHistorique
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
  const historiqueRecent = serieHistorique.slice(-12).reverse();

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
              <p>
                Les barres sont proportionnelles au prix le plus élevé : {prixMax} FCFA/kg.
                Les fourchettes sont représentées par leur milieu uniquement pour le graphique.
              </p>
              <div className="price-chart__list">
                {donneesGraphique.map((item) => (
                  <div className="price-chart__item" key={item.id}>
                    <div className="price-chart__label">
                      <span>{item.produit} — {item.region} — {libelleTypePrix(item.type_prix)}</span>
                      <strong>{valeurPrixAffichee(item)} FCFA/kg</strong>
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
          <div className="market-prices__table">
            <table>
              <thead>
                <tr>
                  <th>Produit</th><th>Région</th><th>Prix (FCFA/kg)</th><th>Date</th><th>Type de prix</th><th>Source</th>
                </tr>
              </thead>
              <tbody>
                {prix.map((p) => (
                  <tr key={p.id}>
                    <td>{p.produit}</td>
                    <td>{p.region}</td>
                    <td>{valeurPrixAffichee(p)}</td>
                    <td>{datePrixAffichee(p)}</td>
                    <td>{libelleTypePrix(p.type_prix)}</td>
                    <td>
                      {p.source_url && /^https?:\/\//i.test(p.source_url) ? (
                        <a href={p.source_url} target="_blank" rel="noreferrer">
                          {p.source || p.source_url}
                        </a>
                      ) : p.source || "Source à renseigner"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                  <tr><th>Date</th><th>Produit</th><th>Région / marché</th><th>Type</th><th>Prix</th></tr>
                </thead>
                <tbody>
                  {prixWfpVisibles.map((item) => (
                    <tr key={`${item.date}-${item.region}-${item.marche}-${item.produit}`}>
                      <td>{new Date(`${item.date}T00:00:00`).toLocaleDateString("fr-FR")}</td>
                      <td>{item.produit}</td>
                      <td>{item.region} — {item.marche}</td>
                      <td>{libelleTypePrix(item.type_prix)}</td>
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

      <section className="historical-prices" aria-labelledby="historical-prices-title">
        <h2 id="historical-prices-title">Évolution mensuelle estimée des prix</h2>
        <p>
          Série « Market Average » de la Banque mondiale, en FCFA/kg.
          Elle combine des données observées et des estimations modélisées pour compléter
          les périodes manquantes : ce n’est ni un relevé en temps réel ni un prix garanti
          au producteur.
        </p>
        <p>
          Source et méthodologie :{" "}
          <a href="https://microdata.worldbank.org/catalog/6173" target="_blank" rel="noreferrer">
            Banque mondiale — Monthly food price estimates by product and market
          </a>
          . Les prix ci-dessous sont une série agrégée, pas le prix d’un marché local précis.
          {historiqueBanqueMondiale?.stale
            ? " La copie en cache est utilisée car la source n’a pas répondu."
            : ""}
        </p>

        {chargementHistorique ? (
          <p>Chargement de l’historique des estimations...</p>
        ) : erreurHistorique ? (
          <p role="alert">{erreurHistorique}</p>
        ) : (
          <>
            <label htmlFor="historique-produit">Produit à comparer</label>
            <select
              id="historique-produit"
              value={produitHistorique}
              onChange={(event) => setProduitHistorique(event.target.value)}
            >
              {produitsHistorique.map((produit) => (
                <option key={produit.code} value={produit.code}>{produit.nom}</option>
              ))}
            </select>

            {serieHistorique.length > 0 ? (
              <>
                <p>
                  {produitHistoriqueSelectionne?.nom} : {serieHistorique.length} relevés
                  entre {serieHistorique[0].date.slice(0, 7)} et{" "}
                  {serieHistorique[serieHistorique.length - 1].date.slice(0, 7)}.
                </p>
                <div className="historical-chart">
                  <svg
                    viewBox={`0 0 ${largeurGraphique} ${hauteurGraphique}`}
                    role="img"
                    aria-label={`Évolution mensuelle estimée du prix du ${produitHistoriqueSelectionne?.nom} au Sénégal`}
                  >
                    {[0, 0.5, 1].map((fraction) => {
                      const y = margeGraphique.haut
                        + fraction * (hauteurGraphique - margeGraphique.haut - margeGraphique.bas);
                      const valeur = maximumHistorique - fraction * plageHistorique;
                      return (
                        <g key={fraction}>
                          <line
                            x1={margeGraphique.gauche}
                            x2={largeurGraphique - margeGraphique.droite}
                            y1={y}
                            y2={y}
                            className="historical-chart__grid"
                          />
                          <text x={margeGraphique.gauche - 8} y={y + 4} textAnchor="end">
                            {Math.round(valeur)}
                          </text>
                        </g>
                      );
                    })}
                    <polyline points={ligneHistorique} className="historical-chart__line" />
                    {pointsHistorique.map((point) => (
                      <circle
                        key={`${point.date}-${point.codeProduit}`}
                        cx={point.x}
                        cy={point.y}
                        r="2"
                        className="historical-chart__point"
                      >
                        <title>{point.date}: {point.prix_kg} FCFA/kg</title>
                      </circle>
                    ))}
                    <text x={margeGraphique.gauche} y={hauteurGraphique - 10}>
                      {serieHistorique[0].date.slice(0, 4)}
                    </text>
                    <text
                      x={largeurGraphique - margeGraphique.droite}
                      y={hauteurGraphique - 10}
                      textAnchor="end"
                    >
                      {serieHistorique[serieHistorique.length - 1].date.slice(0, 4)}
                    </text>
                  </svg>
                </div>
                <p>Prix indicatifs modélisés, en FCFA/kg.</p>
                <div className="historical-prices__table">
                  <table>
                    <thead>
                      <tr><th>Mois</th><th>Prix estimé (FCFA/kg)</th></tr>
                    </thead>
                    <tbody>
                      {historiqueRecent.map((record) => (
                        <tr key={`${record.date}-${record.codeProduit}`}>
                          <td>{new Date(`${record.date}T00:00:00`).toLocaleDateString("fr-FR", {
                            year: "numeric",
                            month: "long",
                          })}</td>
                          <td>{record.prix_kg}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p>Aucune estimation disponible pour ce produit.</p>
            )}
          </>
        )}
      </section>
    </div>
  );
}