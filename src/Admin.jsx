import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import {
  datePrixAffichee,
  libelleTypePrix,
  TYPES_PRIX,
  valeurPrixAffichee,
} from "./prixUtils";

export default function Admin({ user, role }) {
  const [annonces, setAnnonces] = useState([]);
  const [prix, setPrix] = useState([]);
  const [produit, setProduit] = useState("");
  const [region, setRegion] = useState("");
  const [prixKg, setPrixKg] = useState("");
  const [prixMinKg, setPrixMinKg] = useState("");
  const [prixMaxKg, setPrixMaxKg] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [precisionDate, setPrecisionDate] = useState("jour");
  const [typePrix, setTypePrix] = useState("detail");
  const [sourcePrix, setSourcePrix] = useState("");
  const [urlSourcePrix, setUrlSourcePrix] = useState("");
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
    const avecFourchette = prixMinKg !== "" || prixMaxKg !== "";
    const minimum = prixMinKg === "" ? null : Number(prixMinKg);
    const maximum = prixMaxKg === "" ? null : Number(prixMaxKg);
    const prixUnique = prixKg === "" ? null : Number(prixKg);

    if (
      !produit.trim()
      || !region.trim()
      || !date
      || !typePrix
      || !sourcePrix.trim()
      || (!avecFourchette && (!Number.isFinite(prixUnique) || prixUnique <= 0))
    ) {
      setErreur("Complétez le produit, la région, le prix, la date, le type et la source.");
      return;
    }
    if (
      (avecFourchette && (minimum === null || maximum === null || minimum <= 0 || maximum < minimum))
      || (avecFourchette && prixUnique !== null)
    ) {
      setErreur("Saisissez soit un prix unique, soit deux bornes valides sans prix unique.");
      return;
    }
    if (urlSourcePrix.trim() && !/^https?:\/\//i.test(urlSourcePrix.trim())) {
      setErreur("Le lien de la source doit commencer par https:// ou http://.");
      return;
    }
    const { data, error } = await supabase
      .from("prix_marche")
      .insert({
        produit: produit.trim(),
        region: region.trim(),
        prix_kg: avecFourchette ? (minimum + maximum) / 2 : prixUnique,
        prix_min_kg: minimum,
        prix_max_kg: maximum,
        date: precisionDate === "mois" ? `${date.slice(0, 7)}-01` : date,
        date_precision: precisionDate,
        type_prix: typePrix,
        source: sourcePrix.trim(),
        source_url: urlSourcePrix.trim() || null,
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
    setPrixMinKg("");
    setPrixMaxKg("");
    setPrecisionDate("jour");
    setTypePrix("detail");
    setSourcePrix("");
    setUrlSourcePrix("");
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
          <input type="number" min="1" placeholder="Prix unique (FCFA/kg)" value={prixKg} onChange={(e) => setPrixKg(e.target.value)} />
          <input type="number" min="1" placeholder="Minimum (facultatif)" value={prixMinKg} onChange={(e) => setPrixMinKg(e.target.value)} />
          <input type="number" min="1" placeholder="Maximum (facultatif)" value={prixMaxKg} onChange={(e) => setPrixMaxKg(e.target.value)} />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <select aria-label="Précision de la date" value={precisionDate} onChange={(e) => setPrecisionDate(e.target.value)}>
            <option value="jour">Date exacte</option>
            <option value="mois">Mois seulement</option>
          </select>
          <select aria-label="Type de prix" value={typePrix} onChange={(e) => setTypePrix(e.target.value)}>
            {TYPES_PRIX.map((type) => (
              <option key={type.valeur} value={type.valeur}>{type.libelle}</option>
            ))}
          </select>
          <input
            placeholder="Source (ex. ANSD, bulletin de mai 2026)"
            value={sourcePrix}
            onChange={(e) => setSourcePrix(e.target.value)}
          />
          <input
            type="url"
            placeholder="Lien source (facultatif)"
            value={urlSourcePrix}
            onChange={(e) => setUrlSourcePrix(e.target.value)}
          />
          <button type="button" onClick={ajouterPrix}>Ajouter</button>
        </div>
        {prix.map((item) => (
          <article className="admin-price" key={item.id}>
            <span>
              {item.produit} — {item.region} — {valeurPrixAffichee(item)} FCFA/kg — {datePrixAffichee(item)}
              {" — "}{libelleTypePrix(item.type_prix)} — {item.source || "Source à renseigner"}
              {item.source_url && /^https?:\/\//i.test(item.source_url) && (
                <> · <a href={item.source_url} target="_blank" rel="noreferrer">ouvrir la source</a></>
              )}
            </span>
            <button type="button" className="button-danger" onClick={() => supprimerPrix(item.id)}>Supprimer</button>
          </article>
        ))}
      </section>
    </div>
  );
}
