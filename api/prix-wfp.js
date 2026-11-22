import { chargerPrixWfp } from "../lib/wfp.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ erreur: "Méthode non autorisée." });
  }

  res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
  try {
    const donnees = await chargerPrixWfp();
    return res.status(200).json(donnees);
  } catch (error) {
    console.error("Impossible de charger les prix WFP:", error);
    return res.status(502).json({
      erreur: "La source externe des prix est temporairement indisponible.",
    });
  }
}
