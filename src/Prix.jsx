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
      )}
    </div>
  );
}