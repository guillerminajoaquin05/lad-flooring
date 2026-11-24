-- Mantener activo el proyecto gratuito de Supabase (se pausa tras 7 días sin actividad).
-- Leer datos no alcanzó para evitar la pausa, así que la tarea de GitHub (.github/workflows/supabase-keepalive.yml)
-- ahora también ESCRIBE: llama a lad_keepalive() todos los días, que actualiza una fila con la hora.
-- Correr una sola vez en el SQL Editor de Supabase.

create table if not exists public.keepalive (
  id int primary key default 1 check (id = 1),  -- una sola fila
  pinged_at timestamptz not null default now(),
  pings bigint not null default 0
);

alter table public.keepalive enable row level security;
-- Nadie la lee ni la escribe directamente; solo a través de la función de abajo.

create or replace function public.lad_keepalive()
returns timestamptz
language sql
security definer
set search_path = public
as $$
  insert into public.keepalive (id, pinged_at, pings) values (1, now(), 1)
  on conflict (id) do update set pinged_at = now(), pings = public.keepalive.pings + 1
  returning pinged_at;
$$;

revoke all on function public.lad_keepalive() from public;
grant execute on function public.lad_keepalive() to anon, authenticated, service_role;
