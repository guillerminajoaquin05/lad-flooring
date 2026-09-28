-- Marca de "ya le avisamos al cliente que su pago fue aprobado", para que ese email salga una sola vez.
-- Correr una sola vez en el SQL Editor de Supabase.
alter table public.orders add column if not exists payment_email_sent_at timestamptz;
