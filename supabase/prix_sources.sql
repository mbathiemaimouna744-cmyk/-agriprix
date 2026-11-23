ALTER TABLE public.prix_marche
  ADD COLUMN IF NOT EXISTS type_prix text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS prix_min_kg numeric,
  ADD COLUMN IF NOT EXISTS prix_max_kg numeric,
  ADD COLUMN IF NOT EXISTS date_precision text;

ALTER TABLE public.prix_marche
  DROP CONSTRAINT IF EXISTS prix_marche_type_prix_check,
  DROP CONSTRAINT IF EXISTS prix_marche_fourchette_check,
  DROP CONSTRAINT IF EXISTS prix_marche_date_precision_check,
  ADD CONSTRAINT prix_marche_type_prix_check
    CHECK (type_prix IS NULL OR type_prix IN ('producteur', 'gros', 'detail', 'prix_fixe')),
  ADD CONSTRAINT prix_marche_fourchette_check
    CHECK (
      (prix_min_kg IS NULL AND prix_max_kg IS NULL)
      OR (
        prix_min_kg IS NOT NULL
        AND prix_max_kg IS NOT NULL
        AND prix_min_kg > 0
        AND prix_max_kg >= prix_min_kg
      )
    ),
  ADD CONSTRAINT prix_marche_date_precision_check
    CHECK (date_precision IS NULL OR date_precision IN ('jour', 'mois'));

COMMENT ON COLUMN public.prix_marche.type_prix IS
  'Type de prix : producteur, gros, detail ou prix_fixe. NULL signifie que le type reste à vérifier.';

COMMENT ON COLUMN public.prix_marche.source IS
  'Source bibliographique ou organisme ayant publié le prix.';

COMMENT ON COLUMN public.prix_marche.source_url IS
  'Lien vers la source du prix, si disponible.';

COMMENT ON COLUMN public.prix_marche.prix_kg IS
  'Prix exact, ou valeur centrale calculée si prix_min_kg et prix_max_kg sont renseignés.';

COMMENT ON COLUMN public.prix_marche.date_precision IS
  'Précision de la date : jour ou mois. NULL conserve les données historiques à vérifier.';
