CREATE TABLE IF NOT EXISTS public.whatsapp_links (
  id                uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number      text        NOT NULL UNIQUE,
  verified          boolean     NOT NULL DEFAULT false,
  verification_code text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_whatsapp_link"
  ON public.whatsapp_links
  FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS whatsapp_links_user_id_idx ON public.whatsapp_links (user_id);
CREATE INDEX IF NOT EXISTS whatsapp_links_code_idx    ON public.whatsapp_links (verification_code) WHERE verification_code IS NOT NULL;
