import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export default function Admin({ user, role }) {
  const [annonces, setAnnonces] = useState([]);
  const [prix, setPrix] = useState([]);
  const [produit, setProduit] = useState("");
  const [region, setRegion] = useState("");
  const [prixKg, setPrixKg] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    if (!user || role !== "admin") return;
    let actif = true;

    const chargerAdministration = async () => {
      const [annoncesReponse, prixReponse] = await Promise.all([
        supabase.from("annonces").select("*").order("created_at", { ascending: false }),
        supabase.from("prix_marche").select("*").order("date", { ascending: false }),
      ]);
      if (!actif) return;
      if (annoncesReponse.error || prixReponse.error) {
        setErreur("Impossible de charger les données d'administration.");
      } else {
        setAnnonces(annoncesReponse.data || []);
        setPrix(prixReponse.data || []);
      }
      setChargement(false);
    };

    chargerAdministration();
    return () => {
      actif = false;
    };
  }, [user, role]);

  if (!user || role !== "admin") {
    return <div className="card"><p>Cette zone est réservée aux administrateurs.</p></div>;
  }
  if (chargement) return <div className="card"><p>Chargement de l'administration...</p></div>;

  const supprimerAnnonce = async (annonce) => {
    const { error } = await supabase.from("annonces").delete().eq("id", annonce.id);
    if (error) {
      setErreur(error.message);
      return;
    }
    setAnnonces((liste) => liste.filter((item) => item.id !== annonce.id));
  };

  const ajouterPrix = async () => {
    if (!produit.trim() || !region.trim() || !prixKg || !date) {
      setErreur("Complétez le produit, la région, le prix et la date.");
      return;
    }
    const { data, error } = await supabase
      .from("prix_marche")
      .insert({
        produit: produit.trim(),
        region: region.trim(),
        prix_kg: Number(prixKg),
        date,
      })
      .select()
      .single();
    if (error) {
      setErreur(error.message);
      return;
    }
    setPrix((liste) => [data, ...liste]);
    setProduit("");
    setRegion("");
    setPrixKg("");
  };

  const supprimerPrix = async (id) => {
    const { error } = await supabase.from("prix_marche").delete().eq("id", id);
    if (error) {
      setErreur(error.message);
      return;
    }
    setPrix((liste) => liste.filter((item) => item.id !== id));
  };

  return (
    <div>
      {erreur && <p className="card" role="alert">{erreur}</p>}
      <section className="card">
        <h2>Modération des annonces</h2>
        {annonces.length === 0 ? <p>Aucune annonce.</p> : (
          <div className="admin-list">
            {annonces.map((annonce) => (
              <article key={annonce.id}>
                <div>
                  <strong>{annonce.produit}</strong>
                  <p>{annonce.quantite_kg} kg — {annonce.prix_kg} FCFA/kg — {annonce.region}</p>
                </div>
                <button type="button" className="button-danger" onClick={() => supprimerAnnonce(annonce)}>
                  Supprimer
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Prix du marché</h2>
        <div className="admin-price-form">
          <input placeholder="Produit" value={produit} onChange={(e) => setProduit(e.target.value)} />
          <input placeholder="Région" value={region} onChange={(e) => setRegion(e.target.value)} />
          <input type="number" min="1" placeholder="Prix FCFA/kg" value={prixKg} onChange={(e) => setPrixKg(e.target.value)} />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button type="button" onClick={ajouterPrix}>Ajouter</button>
        </div>
        {prix.map((item) => (
          <article className="admin-price" key={item.id}>
            <span>{item.produit} — {item.region} — {item.prix_kg} FCFA/kg — {item.date}</span>
            <button type="button" className="button-danger" onClick={() => supprimerPrix(item.id)}>Supprimer</button>
          </article>
        ))}
      </section>
    </div>
  );
}
