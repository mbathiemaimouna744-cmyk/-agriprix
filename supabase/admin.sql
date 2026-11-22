ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('agriculteur', 'acheteur', 'admin'));

DROP POLICY IF EXISTS "annonces_delete_admin" ON public.annonces;
CREATE POLICY "annonces_delete_admin"
ON public.annonces
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
  )
);

ALTER TABLE public.prix_marche ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public.prix_marche TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.prix_marche TO authenticated;

DROP POLICY IF EXISTS "prix_marche_read_public" ON public.prix_marche;
CREATE POLICY "prix_marche_read_public"
ON public.prix_marche
FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "prix_marche_insert_admin" ON public.prix_marche;
CREATE POLICY "prix_marche_insert_admin"
ON public.prix_marche
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "prix_marche_update_admin" ON public.prix_marche;
CREATE POLICY "prix_marche_update_admin"
ON public.prix_marche
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "prix_marche_delete_admin" ON public.prix_marche;
CREATE POLICY "prix_marche_delete_admin"
ON public.prix_marche
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
  )
);
