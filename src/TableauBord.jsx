import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export default function TableauBord({ user, role }) {
  const [annonces, setAnnonces] = useState([]);
  const [evaluation, setEvaluation] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [alertes, setAlertes] = useState([]);
  const [annonceEnCours, setAnnonceEnCours] = useState(null);
  const [maintenant, setMaintenant] = useState(null);
  const [produitAlerte, setProduitAlerte] = useState("");
  const [regionAlerte, setRegionAlerte] = useState("");
  const [prixAlerte, setPrixAlerte] = useState("");

  useEffect(() => {
    let actif = true;

    const charger = async () => {
      if (!user) {
        if (actif) setChargement(false);
        return;
      }
      try {
        const [mesAnnonces, mesEvaluations, mesAlertes] = await Promise.all([
          supabase
            .from("annonces")
            .select("id,produit,quantite_kg,prix_kg,region,created_at,statut,expires_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("evaluations")
            .select("seller_id,note,commentaire,updated_at")
            .eq("buyer_id", user.id)
            .order("updated_at", { ascending: false }),
          supabase
            .from("alertes_prix")
            .select("id,produit,region,prix_maximum,active")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
        ]);
        if (mesAnnonces.error) throw mesAnnonces.error;
        if (mesEvaluations.error) throw mesEvaluations.error;
        if (mesAlertes.error) throw mesAlertes.error;
        if (actif) {
          setAnnonces(mesAnnonces.data || []);
          setEvaluation(mesEvaluations.data || []);
          setAlertes(mesAlertes.data || []);
        }
      } catch (error) {
        console.error("Impossible de charger le tableau de bord:", error);
        if (actif) setErreur("Impossible de charger vos données personnelles.");
      } finally {
        if (actif) setChargement(false);
      }
    };

    charger();
    return () => {
      actif = false;
    };
  }, [user]);

  useEffect(() => {
    const actualiserMaintenant = () => setMaintenant(Date.now());
    actualiserMaintenant();
    const intervalle = window.setInterval(actualiserMaintenant, 60 * 1000);
    return () => window.clearInterval(intervalle);
  }, []);

  let contacts = [];
  try {
    contacts = JSON.parse(localStorage.getItem("agriprix_contacts") || "[]");
  } catch {
    contacts = [];
  }

  const creerAlerte = async () => {
    if (!produitAlerte.trim() || !regionAlerte.trim()) {
      setErreur("Saisissez un produit et une région pour créer l'alerte.");
      return;
    }
    setErreur("");
    const alerte = {
      user_id: user.id,
      produit: produitAlerte.trim(),
      region: regionAlerte.trim(),
      prix_maximum: prixAlerte ? Number(prixAlerte) : null,
      active: true,
    };
    const { data, error } = await supabase
      .from("alertes_prix")
      .insert(alerte)
      .select()
      .single();
    if (error) {
      console.error("Impossible de créer l'alerte:", error);
      setErreur(error.message);
      return;
    }
    setAlertes((liste) => [data, ...liste]);
    setProduitAlerte("");
    setRegionAlerte("");
    setPrixAlerte("");
  };

  const supprimerAlerte = async (id) => {
    const { error } = await supabase.from("alertes_prix").delete().eq("id", id);
    if (error) {
      console.error("Impossible de supprimer l'alerte:", error);
      setErreur(error.message);
      return;
    }
    setAlertes((liste) => liste.filter((alerte) => alerte.id !== id));
  };

  const modifierDisponibiliteAnnonce = async (annonce, remettreEnVente) => {
    setErreur("");
    setAnnonceEnCours(annonce.id);
    const modification = remettreEnVente
      ? {
          statut: "disponible",
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }
      : { statut: "vendu" };
    const { data, error } = await supabase
      .from("annonces")
      .update(modification)
      .eq("id", annonce.id)
      .eq("user_id", user.id)
      .select("id,produit,quantite_kg,prix_kg,region,created_at,statut,expires_at")
      .single();

    if (error) {
      console.error("Impossible de modifier la disponibilité de l'annonce:", error);
      setErreur(error.message);
      setAnnonceEnCours(null);
      return;
    }

    setAnnonces((liste) => liste.map((item) => item.id === annonce.id ? data : item));
    setAnnonceEnCours(null);
  };

  if (!user) return <div className="card"><p>Connectez-vous pour consulter votre tableau de bord.</p></div>;
  if (chargement) return <div className="card"><p>Chargement de votre tableau de bord...</p></div>;

  return (
    <div>
      {erreur && <p className="card" role="alert">{erreur}</p>}
      <section className="dashboard-stats">
        <article><strong>{role === "agriculteur" ? annonces.length : 0}</strong><span>mes annonces</span></article>
        <article><strong>{contacts.length}</strong><span>vendeurs contactés</span></article>
        <article><strong>{evaluation.length}</strong><span>mes évaluations</span></article>
      </section>

      {role === "agriculteur" && (
        <section className="card">
          <h2>Mes annonces</h2>
          {annonces.length === 0 ? (
            <p>Vous n'avez encore publié aucune annonce.</p>
          ) : (
            <div className="grid">
              {annonces.map((annonce) => {
                const dateExpiration = new Date(annonce.expires_at).getTime();
                const expiree = maintenant !== null && dateExpiration <= maintenant;
                const disponible = annonce.statut === "disponible" && !expiree;
                const statut = annonce.statut === "vendu" ? "Vendue" : expiree ? "Expirée" : "Disponible";
                const statutClasse = annonce.statut === "vendu" ? "vendu" : expiree ? "expiree" : "disponible";
                return (
                  <article className="card" key={annonce.id}>
                    <h3>{annonce.produit}</h3>
                    <p>{annonce.quantite_kg} kg à {annonce.prix_kg} FCFA/kg</p>
                    <p>📍 {annonce.region}</p>
                    <p className={`annonce-statut annonce-statut--${statutClasse}`}>
                      {statut}
                    </p>
                    <p className="annonce-expiration">
                      {disponible ? "Expire le" : "Date d'expiration"}{" "}
                      {new Date(annonce.expires_at).toLocaleDateString("fr-FR")}
                    </p>
                    <button
                      type="button"
                      onClick={() => modifierDisponibiliteAnnonce(annonce, !disponible)}
                      disabled={annonceEnCours === annonce.id}
                    >
                      {annonceEnCours === annonce.id
                        ? "Mise à jour..."
                        : disponible
                          ? "Marquer comme vendu"
                          : "Remettre en vente 30 jours"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {role === "acheteur" && (
        <section className="card">
          <h2>Mes évaluations</h2>
          {evaluation.length === 0 ? (
            <p>Vous n'avez encore évalué aucun vendeur.</p>
          ) : evaluation.map((avis) => (
            <article className="review-history" key={avis.seller_id}>
              <strong>{avis.note}/5 étoiles</strong>
              {avis.commentaire && <p>{avis.commentaire}</p>}
            </article>
          ))}
        </section>
      )}

      {contacts.length > 0 && (
        <section className="card">
          <h2>Mes contacts récents</h2>
          {contacts.map((contact) => (
            <p key={contact.id || contact.telephone}>{contact.produit} — {contact.region}</p>
          ))}
        </section>
      )}

      <section className="card">
        <h2>Alertes de prix</h2>
        <p>Définissez un produit, une région et éventuellement un prix maximum.</p>
        <div className="price-alert-form">
          <input
            placeholder="Produit"
            value={produitAlerte}
            onChange={(event) => setProduitAlerte(event.target.value)}
          />
          <input
            placeholder="Région"
            value={regionAlerte}
            onChange={(event) => setRegionAlerte(event.target.value)}
          />
          <input
            type="number"
            min="1"
            placeholder="Prix maximum (FCFA/kg)"
            value={prixAlerte}
            onChange={(event) => setPrixAlerte(event.target.value)}
          />
          <button type="button" onClick={creerAlerte}>Créer l'alerte</button>
        </div>
        {alertes.length === 0 ? (
          <p>Aucune alerte configurée.</p>
        ) : alertes.map((alerte) => (
          <article className="price-alert" key={alerte.id}>
            <div>
              <strong>{alerte.produit} — {alerte.region}</strong>
              {alerte.prix_maximum && <p>Seuil : {alerte.prix_maximum} FCFA/kg</p>}
            </div>
            <button type="button" onClick={() => supprimerAlerte(alerte.id)}>Supprimer</button>
          </article>
        ))}
      </section>
    </div>
  );
}
