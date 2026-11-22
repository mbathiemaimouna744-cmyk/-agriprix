const urlTableau = "https://microdata.worldbank.org/api/tables/data/fcv/wld_2021_rtfp_v02_m";
const dureeCacheMs = 6 * 60 * 60 * 1000;
const champs = [
  "ISO3",
  "adm1_name",
  "mkt_name",
  "price_date",
  "currency",
  "maize",
  "millet",
  "rice",
  "sorghum",
];
const produits = [
  { code: "maize", nom: "Maïs" },
  { code: "millet", nom: "Mil" },
  { code: "rice", nom: "Riz" },
  { code: "sorghum", nom: "Sorgho" },
];

let cache;

export const extraireHistoriqueBanqueMondiale = (lignes) => {
  if (!Array.isArray(lignes)) {
    throw new Error("Le format des données de la Banque mondiale est invalide.");
  }

  const records = [];
  for (const ligne of lignes) {
    if (
      ligne.ISO3 !== "SEN"
      || ligne.mkt_name !== "Market Average"
      || ligne.currency !== "XOF"
      || !/^\d{4}-\d{2}-\d{2}$/.test(ligne.price_date ?? "")
    ) {
      continue;
    }

    for (const produit of produits) {
      const prix = Number(ligne[produit.code]);
      if (!Number.isFinite(prix) || prix <= 0) continue;

      records.push({
        date: ligne.price_date,
        codeProduit: produit.code,
        produit: produit.nom,
        prix_kg: prix,
        marche: ligne.mkt_name,
        region: ligne.adm1_name,
        unite: "KG",
        devise: "XOF",
      });
    }
  }

  records.sort((a, b) => a.date.localeCompare(b.date) || a.codeProduit.localeCompare(b.codeProduit));
  if (records.length === 0) {
    throw new Error("Aucun prix historique exploitable n'a été trouvé pour le Sénégal.");
  }

  return {
    records,
    firstDate: records[0].date,
    latestDate: records[records.length - 1].date,
  };
};

export const chargerHistoriqueBanqueMondiale = async () => {
  if (cache && Date.now() - cache.chargeLe < dureeCacheMs) {
    return cache.donnees;
  }

  const controleur = new AbortController();
  const temporisateur = setTimeout(() => controleur.abort(), 20000);
  try {
    const url = new URL(urlTableau);
    url.searchParams.set("ISO3", "SEN");
    url.searchParams.set("mkt_name", "Market Average");
    url.searchParams.set("limit", "1000");
    url.searchParams.set("fields", champs.join(","));

    const reponse = await fetch(url, { signal: controleur.signal });
    if (!reponse.ok) {
      throw new Error(`La Banque mondiale a répondu avec le statut ${reponse.status}.`);
    }

    const resultat = await reponse.json();
    if (!Array.isArray(resultat.data) || resultat.found > resultat.data.length) {
      throw new Error("La réponse de la Banque mondiale est incomplète ou invalide.");
    }

    const donnees = extraireHistoriqueBanqueMondiale(resultat.data);
    cache = {
      chargeLe: Date.now(),
      donnees: {
        ...donnees,
        source: "Monthly food price estimates by product and market",
        sourceUrl: "https://microdata.worldbank.org/catalog/6173",
        fetchedAt: new Date().toISOString(),
        stale: false,
      },
    };
    return cache.donnees;
  } catch (error) {
    if (cache) {
      return { ...cache.donnees, stale: true };
    }
    throw error;
  } finally {
    clearTimeout(temporisateur);
  }
};
