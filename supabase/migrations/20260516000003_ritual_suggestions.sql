-- Module 33: Ritual suggestions table
CREATE TABLE IF NOT EXISTS public.ritual_suggestions (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  person_id       uuid        REFERENCES public.people(id) ON DELETE CASCADE,
  type            text        NOT NULL,
  message         text        NOT NULL,
  action_suggestion text,
  priority        integer     NOT NULL DEFAULT 5,
  read_at         timestamptz,
  dismissed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ritual_suggestions_user_id_idx ON public.ritual_suggestions(user_id);
CREATE INDEX IF NOT EXISTS ritual_suggestions_active_idx ON public.ritual_suggestions(user_id, dismissed_at, created_at DESC);

ALTER TABLE public.ritual_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own ritual suggestions"
  ON public.ritual_suggestions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
