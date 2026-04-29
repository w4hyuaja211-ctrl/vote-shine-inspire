INSERT INTO storage.buckets (id, name, public) VALUES ('candidate-photos', 'candidate-photos', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view candidate photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'candidate-photos');

CREATE POLICY "Admins can upload candidate photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'candidate-photos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update candidate photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'candidate-photos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete candidate photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'candidate-photos' AND public.has_role(auth.uid(), 'admin'));