import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export default function Accueil({ allerVers }) {
  const [statistiques, setStatistiques] = useState({
    annonces: null,
    prix: null,
  });

  useEffect(() => {
    let actif = true;

    const chargerStatistiques = async () => {
      const [annonces, prix] = await Promise.all([
        supabase.from("annonces").select("*", { count: "exact", head: true }),
        supabase.from("prix_marche").select("*", { count: "exact", head: true }),
      ]);
      if (actif) {
        setStatistiques({
          annonces: annonces.error ? null : annonces.count,
          prix: prix.error ? null : prix.count,
        });
      }
    };

    chargerStatistiques();
    return () => {
      actif = false;
    };
  }, []);

  return (
    <div>
      <section className="hero">
        <div>
          <p className="hero__eyebrow">Le juste prix, partout au Sénégal</p>
          <h2>Vendez mieux. Achetez avec plus de confiance.</h2>
          <p>
            AgriPrix met les agriculteurs en relation avec les acheteurs grâce aux
            prix du marché, aux annonces locales et à un assistant agricole.
          </p>
          <div className="hero__actions">
            <button type="button" onClick={() => allerVers("annonces")}>
              Voir les annonces
            </button>
            <button type="button" className="button-secondary" onClick={() => allerVers("prix")}>
              Consulter les prix
            </button>
          </div>
        </div>
      </section>

      <section className="stats" aria-label="Chiffres clés">
        <article>
          <strong>{statistiques.annonces ?? "—"}</strong>
          <span>annonces publiées</span>
        </article>
        <article>
          <strong>{statistiques.prix ?? "—"}</strong>
          <span>prix du marché</span>
        </article>
        <article>
          <strong>1</strong>
          <span>assistant agricole IA</span>
        </article>
      </section>

      <section className="features">
        <article className="feature-card">
          <h3>Le problème</h3>
          <p>
            Les producteurs ne connaissent pas toujours le prix juste et peuvent
            vendre trop cher ou trop tôt sans être informés.
          </p>
        </article>
        <article className="feature-card">
          <h3>Notre solution</h3>
          <p>
            AgriPrix compare les offres aux prix du marché et aide chaque
            utilisateur à prendre une décision simple.
          </p>
        </article>
        <article className="feature-card">
          <h3>Pourquoi faire confiance</h3>
          <p>
            Les annonces, photos, régions, prix comparés et recommandations IA
            rendent les échanges plus transparents.
          </p>
        </article>
      </section>
    </div>
  );
}
