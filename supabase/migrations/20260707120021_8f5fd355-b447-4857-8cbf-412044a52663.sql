
DROP POLICY IF EXISTS "avatars auth read" ON storage.objects;
CREATE POLICY "avatars auth read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars owner upload" ON storage.objects;
CREATE POLICY "avatars owner upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid())));

DROP POLICY IF EXISTS "avatars owner update" ON storage.objects;
CREATE POLICY "avatars owner update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid())));

DROP POLICY IF EXISTS "avatars owner delete" ON storage.objects;
CREATE POLICY "avatars owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid())));
