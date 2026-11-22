const urlDonnees =
  "https://data.humdata.org/dataset/77b76bc7-1edd-43f6-a5e4-784498ff6aca/resource/04ffc070-6d05-4653-a9f6-9f3f893a229e/download/wfp_food_prices_sen.csv";
const dureeCacheMs = 6 * 60 * 60 * 1000;
const correspondanceRegions = {
  Thies: "Thiès",
  Kedougou: "Kédougou",
  Sedhiou: "Sédhiou",
};
const correspondanceProduits = {
  "Bananas (local)": "Bananes locales",
  "Beans (niebe)": "Niébé",
  Cabbage: "Chou",
  Carrots: "Carottes",
  Cassava: "Manioc",
  Fonio: "Fonio",
  "Groundnuts (shelled)": "Arachide décortiquée",
  "Groundnuts (unshelled)": "Arachide non décortiquée",
  "Maize (imported)": "Maïs importé",
  "Maize (local)": "Maïs local",
  "Mangoes (local)": "Mangues locales",
  Millet: "Mil",
  "Onions (dry)": "Oignon sec",
  "Onions (imported)": "Oignon importé",
  Oranges: "Oranges",
  "Oranges (imported)": "Oranges importées",
  Potatoes: "Pommes de terre",
  "Potatoes (imported)": "Pommes de terre importées",
  "Rice (imported)": "Riz importé",
  "Rice (local)": "Riz local",
  "Rice (ordinary, first quality)": "Riz ordinaire, première qualité",
  "Rice (ordinary, second quality)": "Riz ordinaire, deuxième qualité",
  Sorghum: "Sorgho",
  "Sorghum (imported)": "Sorgho importé",
  "Sweet potatoes": "Patates douces",
  Tomatoes: "Tomates",
  Watermelons: "Pastèques",
};

let cache;

const lireCsv = (texte) => {
  const lignes = [];
  let ligne = [];
  let champ = "";
  let entreGuillemets = false;

  for (let index = 0; index < texte.length; index += 1) {
    const caractere = texte[index];
    if (entreGuillemets) {
      if (caractere === '"' && texte[index + 1] === '"') {
        champ += '"';
        index += 1;
      } else if (caractere === '"') {
        entreGuillemets = false;
      } else {
        champ += caractere;
      }
    } else if (caractere === '"' && champ.length === 0) {
      entreGuillemets = true;
    } else if (caractere === ",") {
      ligne.push(champ);
      champ = "";
    } else if (caractere === "\n") {
      ligne.push(champ.replace(/\r$/, ""));
      if (ligne.length > 1 || ligne[0]) lignes.push(ligne);
      ligne = [];
      champ = "";
    } else {
      champ += caractere;
    }
  }

  if (champ.length > 0 || ligne.length > 0) {
    ligne.push(champ.replace(/\r$/, ""));
    if (ligne.length > 1 || ligne[0]) lignes.push(ligne);
  }
  return lignes;
};

export const extraireDerniersPrixWfp = (texteCsv) => {
  const lignes = lireCsv(texteCsv);
  const entetes = lignes.shift()?.map((entete) => entete.replace(/^\uFEFF/, ""));
  if (!entetes?.length) throw new Error("Le fichier de prix WFP est vide.");

  const index = Object.fromEntries(entetes.map((entete, position) => [entete, position]));
  const champsRequis = ["date", "admin1", "market", "commodity", "unit", "pricetype", "currency", "price"];
  if (champsRequis.some((champ) => index[champ] === undefined)) {
    throw new Error("Le format du fichier de prix WFP a changé.");
  }

  const dernierParMarche = new Map();
  for (const ligne of lignes) {
    const valeur = (champ) => ligne[index[champ]] ?? "";
    const date = valeur("date");
    const regionSource = valeur("admin1");
    const marche = valeur("market");
    const produitSource = valeur("commodity");
    const prix = Number(valeur("price"));

    if (
      valeur("currency") !== "XOF"
      || valeur("unit") !== "KG"
      || valeur("pricetype") !== "Retail"
      || produitSource.startsWith("Livestock")
      || !/^\d{4}-\d{2}-\d{2}$/.test(date)
      || !regionSource
      || !marche
      || !Number.isFinite(prix)
      || prix <= 0
    ) {
      continue;
    }

    const cle = `${regionSource}\u0000${marche}\u0000${produitSource}`;
    if (date <= (dernierParMarche.get(cle)?.date ?? "")) continue;

    dernierParMarche.set(cle, {
      date,
      region: correspondanceRegions[regionSource] ?? regionSource,
      marche,
      produit: correspondanceProduits[produitSource] ?? produitSource,
      prix_kg: prix,
      devise: "XOF",
      unite: "KG",
    });
  }

  const records = [...dernierParMarche.values()]
    .sort((a, b) => b.date.localeCompare(a.date));
  if (records.length === 0) {
    throw new Error("Le fichier WFP ne contient aucun prix exploitable en XOF/kg.");
  }

  return {
    records,
    latestDate: records[0].date,
  };
};

export const chargerPrixWfp = async () => {
  if (cache && Date.now() - cache.chargeLe < dureeCacheMs) {
    return cache.donnees;
  }

  const controleur = new AbortController();
  const temporisateur = setTimeout(() => controleur.abort(), 20000);
  try {
    const reponse = await fetch(urlDonnees, { signal: controleur.signal });
    if (!reponse.ok) {
      throw new Error(`La source WFP a répondu avec le statut ${reponse.status}.`);
    }
    const donnees = extraireDerniersPrixWfp(await reponse.text());
    cache = {
      chargeLe: Date.now(),
      donnees: {
        ...donnees,
        source: "WFP Food Prices for Senegal, diffusé par HDX",
        sourceUrl: "https://data.humdata.org/dataset/wfp-food-prices-for-senegal",
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
