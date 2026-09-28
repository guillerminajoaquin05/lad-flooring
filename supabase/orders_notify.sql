-- Marca de "ya avisamos a Lad Flooring de este pedido", para que el aviso por email salga una sola vez.
-- Correr una sola vez en el SQL Editor de Supabase.
alter table public.orders add column if not exists business_notified_at timestamptz;
