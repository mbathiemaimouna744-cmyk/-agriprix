export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ reponse: "Méthode non autorisée." });
    }

    const question = typeof req.body?.question === "string"
      ? req.body.question.trim()
      : "";

    if (!question) {
      return res.status(400).json({ reponse: "Veuillez saisir une question." });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error("Configuration Supabase manquante.");
      return res.status(500).json({ reponse: "Configuration du serveur incomplète." });
    }

    if (!geminiKey || geminiKey === "colle_ici_ta_cle_gemini") {
      console.error("Configuration Gemini manquante.");
      return res.status(500).json({ reponse: "Configuration de l'assistant indisponible." });
    }

    const r = await fetch(
      `${supabaseUrl}/rest/v1/prix_marche?select=produit,region,prix_kg,date`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );

    if (!r.ok) {
      const details = await r.text();
      console.error("Erreur Supabase:", r.status, details);
      return res.status(502).json({ reponse: "Impossible de charger les prix du marché." });
    }

    const prix = await r.json();

    const consignes = `Tu es AgriPrix, un assistant pour les agriculteurs du Sénégal.
Tu aides à fixer un juste prix de vente et à trouver des acheteurs.
Réponds en français simple, court et concret, en 4 phrases maximum. N'utilise jamais de markdown : pas d'astérisques, pas de listes à puces, pas de gras. Prix en FCFA/kg.
Base-toi sur ces prix du marché : ${JSON.stringify(prix)}.
Si le produit n'est pas dans les données, dis-le et donne une estimation prudente.
Question de l'agriculteur : ${question}`;

    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const g = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: consignes }] }] }),
      }
    );
    const data = await g.json();

    if (!g.ok) {
      console.error("Erreur Gemini:", g.status, data);
      return res.status(502).json({ reponse: "Le service d'assistant est temporairement indisponible." });
    }

    const brut = data.candidates?.[0]?.content?.parts?.[0]?.text || "Pas de réponse.";
    const reponse = brut.replace(/\*/g, "").trim();
    return res.status(200).json({ reponse });
  } catch (error) {
    console.error("Erreur lors du traitement de la requête AgriPrix:", error);
    res.status(500).json({ reponse: "Erreur du serveur." });
  }
}