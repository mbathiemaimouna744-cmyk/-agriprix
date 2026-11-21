import { useEffect, useState } from "react";
import { supabase } from "./supabase";

const vide = { produit: "", quantite_kg: "", prix_kg: "", region: "", telephone: "" };

export default function Annonces({ user }) {
  const [liste, setListe] = useState([]);
  const [filtre, setFiltre] = useState("");
  const [f, setF] = useState(vide);

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

  const publier = async () => {
    if (!user) return alert("Connectez-vous pour publier une annonce.");

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
        <div className="card">
          <h2>Publier une annonce</h2>
          {Object.keys(vide).map((k) => (
            <input key={k} placeholder={k.replace("_", " ")} value={f[k]}
              onChange={(e) => setF({ ...f, [k]: e.target.value })} />
          ))}
          <button onClick={publier}>Publier</button>
        </div>
      )}
      <input className="search" placeholder="🔍 Rechercher un produit ou une région"
        value={filtre} onChange={(e) => setFiltre(e.target.value)} />
      <div className="grid">
        {visibles.map((a) => (
          <div className="card" key={a.id}>
            <h3>{a.produit}</h3>
            <p>{a.quantite_kg} kg à {a.prix_kg} FCFA/kg</p>
            <p>📍 {a.region}</p>
            <a href={`https://wa.me/221${a.telephone}`} target="_blank" rel="noreferrer">
              💬 Contacter sur WhatsApp
            </a>
            {user?.id === a.user_id && <button onClick={() => supprimer(a.id)}>Supprimer</button>}
          </div>
        ))}
      </div>
    </div>
  );
}