CREATE POLICY "own docs files select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documentos-pacientes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "own docs files insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documentos-pacientes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "own docs files update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documentos-pacientes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "own docs files delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documentos-pacientes' AND auth.uid()::text = (storage.foldername(name))[1]);