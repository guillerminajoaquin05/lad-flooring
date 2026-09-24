-- Trabajos Destacados (página Quiénes Somos), editables desde el panel de admin.
-- Correr una sola vez en el SQL Editor de Supabase.

create table if not exists public.projects (
  id bigint generated always as identity primary key,
  title text not null,
  wood text not null default '',
  description text not null default '',
  details text,
  images text[] not null default '{}',   -- la primera es la portada de la tarjeta
  sort_order int not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.lad_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

alter table public.projects enable row level security;

-- Acceso de la API a la tabla (las políticas de abajo deciden qué filas ve/edita cada uno)
grant select on public.projects to anon, authenticated;
grant insert, update, delete on public.projects to authenticated;
grant execute on function public.lad_is_admin() to anon, authenticated;

drop policy if exists "projects: public read visible" on public.projects;
create policy "projects: public read visible" on public.projects
  for select using (hidden = false or public.lad_is_admin());

drop policy if exists "projects: admin write" on public.projects;
create policy "projects: admin write" on public.projects
  for all using (public.lad_is_admin()) with check (public.lad_is_admin());

-- Los 6 trabajos que hoy están en nosotros.html
insert into public.projects (title, wood, description, images, sort_order)
select * from (values
  ('Departamento residencial', 'Roble de Slavonia',
   'Parquet de Roble de Slavonia, 300 m². Renovación completa con hidrolaqueado de alto rendimiento.',
   array['assets/img/proyecto-recoleta-5.jpeg','assets/img/proyecto-recoleta-1.jpeg','assets/img/proyecto-recoleta-2.jpeg','assets/img/proyecto-recoleta-3.jpeg','assets/img/proyecto-recoleta-4.jpeg'], 1),
  ('Departamento residencial', 'Eucalipto',
   'Piso de Eucalipto, 80 m². Recambio de tablas, pulido y tratamiento combinado con craft oil y terminación con hidrolaqueado.',
   array['assets/img/proyecto-talcahuano-1.jpeg','assets/img/proyecto-talcahuano-2.jpeg','assets/img/proyecto-talcahuano-3.jpeg','assets/img/proyecto-talcahuano-4.jpeg','assets/img/proyecto-talcahuano-5.jpeg','assets/img/proyecto-talcahuano-6.jpeg'], 2),
  ('Parquet Palermo', 'Lapacho en Salto',
   '200 m² de Lapacho con varillas de bronce restaurados desde cero. Recambio de tablas por antigüedad y recuperación del brillo original.',
   array['assets/img/proyecto-miguel-cane-1.jpeg','assets/img/proyecto-miguel-cane-2.jpeg','assets/img/proyecto-miguel-cane-3.jpeg','assets/img/proyecto-miguel-cane-4.jpeg'], 3),
  ('Terraza deck', 'Exteriores',
   'Deck recuperado desde un tono oscurecido a su color natural. Pulido y tratamiento con productos Bona aptos para intemperie y UV.',
   array['assets/img/proyecto-terraza-deck-1.jpeg','assets/img/proyecto-terraza-deck-2.jpeg','assets/img/proyecto-terraza-deck-3.jpeg'], 4),
  ('Cancha de Squash', 'Pisos Deportivos',
   'Cancha de Squash recuperada desde cero. Recambio de madera, colocación, pulido e hidrolaqueado de alto rendimiento.',
   array['assets/img/proyecto-squash-4.jpeg','assets/img/proyecto-squash-2.jpeg','assets/img/proyecto-squash-3.jpeg','assets/img/proyecto-squash-1.jpeg'], 5),
  ('Gimnasio', 'Pisos Deportivos',
   'Reparación y recambio puntual de tablas, pulido e hidrolaqueado de alto tráfico.',
   array['assets/img/proyecto-gimnasio-1.jpeg','assets/img/proyecto-gimnasio-2.jpeg','assets/img/proyecto-gimnasio-3.jpeg','assets/img/proyecto-gimnasio-4.jpeg'], 6)
) as v(title, wood, description, images, sort_order)
where not exists (select 1 from public.projects);
