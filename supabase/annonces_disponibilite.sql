ALTER TABLE public.annonces
  ADD COLUMN IF NOT EXISTS statut text NOT NULL DEFAULT 'disponible',
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

UPDATE public.annonces
SET expires_at = COALESCE(created_at, now()) + INTERVAL '30 days'
WHERE expires_at IS NULL;

ALTER TABLE public.annonces
  ALTER COLUMN expires_at SET DEFAULT (now() + INTERVAL '30 days'),
  ALTER COLUMN expires_at SET NOT NULL;

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_current_user_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO anon, authenticated;

DROP POLICY IF EXISTS "annonces_read_public" ON public.annonces;
CREATE POLICY "annonces_read_public"
ON public.annonces
FOR SELECT
TO anon, authenticated
USING (
  (statut = 'disponible' AND expires_at > now())
  OR auth.uid() = user_id
  OR public.is_current_user_admin()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'annonces_statut_check'
      AND conrelid = 'public.annonces'::regclass
  ) THEN
    ALTER TABLE public.annonces
      ADD CONSTRAINT annonces_statut_check
      CHECK (statut IN ('disponible', 'vendu'));
  END IF;
END;
$$;

GRANT UPDATE ON TABLE public.annonces TO authenticated;

DROP POLICY IF EXISTS "annonces_update_own" ON public.annonces;
CREATE POLICY "annonces_update_own"
ON public.annonces
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'agriculteur'
  )
)
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'agriculteur'
  )
);
