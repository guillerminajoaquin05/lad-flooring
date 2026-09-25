-- Pedidos de cotización (formulario "Cotizá Tu Proyecto"), visibles en el panel de admin.
-- Correr una sola vez en el SQL Editor de Supabase. Usa public.lad_is_admin() de projects.sql.

create table if not exists public.cotizaciones (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nombre text not null,
  apellido text not null,
  email text not null,
  telefono text not null,
  localidad text not null,
  provincia text not null,
  superficie numeric not null,
  etapa text not null,
  modulos text[] not null default '{}',
  comentarios text,
  files text[] not null default '{}',     -- rutas dentro del bucket privado "quote-files"
  status text not null default 'nuevo',   -- nuevo | contactado | cerrado
  notified_at timestamptz                 -- cuándo se mandó el email de aviso
);

alter table public.cotizaciones enable row level security;

grant insert on public.cotizaciones to anon, authenticated;
grant select, update, delete on public.cotizaciones to authenticated;
grant select, update on public.cotizaciones to service_role;  -- la función notify-quote lee la cotización y marca el aviso

-- Cualquiera puede enviar una cotización nueva (sin tocar estado ni aviso); solo el admin la ve y la gestiona.
drop policy if exists "cotizaciones: public insert" on public.cotizaciones;
create policy "cotizaciones: public insert" on public.cotizaciones
  for insert to anon, authenticated
  with check (status = 'nuevo' and notified_at is null);

drop policy if exists "cotizaciones: admin read" on public.cotizaciones;
create policy "cotizaciones: admin read" on public.cotizaciones
  for select using (public.lad_is_admin());

drop policy if exists "cotizaciones: admin update" on public.cotizaciones;
create policy "cotizaciones: admin update" on public.cotizaciones
  for update using (public.lad_is_admin()) with check (public.lad_is_admin());

drop policy if exists "cotizaciones: admin delete" on public.cotizaciones;
create policy "cotizaciones: admin delete" on public.cotizaciones
  for delete using (public.lad_is_admin());

-- Bucket privado para los planos y fotos que adjunta el cliente (máx. 10 MB por archivo)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quote-files', 'quote-files', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "quote-files: public upload" on storage.objects;
create policy "quote-files: public upload" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'quote-files');

drop policy if exists "quote-files: admin read" on storage.objects;
create policy "quote-files: admin read" on storage.objects
  for select using (bucket_id = 'quote-files' and public.lad_is_admin());

drop policy if exists "quote-files: admin delete" on storage.objects;
create policy "quote-files: admin delete" on storage.objects
  for delete using (bucket_id = 'quote-files' and public.lad_is_admin());
