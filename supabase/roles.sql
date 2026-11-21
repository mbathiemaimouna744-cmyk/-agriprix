CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('agriculteur', 'acheteur')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

INSERT INTO public.profiles (user_id, role)
SELECT id, 'agriculteur'
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.create_profile_for_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, role)
  VALUES (
    NEW.id,
    CASE
      WHEN NEW.raw_user_meta_data ->> 'role' = 'acheteur' THEN 'acheteur'
      ELSE 'agriculteur'
    END
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_create_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_create_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_profile_for_new_user();

GRANT SELECT ON TABLE public.annonces TO anon, authenticated;
GRANT INSERT, DELETE ON TABLE public.annonces TO authenticated;
ALTER TABLE public.annonces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "annonces_read_public" ON public.annonces;
CREATE POLICY "annonces_read_public"
ON public.annonces
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "annonces_insert_own" ON public.annonces;
CREATE POLICY "annonces_insert_own"
ON public.annonces
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'agriculteur'
  )
);

DROP POLICY IF EXISTS "annonces_delete_own" ON public.annonces;
CREATE POLICY "annonces_delete_own"
ON public.annonces
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'agriculteur'
  )
);
