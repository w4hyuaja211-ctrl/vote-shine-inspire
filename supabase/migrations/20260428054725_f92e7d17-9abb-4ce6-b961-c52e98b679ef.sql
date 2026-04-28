
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users see own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Categories
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admins manage categories" ON public.categories FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Candidates
CREATE TABLE public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role_type TEXT NOT NULL DEFAULT 'guru', -- guru | karyawan
  photo_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view candidates" ON public.candidates FOR SELECT USING (true);
CREATE POLICY "Admins manage candidates" ON public.candidates FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Candidate-Category eligibility (which candidates can be voted in which category)
CREATE TABLE public.candidate_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  UNIQUE(candidate_id, category_id)
);

ALTER TABLE public.candidate_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view candidate_categories" ON public.candidate_categories FOR SELECT USING (true);
CREATE POLICY "Admins manage candidate_categories" ON public.candidate_categories FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Vote tokens
CREATE TABLE public.vote_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  label TEXT,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vote_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage tokens" ON public.vote_tokens FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Votes
CREATE TABLE public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID NOT NULL REFERENCES public.vote_tokens(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(token_id, category_id)
);

ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view votes" ON public.votes FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
-- No public insert/update; submission goes through secure RPC

-- Validate token (public)
CREATE OR REPLACE FUNCTION public.validate_token(_code TEXT)
RETURNS TABLE(token_id UUID, used BOOLEAN, label TEXT)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, used, label FROM public.vote_tokens WHERE code = _code LIMIT 1;
$$;

-- Submit votes atomically (public)
CREATE OR REPLACE FUNCTION public.submit_votes(_code TEXT, _votes JSONB)
RETURNS JSONB
LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_token_id UUID;
  v_used BOOLEAN;
  v_count INT;
  v_categories INT;
  v_item JSONB;
BEGIN
  SELECT id, used INTO v_token_id, v_used FROM public.vote_tokens WHERE code = _code FOR UPDATE;
  IF v_token_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kode tidak valid');
  END IF;
  IF v_used THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kode sudah digunakan');
  END IF;

  SELECT COUNT(*) INTO v_categories FROM public.categories;
  SELECT jsonb_array_length(_votes) INTO v_count;
  IF v_count <> v_categories THEN
    RETURN jsonb_build_object('success', false, 'error', 'Anda harus memilih untuk semua kategori');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_votes) LOOP
    INSERT INTO public.votes (token_id, category_id, candidate_id)
    VALUES (v_token_id, (v_item->>'category_id')::UUID, (v_item->>'candidate_id')::UUID);
  END LOOP;

  UPDATE public.vote_tokens SET used = TRUE, used_at = now() WHERE id = v_token_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Seed categories
INSERT INTO public.categories (slug, name, description, display_order) VALUES
('inspiratif', 'Ter-Inspiratif', 'Mampu memberi motivasi dan semangat keteladanan.', 1),
('sabar', 'Ter-Sabar', 'Tetap tenang dan sabar dalam menghadapi berbagai karakter siswa.', 2),
('ramah', 'Ter-Ramah', 'Humble, murah senyum, dan menciptakan suasana nyaman.', 3),
('inovatif', 'Ter-Inovatif', 'Sering menciptakan ide baru di sekolah.', 4),
('fashionable', 'Ter-Fashionable', 'Memiliki gaya mengajar dan penampilan yang menarik, rapi, modis.', 5),
('favorit', 'Ter-Favorit', 'Paling banyak disukai oleh siswa karena kepribadian dan sikapnya.', 6),
('humoris', 'Ter-Humoris', 'Punya selera humor yang membuat suasana lebih menyenangkan.', 7),
('disiplin', 'Ter-Disiplin', 'Konsisten dalam mematuhi peraturan dan tanggung jawab profesional.', 8),
('islami', 'Ter-Islami', 'Mencerminkan nilai-nilai ajaran Islam dalam setiap aspek kehidupan.', 9),
('tegas', 'Ter-Tegas', 'Mampu menegakkan aturan dan disiplin dengan konsisten tanpa menakutkan.', 10);
