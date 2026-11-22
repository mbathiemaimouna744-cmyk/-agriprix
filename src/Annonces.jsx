import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { normaliserNumeroSenegal } from "./telephone";

const bucketPhotos = "annonce-photos";
const tailleMaxPhoto = 5 * 1024 * 1024;
const extensionsPhoto = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
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
  const [regionFiltre, setRegionFiltre] = useState("");
  const [prixMaximum, setPrixMaximum] = useState("");
  const [tri, setTri] = useState("recent");
  const [f, setF] = useState(vide);
  const [prixMarche, setPrixMarche] = useState([]);
  const [erreurPrix, setErreurPrix] = useState("");
  const [photo, setPhoto] = useState(null);
  const photoInput = useRef(null);
  const [estimation, setEstimation] = useState("");
  const [erreurEstimation, setErreurEstimation] = useState("");
  const [estimationEnCours, setEstimationEnCours] = useState(false);
  const [evaluations, setEvaluations] = useState([]);
  const [evaluationOuverte, setEvaluationOuverte] = useState(null);
  const [noteEvaluation, setNoteEvaluation] = useState("5");
  const [commentaireEvaluation, setCommentaireEvaluation] = useState("");
  const [erreurEvaluation, setErreurEvaluation] = useState("");

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

  useEffect(() => {
    let actif = true;

    const chargerEvaluations = async () => {
      const { data, error } = await supabase
        .from("evaluations")
        .select("seller_id,buyer_id,note,commentaire,created_at,updated_at")
        .order("updated_at", { ascending: false });

      if (!actif) return;
      if (error) {
        console.error("Impossible de charger les évaluations:", error);
        setEvaluations([]);
        return;
      }
      setEvaluations(data || []);
    };

    chargerEvaluations();
    return () => {
      actif = false;
    };
  }, []);

  const publier = async () => {
    if (!user || role !== "agriculteur") {
      return alert("Seuls les agriculteurs connectés peuvent publier une annonce.");
    }

    let imagePath = null;
    if (photo) {
      const extension = extensionsPhoto[photo.type];
      imagePath = `${user.id}/${crypto.randomUUID()}.${extension}`;
      const { error: erreurUpload } = await supabase.storage
        .from(bucketPhotos)
        .upload(imagePath, photo, {
          cacheControl: "3600",
          contentType: photo.type,
          upsert: false,
        });

      if (erreurUpload) {
        console.error("Impossible de téléverser la photo:", erreurUpload);
        return alert(erreurUpload.message);
      }
    }

    const { error } = await supabase
      .from("annonces")
      .insert({ ...f, user_id: user.id, image_path: imagePath });
    if (error) {
      console.error("Impossible de publier l'annonce:", error);
      if (imagePath) {
        const { error: erreurNettoyage } = await supabase.storage
          .from(bucketPhotos)
          .remove([imagePath]);
        if (erreurNettoyage) {
          console.error("Impossible de supprimer la photo téléversée:", erreurNettoyage);
        }
      }
      return alert(error.message);
    }
    setF(vide);
    setPhoto(null);
    setEstimation("");
    setErreurEstimation("");
    if (photoInput.current) photoInput.current.value = "";
    charger();
  };
  const supprimer = async (annonce) => {
    const { error } = await supabase.from("annonces").delete().eq("id", annonce.id);
    if (error) {
      console.error("Impossible de supprimer l'annonce:", error);
      return alert(error.message);
    }

    let erreurPhoto = null;
    if (annonce.image_path) {
      const { error: erreurSuppression } = await supabase.storage
        .from(bucketPhotos)
        .remove([annonce.image_path]);
      if (erreurSuppression) {
        console.error("Impossible de supprimer la photo de l'annonce:", erreurSuppression);
        erreurPhoto = erreurSuppression;
      }
    }
    charger();
    if (erreurPhoto) {
      alert("L'annonce a été supprimée, mais sa photo n'a pas pu être supprimée.");
    }
  };

  const enregistrerContact = (annonce) => {
    if (!user) return;
    try {
      const stockage = JSON.parse(localStorage.getItem("agriprix_contacts") || "[]");
      const contact = {
        id: `${annonce.id}-${user.id}`,
        produit: annonce.produit,
        region: annonce.region,
        telephone: annonce.telephone,
      };
      localStorage.setItem(
        "agriprix_contacts",
        JSON.stringify([
          contact,
          ...stockage.filter((item) => item.id !== contact.id),
        ].slice(0, 20))
      );
    } catch (error) {
      console.error("Impossible d'enregistrer le contact récent:", error);
    }
  };

  const choisirPhoto = (event) => {
    const fichier = event.target.files?.[0];
    if (!fichier) {
      setPhoto(null);
      return;
    }
    if (!extensionsPhoto[fichier.type]) {
      event.target.value = "";
      setPhoto(null);
      return alert("Choisissez une image JPG, PNG ou WebP.");
    }
    if (fichier.size > tailleMaxPhoto) {
      event.target.value = "";
      setPhoto(null);
      return alert("La photo doit faire 5 Mo maximum.");
    }
    setPhoto(fichier);
  };

  const estimerPrix = async () => {
    const produit = f.produit.trim();
    const region = f.region.trim();
    if (!produit || !region) {
      setErreurEstimation("Saisissez le produit et la région pour demander une estimation.");
      return;
    }

    setEstimation("");
    setErreurEstimation("");
    setEstimationEnCours(true);
    const question = `Estime un prix de vente conseillé en FCFA/kg pour ${produit} dans la région de ${region}${f.quantite_kg ? `, pour ${f.quantite_kg} kg` : ""}. Donne une fourchette et un prix conseillé, en précisant si les données sont insuffisantes.`;

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.reponse || "Le service d'estimation est indisponible.");
      }
      if (typeof data.reponse !== "string" || !data.reponse.trim()) {
        throw new Error("L'assistant n'a pas fourni d'estimation.");
      }
      setEstimation(data.reponse.trim());
    } catch (error) {
      console.error("Impossible d'estimer le prix:", error);
      setErreurEstimation(
        error instanceof Error ? error.message : "Impossible d'obtenir une estimation."
      );
    } finally {
      setEstimationEnCours(false);
    }
  };

  const modifierChamp = (champ, valeur) => {
    setF((actuelle) => ({ ...actuelle, [champ]: valeur }));
    if (["produit", "region", "quantite_kg"].includes(champ)) {
      setEstimation("");
      setErreurEstimation("");
    }
  };

  const resumeEvaluation = (sellerId) => {
    const avis = evaluations.filter((evaluation) => evaluation.seller_id === sellerId);
    if (avis.length === 0) return null;
    const moyenne = avis.reduce((total, evaluation) => total + Number(evaluation.note), 0) / avis.length;
    return { moyenne: moyenne.toFixed(1), nombre: avis.length };
  };

  const ouvrirEvaluation = (sellerId) => {
    if (!user || role !== "acheteur") {
      return alert("Seuls les acheteurs connectés peuvent évaluer un vendeur.");
    }
    const avis = evaluations.find(
      (evaluation) => evaluation.seller_id === sellerId && evaluation.buyer_id === user.id
    );
    setEvaluationOuverte(sellerId);
    setNoteEvaluation(String(avis?.note ?? "5"));
    setCommentaireEvaluation(avis?.commentaire ?? "");
    setErreurEvaluation("");
  };

  const enregistrerEvaluation = async (sellerId) => {
    if (!user || role !== "acheteur") {
      setErreurEvaluation("Seuls les acheteurs connectés peuvent évaluer un vendeur.");
      return;
    }

    setErreurEvaluation("");
    const evaluation = {
      seller_id: sellerId,
      buyer_id: user.id,
      note: Number(noteEvaluation),
      commentaire: commentaireEvaluation.trim(),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("evaluations")
      .upsert(evaluation, { onConflict: "seller_id,buyer_id" });

    if (error) {
      console.error("Impossible d'enregistrer l'évaluation:", error);
      setErreurEvaluation(error.message);
      return;
    }

    setEvaluationOuverte(null);
    const { data } = await supabase
      .from("evaluations")
      .select("seller_id,buyer_id,note,commentaire,created_at,updated_at")
      .order("updated_at", { ascending: false });
    setEvaluations(data || []);
  };

  const supprimerEvaluation = async (sellerId) => {
    if (!user) return;
    const { error } = await supabase
      .from("evaluations")
      .delete()
      .eq("seller_id", sellerId)
      .eq("buyer_id", user.id);

    if (error) {
      console.error("Impossible de supprimer l'évaluation:", error);
      setErreurEvaluation(error.message);
      return;
    }

    setEvaluations((liste) => liste.filter(
      (evaluation) => !(evaluation.seller_id === sellerId && evaluation.buyer_id === user.id)
    ));
    setEvaluationOuverte(null);
  };

  const regions = [...new Set(liste.map((annonce) => annonce.region).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "fr"));
  const termeProduit = normaliser(filtre);
  const limitePrix = prixMaximum === "" ? Infinity : Number(prixMaximum);
  const visibles = liste
    .filter((annonce) => (
      normaliser(annonce.produit).includes(termeProduit) &&
      (!regionFiltre || annonce.region === regionFiltre) &&
      Number(annonce.prix_kg) <= limitePrix
    ))
    .sort((a, b) => {
      if (tri === "prix-croissant") return Number(a.prix_kg) - Number(b.prix_kg);
      if (tri === "prix-decroissant") return Number(b.prix_kg) - Number(a.prix_kg);
      return 0;
    });

  return (
    <div>
      {user && (
        role === "agriculteur" ? (
          <div className="card">
            <h2>Publier une annonce</h2>
            {Object.keys(vide).map((k) => (
              <input key={k} placeholder={libelles[k]} value={f[k]}
                onChange={(e) => modifierChamp(k, e.target.value)} />
            ))}
            <button
              type="button"
              onClick={estimerPrix}
              disabled={estimationEnCours}
            >
              {estimationEnCours ? "Estimation en cours..." : "Estimer mon prix"}
            </button>
            {erreurEstimation && <p role="alert">{erreurEstimation}</p>}
            {estimation && (
              <div className="price-suggestion" role="status">
                <strong>Conseil de l'IA</strong>
                <p>{estimation}</p>
                <small>Vérifiez la suggestion, puis saisissez le prix choisi dans le formulaire.</small>
              </div>
            )}
            <label htmlFor="annonce-photo">Photo du produit (JPG, PNG ou WebP, 5 Mo max.)</label>
            <input
              ref={photoInput}
              id="annonce-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={choisirPhoto}
            />
            <button onClick={publier}>Publier</button>
          </div>
        ) : role === "acheteur" ? (
          <div className="card">
            <h2>Espace acheteur</h2>
            <p>Recherchez des produits et contactez directement les agriculteurs.</p>
          </div>
        ) : null
      )}
      <div className="filters">
        <input
          className="search"
          placeholder="🔍 Rechercher un produit"
          aria-label="Rechercher un produit"
          value={filtre}
          onChange={(e) => setFiltre(e.target.value)}
        />
        <select
          aria-label="Filtrer par région"
          value={regionFiltre}
          onChange={(e) => setRegionFiltre(e.target.value)}
        >
          <option value="">Toutes les régions</option>
          {regions.map((region) => <option key={region} value={region}>{region}</option>)}
        </select>
        <input
          type="number"
          min="0"
          step="1"
          placeholder="Prix maximum (FCFA/kg)"
          aria-label="Prix maximum en FCFA par kilogramme"
          value={prixMaximum}
          onChange={(e) => setPrixMaximum(e.target.value)}
        />
        <select aria-label="Trier les annonces" value={tri} onChange={(e) => setTri(e.target.value)}>
          <option value="recent">Plus récentes</option>
          <option value="prix-croissant">Prix croissant</option>
          <option value="prix-decroissant">Prix décroissant</option>
        </select>
      </div>
      {erreurPrix && <p role="status">{erreurPrix}</p>}
      <div className="grid">
        {visibles.length === 0 ? (
          <p>Aucune annonce ne correspond à ces filtres.</p>
        ) : visibles.map((a) => {
          const badge = badgePrix(a, prixMarche);
          const resume = resumeEvaluation(a.user_id);
          const monAvis = evaluations.find(
            (evaluation) => evaluation.seller_id === a.user_id && evaluation.buyer_id === user?.id
          );
          return (
            <div className="card" key={a.id}>
              {a.image_path && (
                <img
                  className="annonce-photo"
                  src={supabase.storage.from(bucketPhotos).getPublicUrl(a.image_path).data.publicUrl}
                  alt={`Photo du produit ${a.produit}`}
                  loading="lazy"
                />
              )}
              <h3>{a.produit}</h3>
              <p>{a.quantite_kg} kg à {a.prix_kg} FCFA/kg</p>
              {badge && (
                <p className={`price-badge ${badge.classe}`}>
                  {badge.label} · référence : {badge.reference} FCFA/kg
                </p>
              )}
              <p>📍 {a.region}</p>
              {resume ? (
                <p className="seller-rating" aria-label={`Note moyenne ${resume.moyenne} sur 5`}>
                  ⭐ {resume.moyenne}/5 · {resume.nombre} avis
                </p>
              ) : (
                <p className="seller-rating">Aucune évaluation</p>
              )}
              {a.telephone && (
                <p className="seller-phone">
                  Téléphone :{" "}
                  <a href={`tel:+${normaliserNumeroSenegal(a.telephone)}`}>
                    +{normaliserNumeroSenegal(a.telephone)}
                  </a>
                </p>
              )}
              <a
                href={`sms:+${normaliserNumeroSenegal(a.telephone)}`}
                onClick={() => enregistrerContact(a)}
              >
                ✉️ Envoyer un SMS
              </a>
              {role === "acheteur" && (
                <button type="button" onClick={() => ouvrirEvaluation(a.user_id)}>
                  {monAvis ? "Modifier mon avis" : "Évaluer le vendeur"}
                </button>
              )}
              {evaluationOuverte === a.user_id && (
                <div className="seller-review">
                  <label htmlFor={`note-${a.id}`}>Note sur 5</label>
                  <select
                    id={`note-${a.id}`}
                    value={noteEvaluation}
                    onChange={(event) => setNoteEvaluation(event.target.value)}
                  >
                    {[1, 2, 3, 4, 5].map((note) => (
                      <option key={note} value={note}>{note} étoile{note > 1 ? "s" : ""}</option>
                    ))}
                  </select>
                  <label htmlFor={`commentaire-${a.id}`}>Commentaire</label>
                  <textarea
                    id={`commentaire-${a.id}`}
                    maxLength={300}
                    value={commentaireEvaluation}
                    onChange={(event) => setCommentaireEvaluation(event.target.value)}
                    placeholder="Votre expérience avec ce vendeur"
                  />
                  {erreurEvaluation && <p role="alert">{erreurEvaluation}</p>}
                  <button type="button" onClick={() => enregistrerEvaluation(a.user_id)}>
                    Publier mon avis
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => setEvaluationOuverte(null)}
                  >
                    Annuler
                  </button>
                  {monAvis && (
                    <button
                      type="button"
                      className="button-danger"
                      onClick={() => supprimerEvaluation(a.user_id)}
                    >
                      Supprimer mon avis
                    </button>
                  )}
                </div>
              )}
              {role === "agriculteur" && user?.id === a.user_id && (
                <button onClick={() => supprimer(a)}>Supprimer</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}