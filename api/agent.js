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

    const headers = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    };
    const [reponsePrix, reponseAnnonces] = await Promise.all([
      fetch(
        `${supabaseUrl}/rest/v1/prix_marche?select=produit,region,prix_kg,date&order=date.desc&limit=100`,
        { headers }
      ),
      fetch(
        `${supabaseUrl}/rest/v1/annonces?select=produit,region,quantite_kg,prix_kg,created_at&order=created_at.desc&limit=30`,
        { headers }
      ),
    ]);

    if (!reponsePrix.ok || !reponseAnnonces.ok) {
      const [detailsPrix, detailsAnnonces] = await Promise.all([
        reponsePrix.ok ? "" : reponsePrix.text(),
        reponseAnnonces.ok ? "" : reponseAnnonces.text(),
      ]);
      console.error("Erreur Supabase:", {
        prix: reponsePrix.ok ? null : { status: reponsePrix.status, details: detailsPrix },
        annonces: reponseAnnonces.ok
          ? null
          : { status: reponseAnnonces.status, details: detailsAnnonces },
      });
      return res.status(502).json({ reponse: "Impossible de charger les prix ou les annonces." });
    }

    const [prix, annonces] = await Promise.all([
      reponsePrix.json(),
      reponseAnnonces.json(),
    ]);

    const consignes = `Tu es AgriPrix, un assistant pour les agriculteurs du Sénégal.
Tu aides les agriculteurs et les acheteurs à utiliser les annonces et les prix du marché.
Réponds en français simple, court et concret, en 4 phrases maximum. N'utilise jamais de markdown : pas d'astérisques, pas de listes à puces, pas de gras. Prix en FCFA/kg.
Prix du marché : ${JSON.stringify(prix)}.
Annonces de vente publiées (30 plus récentes, sans coordonnées personnelles) : ${JSON.stringify(annonces)}.
Les annonces sont des offres de vente, pas des demandes d'achat. Ne prétends pas qu'un acheteur est disponible. Ne confirme pas qu'un produit est encore disponible; indique seulement ce que l'annonce publiée mentionne. N'invente aucune annonce ni aucun prix. Si aucune annonce ne correspond, dis-le clairement.
Question de l'utilisateur : ${question}`;

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