ALTER TABLE public.annonces
ADD COLUMN IF NOT EXISTS image_path text;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'annonce-photos',
  'annonce-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "annonce_photos_read_public" ON storage.objects;
CREATE POLICY "annonce_photos_read_public"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'annonce-photos');

DROP POLICY IF EXISTS "annonce_photos_insert_farmer" ON storage.objects;
CREATE POLICY "annonce_photos_insert_farmer"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'annonce-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'agriculteur'
  )
);

DROP POLICY IF EXISTS "annonce_photos_delete_farmer" ON storage.objects;
CREATE POLICY "annonce_photos_delete_farmer"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'annonce-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'agriculteur'
  )
);
