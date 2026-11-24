export const TYPES_PRIX = [
  { valeur: "producteur", libelle: "Producteur" },
  { valeur: "gros", libelle: "Gros" },
  { valeur: "detail", libelle: "Détail" },
  { valeur: "prix_fixe", libelle: "Prix fixé par l’État" },
];

export const libelleTypePrix = (typePrix) =>
  TYPES_PRIX.find((type) => type.valeur === typePrix)?.libelle || "À préciser";

export const valeurPrixAffichee = (prix) => {
  const aFourchette =
    prix.prix_min_kg !== null
    && prix.prix_min_kg !== undefined
    && prix.prix_max_kg !== null
    && prix.prix_max_kg !== undefined;
  const minimum = Number(prix.prix_min_kg);
  const maximum = Number(prix.prix_max_kg);
  if (aFourchette && Number.isFinite(minimum) && Number.isFinite(maximum)) {
    return `${minimum}–${maximum}`;
  }
  return String(prix.prix_kg ?? "À préciser");
};

export const datePrixAffichee = (prix) => {
  if (!prix.date) return "Date à préciser";
  const date = new Date(`${prix.date}T00:00:00`);
  if (Number.isNaN(date.getTime())) return prix.date;
  if (prix.date_precision === "mois") {
    return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  }
  return date.toLocaleDateString("fr-FR");
};
