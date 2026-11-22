import { chargerHistoriqueBanqueMondiale } from "../lib/banque-mondiale.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ erreur: "Méthode non autorisée." });
  }

  res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
  try {
    const donnees = await chargerHistoriqueBanqueMondiale();
    return res.status(200).json(donnees);
  } catch (error) {
    console.error("Impossible de charger l'historique de la Banque mondiale:", error);
    return res.status(502).json({
      erreur: "L'historique des prix de la Banque mondiale est temporairement indisponible.",
    });
  }
}
