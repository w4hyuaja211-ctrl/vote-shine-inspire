-- Settings table (singleton)
CREATE TABLE public.voting_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  starts_at timestamptz,
  ends_at timestamptz,
  results_public boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.voting_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view voting settings"
ON public.voting_settings FOR SELECT
USING (true);

CREATE POLICY "Admins manage voting settings"
ON public.voting_settings FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Seed one row
INSERT INTO public.voting_settings (starts_at, ends_at, results_public)
VALUES (NULL, NULL, true);

-- Public results function (aggregated, no voter identity)
CREATE OR REPLACE FUNCTION public.public_results()
RETURNS TABLE(
  category_id uuid,
  category_name text,
  category_order int,
  candidate_id uuid,
  candidate_name text,
  role_type text,
  photo_url text,
  votes bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cat.id,
    cat.name,
    cat.display_order,
    cand.id,
    cand.name,
    cand.role_type,
    cand.photo_url,
    COUNT(v.id) AS votes
  FROM public.categories cat
  CROSS JOIN public.candidates cand
  LEFT JOIN public.votes v
    ON v.category_id = cat.id AND v.candidate_id = cand.id
  GROUP BY cat.id, cat.name, cat.display_order, cand.id, cand.name, cand.role_type, cand.photo_url
$$;

GRANT EXECUTE ON FUNCTION public.public_results() TO anon, authenticated;