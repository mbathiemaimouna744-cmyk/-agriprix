WITH prix_a_ajouter (
  produit,
  region,
  prix_kg,
  prix_min_kg,
  prix_max_kg,
  date,
  date_precision,
  type_prix,
  source,
  source_url
) AS (
  VALUES
    (
      'Oignon local',
      'Sédhiou',
      325,
      300,
      350,
      DATE '2026-05-24',
      'jour',
      'detail',
      'APS, prix rapportés au marché central de Sédhiou le 24 mai 2026',
      'https://aps.sn/sedhiou-loignon-local-surpasse-loignon-importe-au-marche-central-responsable/'
    ),
    (
      'Pomme de terre',
      'Sédhiou',
      425,
      400,
      450,
      DATE '2026-05-24',
      'jour',
      'detail',
      'APS, prix rapportés au marché central de Sédhiou le 24 mai 2026',
      'https://aps.sn/sedhiou-loignon-local-surpasse-loignon-importe-au-marche-central-responsable/'
    ),
    (
      'Oignon local',
      'Dakar',
      674,
      NULL,
      NULL,
      DATE '2026-09-01',
      'mois',
      'detail',
      'Note ANSD de septembre 2026, rapportée par Dakaractu le 8 novembre 2026',
      'https://www.dakaractu.com/Produits-essentiels-sur-les-marches-A-Dakar-le-kilo-d-oignon-local-passe-de-520-a-674-FCFA_a277955.html'
    ),
    (
      'Oignon local',
      'Thiès',
      633,
      NULL,
      NULL,
      DATE '2026-09-01',
      'mois',
      'detail',
      'Note ANSD de septembre 2026, rapportée par Dakaractu le 8 novembre 2026',
      'https://www.dakaractu.com/Produits-essentiels-sur-les-marches-A-Dakar-le-kilo-d-oignon-local-passe-de-520-a-674-FCFA_a277955.html'
    ),
    (
      'Oignon local',
      'Diourbel',
      691,
      NULL,
      NULL,
      DATE '2026-09-01',
      'mois',
      'detail',
      'Note ANSD de septembre 2026, rapportée par Dakaractu le 8 novembre 2026',
      'https://www.dakaractu.com/Produits-essentiels-sur-les-marches-A-Dakar-le-kilo-d-oignon-local-passe-de-520-a-674-FCFA_a277955.html'
    ),
    (
      'Oignon local',
      'Saint-Louis',
      528,
      NULL,
      NULL,
      DATE '2026-09-01',
      'mois',
      'detail',
      'Note ANSD de septembre 2026, rapportée par Dakaractu le 8 novembre 2026',
      'https://www.dakaractu.com/Produits-essentiels-sur-les-marches-A-Dakar-le-kilo-d-oignon-local-passe-de-520-a-674-FCFA_a277955.html'
    ),
    (
      'Oignon local',
      'Kolda',
      724,
      NULL,
      NULL,
      DATE '2026-09-01',
      'mois',
      'detail',
      'Note ANSD de septembre 2026, rapportée par Dakaractu le 8 novembre 2026',
      'https://www.dakaractu.com/Produits-essentiels-sur-les-marches-A-Dakar-le-kilo-d-oignon-local-passe-de-520-a-674-FCFA_a277955.html'
    ),
    (
      'Arachide',
      'Sénégal',
      305,
      NULL,
      NULL,
      DATE '2026-10-22',
      'jour',
      'prix_fixe',
      'Prix plancher fixé par l’État pour la campagne arachidière 2026, rapporté par Leral/APS le 22 octobre 2026',
      'https://www.leral.net/Campagne-arachidiere-l-Etat-maintient-le-prix-du-kilogramme-a-305-FCFA_a410145.html'
    )
)
INSERT INTO public.prix_marche (
  produit,
  region,
  prix_kg,
  prix_min_kg,
  prix_max_kg,
  date,
  date_precision,
  type_prix,
  source,
  source_url
)
SELECT
  p.produit,
  p.region,
  p.prix_kg,
  p.prix_min_kg,
  p.prix_max_kg,
  p.date,
  p.date_precision,
  p.type_prix,
  p.source,
  p.source_url
FROM prix_a_ajouter p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.prix_marche existant
  WHERE existant.produit = p.produit
    AND existant.region = p.region
    AND existant.date = p.date
    AND existant.source_url = p.source_url
);
