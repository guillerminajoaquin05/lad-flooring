-- Datos del despacho (empresa y número de seguimiento) y marca de "ya le avisamos al cliente que salió".
-- Correr una sola vez en el SQL Editor de Supabase.
alter table public.orders add column if not exists shipping_carrier text;
alter table public.orders add column if not exists tracking_number text;
alter table public.orders add column if not exists shipped_email_sent_at timestamptz;
