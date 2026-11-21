import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

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
                onChange={(e) => setF({ ...f, [k]: e.target.value })} />
            ))}
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
              <a href={`https://wa.me/221${a.telephone}`} target="_blank" rel="noreferrer">
                💬 Contacter sur WhatsApp
              </a>
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