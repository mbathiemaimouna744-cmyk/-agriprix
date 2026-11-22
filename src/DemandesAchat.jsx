import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { normaliserNumeroSenegal } from "./telephone";

const demandeVide = {
  produit: "",
  quantite_kg: "",
  region: "",
  prix_maximum_kg: "",
  telephone: "",
};

export default function DemandesAchat({ user, role }) {
  const [demandes, setDemandes] = useState([]);
  const [formulaire, setFormulaire] = useState(demandeVide);
  const [autoriseNumeroPublic, setAutoriseNumeroPublic] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    let actif = true;

    const chargerDemandes = async () => {
      const { data, error } = await supabase
        .from("demandes_achat")
        .select("id,buyer_id,produit,quantite_kg,region,prix_maximum_kg,telephone,created_at")
        .order("created_at", { ascending: false });

      if (!actif) return;
      if (error) {
        console.error("Impossible de charger les demandes d'achat:", error);
        setErreur("Impossible de charger les demandes. Vérifiez la configuration Supabase.");
      } else {
        setDemandes(data || []);
      }
      setChargement(false);
    };

    chargerDemandes();
    return () => {
      actif = false;
    };
  }, []);

  const modifier = (champ, valeur) => {
    setFormulaire((actuel) => ({ ...actuel, [champ]: valeur }));
  };

  const publierDemande = async (event) => {
    event.preventDefault();
    if (!user || role !== "acheteur") {
      setErreur("Seuls les acheteurs connectés peuvent publier une demande.");
      return;
    }
    if (!formulaire.produit.trim() || !formulaire.region.trim()
      || !formulaire.telephone.trim() || Number(formulaire.quantite_kg) <= 0) {
      setErreur("Complétez le produit, la quantité, la région et le téléphone.");
      return;
    }
    if (!autoriseNumeroPublic) {
      setErreur("Confirmez que votre numéro peut être affiché publiquement sur cette demande.");
      return;
    }

    setEnvoi(true);
    setErreur("");
    const demande = {
      buyer_id: user.id,
      produit: formulaire.produit.trim(),
      quantite_kg: Number(formulaire.quantite_kg),
      region: formulaire.region.trim(),
      prix_maximum_kg: formulaire.prix_maximum_kg
        ? Number(formulaire.prix_maximum_kg)
        : null,
      telephone: formulaire.telephone.trim(),
    };
    const { data, error } = await supabase
      .from("demandes_achat")
      .insert(demande)
      .select("id,buyer_id,produit,quantite_kg,region,prix_maximum_kg,telephone,created_at")
      .single();

    if (error) {
      console.error("Impossible de publier la demande d'achat:", error);
      setErreur(error.message);
    } else {
      setDemandes((actuelles) => [data, ...actuelles]);
      setFormulaire(demandeVide);
      setAutoriseNumeroPublic(false);
    }
    setEnvoi(false);
  };

  const supprimerDemande = async (id) => {
    const { error } = await supabase
      .from("demandes_achat")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Impossible de supprimer la demande d'achat:", error);
      setErreur(error.message);
      return;
    }
    setDemandes((actuelles) => actuelles.filter((demande) => demande.id !== id));
  };

  return (
    <div>
      {role === "acheteur" && (
        <form className="card purchase-request-form" onSubmit={publierDemande}>
          <h2>Publier une demande d’achat</h2>
          <p>Indique ce que tu recherches pour que les agriculteurs puissent te contacter.</p>
          <input
            required
            maxLength={100}
            placeholder="Produit recherché (ex. oignon)"
            value={formulaire.produit}
            onChange={(event) => modifier("produit", event.target.value)}
          />
          <input
            required
            type="number"
            min="1"
            step="0.1"
            placeholder="Quantité souhaitée (kg)"
            value={formulaire.quantite_kg}
            onChange={(event) => modifier("quantite_kg", event.target.value)}
          />
          <input
            required
            maxLength={100}
            placeholder="Région souhaitée"
            value={formulaire.region}
            onChange={(event) => modifier("region", event.target.value)}
          />
          <input
            type="number"
            min="1"
            step="1"
            placeholder="Prix maximum souhaité (FCFA/kg, facultatif)"
            value={formulaire.prix_maximum_kg}
            onChange={(event) => modifier("prix_maximum_kg", event.target.value)}
          />
          <input
            required
            type="tel"
            maxLength={25}
            placeholder="Téléphone (ex. 771234567)"
            value={formulaire.telephone}
            onChange={(event) => modifier("telephone", event.target.value)}
          />
          <label className="public-phone-consent">
            <input
              type="checkbox"
              checked={autoriseNumeroPublic}
              onChange={(event) => setAutoriseNumeroPublic(event.target.checked)}
            />
            J’accepte que mon numéro soit visible par les visiteurs pour me contacter.
          </label>
          <button type="submit" disabled={envoi}>
            {envoi ? "Publication..." : "Publier la demande"}
          </button>
        </form>
      )}

      {!user && (
        <p className="card">Connecte-toi comme acheteur pour publier une demande.</p>
      )}
      {role === "agriculteur" && (
        <p className="card">Consulte les demandes des acheteurs et contacte-les directement.</p>
      )}
      {erreur && <p className="card" role="alert">{erreur}</p>}

      {chargement ? (
        <p className="card">Chargement des demandes d’achat...</p>
      ) : demandes.length === 0 ? (
        <p className="card">Aucune demande d’achat pour le moment.</p>
      ) : (
        <div className="grid">
          {demandes.map((demande) => (
            <article className="card" key={demande.id}>
              <p className="request-label">Demande d’achat</p>
              <h3>{demande.produit}</h3>
              <p>Quantité recherchée : {demande.quantite_kg} kg</p>
              {demande.prix_maximum_kg && (
                <p>Budget maximum : {demande.prix_maximum_kg} FCFA/kg</p>
              )}
              <p>📍 {demande.region}</p>
              <p className="seller-phone">
                Téléphone :{" "}
                <a href={`tel:+${normaliserNumeroSenegal(demande.telephone)}`}>
                  +{normaliserNumeroSenegal(demande.telephone)}
                </a>
              </p>
              {role === "agriculteur" && (
                <a href={`sms:+${normaliserNumeroSenegal(demande.telephone)}`}>
                  ✉️ Contacter l’acheteur par SMS
                </a>
              )}
              {user?.id === demande.buyer_id && (
                <button
                  type="button"
                  className="button-danger"
                  onClick={() => supprimerDemande(demande.id)}
                >
                  Supprimer ma demande
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
