-- Configuración del sitio editable desde el panel de admin (por ahora: datos para transferencia bancaria).
-- Correr una sola vez en el SQL Editor de Supabase. Usa public.lad_is_admin() de projects.sql.

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

-- Los datos para transferir se muestran a los compradores, así que se pueden leer desde la web;
-- solo el admin los edita. La función de emails los lee con service_role.
grant select on public.site_settings to anon, authenticated, service_role;
grant insert, update, delete on public.site_settings to authenticated;

drop policy if exists "site_settings: public read" on public.site_settings;
create policy "site_settings: public read" on public.site_settings
  for select using (true);

drop policy if exists "site_settings: admin write" on public.site_settings;
create policy "site_settings: admin write" on public.site_settings
  for all using (public.lad_is_admin()) with check (public.lad_is_admin());

insert into public.site_settings (key, value) values ('transferencia', '{}'::jsonb)
on conflict (key) do nothing;
