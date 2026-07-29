-- Etapa 1 · Completa captura de UTM (faltavam utm_content e utm_term)
-- Nullable, não quebra dado existente.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_term text;
