import { useEffect, useState } from "react";
import { supabase } from "./supabase";

const vide = { produit: "", quantite_kg: "", prix_kg: "", region: "", telephone: "" };
const libelles = {
  produit: "Produit (ex : Oignon)",
  quantite_kg: "Quantité (kg)",
  prix_kg: "Prix par kg (FCFA)",
  region: "Région (ex : Thiès)",
  telephone: "Téléphone (ex : 771234567)",
};

const normaliser = (valeur) =>
  String(valeur ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("fr");

const badgePrix = (annonce, prixMarche) => {
  const produit = normaliser(annonce.produit);
  const region = normaliser(annonce.region);
  const reference = prixMarche.find(
    (prix) =>
      normaliser(prix.produit) === produit &&
      normaliser(prix.region) === region
  );
  const prixReference = Number(reference?.prix_kg);
  const prixAnnonce = Number(annonce.prix_kg);

  if (
    !reference ||
    !Number.isFinite(prixAnnonce) ||
    !Number.isFinite(prixReference) ||
    prixReference <= 0
  ) {
    return null;
  }

  const ecart = (prixAnnonce - prixReference) / prixReference;
  if (ecart > 0.1) {
    return {
      label: "🟠 Un peu cher",
      classe: "price-badge--high",
      reference: prixReference,
    };
  }
  if (ecart < -0.1) {
    return {
      label: "🔵 Bon prix pour l’acheteur",
      classe: "price-badge--low",
      reference: prixReference,
    };
  }
  return {
    label: "🟢 Prix juste",
    classe: "price-badge--fair",
    reference: prixReference,
  };
};

export default function Annonces({ user, role }) {
  const [liste, setListe] = useState([]);
  const [filtre, setFiltre] = useState("");
  const [f, setF] = useState(vide);
  const [prixMarche, setPrixMarche] = useState([]);
  const [erreurPrix, setErreurPrix] = useState("");

  const charger = async () => {
    const { data } = await supabase
      .from("annonces").select("*").order("created_at", { ascending: false });
    setListe(data || []);
  };
  useEffect(() => {
    supabase
      .from("annonces")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error("Impossible de charger les annonces:", error);
          return;
        }
        setListe(data || []);
      });
  }, []);

  useEffect(() => {
    let actif = true;

    const chargerPrix = async () => {
      try {
        const { data, error } = await supabase
          .from("prix_marche")
          .select("produit,region,prix_kg,date")
          .order("date", { ascending: false });

        if (error) throw error;
        if (actif) setPrixMarche(data || []);
      } catch (error) {
        console.error("Impossible de charger les prix de référence:", error);
        if (actif) setErreurPrix("Les prix de référence sont indisponibles.");
      }
    };

    chargerPrix();
    return () => {
      actif = false;
    };
  }, []);

  const publier = async () => {
    if (!user || role !== "agriculteur") {
      return alert("Seuls les agriculteurs connectés peuvent publier une annonce.");
    }

    const { error } = await supabase
      .from("annonces")
      .insert({ ...f, user_id: user.id });
    if (error) return alert(error.message);
    setF(vide);
    charger();
  };
  const supprimer = async (id) => {
    const { error } = await supabase.from("annonces").delete().eq("id", id);
    if (error) {
      console.error("Impossible de supprimer l'annonce:", error);
      return alert(error.message);
    }
    charger();
  };

  const visibles = liste.filter((a) =>
    (a.produit + a.region).toLowerCase().includes(filtre.toLowerCase()));

  return (
    <div>
      {user && (
        role === "agriculteur" ? (
          <div className="card">
            <h2>Publier une annonce</h2>
            {Object.keys(vide).map((k) => (
              <input key={k} placeholder={libelles[k]} value={f[k]}
                onChange={(e) => setF({ ...f, [k]: e.target.value })} />
            ))}
            <button onClick={publier}>Publier</button>
          </div>
        ) : role === "acheteur" ? (
          <div className="card">
            <h2>Espace acheteur</h2>
            <p>Recherchez des produits et contactez directement les agriculteurs.</p>
          </div>
        ) : null
      )}
      <input className="search" placeholder="🔍 Rechercher un produit ou une région"
        value={filtre} onChange={(e) => setFiltre(e.target.value)} />
      {erreurPrix && <p role="status">{erreurPrix}</p>}
      <div className="grid">
        {visibles.map((a) => {
          const badge = badgePrix(a, prixMarche);
          return (
            <div className="card" key={a.id}>
              <h3>{a.produit}</h3>
              <p>{a.quantite_kg} kg à {a.prix_kg} FCFA/kg</p>
              {badge && (
                <p className={`price-badge ${badge.classe}`}>
                  {badge.label} · référence : {badge.reference} FCFA/kg
                </p>
              )}
              <p>📍 {a.region}</p>
              <a href={`https://wa.me/221${a.telephone}`} target="_blank" rel="noreferrer">
                💬 Contacter sur WhatsApp
              </a>
              {role === "agriculteur" && user?.id === a.user_id && (
                <button onClick={() => supprimer(a.id)}>Supprimer</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}