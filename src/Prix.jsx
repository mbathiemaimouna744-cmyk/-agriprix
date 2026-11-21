import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export default function Prix() {
  const [prix, setPrix] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

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

  const donneesGraphique = prix
    .map((item) => ({ ...item, valeur: Number(item.prix_kg) }))
    .filter((item) => Number.isFinite(item.valeur) && item.valeur > 0);
  const prixMax = Math.max(...donneesGraphique.map((item) => item.valeur), 0);

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
    </div>
  );
}