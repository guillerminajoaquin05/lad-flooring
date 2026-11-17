-- Botón de arrepentimiento (Res. 424/2020 de la Secretaría de Comercio Interior).
-- Pedidos de cancelación de compra, visibles en el admin. Correr una sola vez en el SQL Editor de Supabase.
-- Usa public.lad_is_admin() de projects.sql.

create table if not exists public.arrepentimientos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,            -- código que recibe el cliente (ARR- + primeros 8 del id)
  created_at timestamptz not null default now(),
  nombre text not null,
  email text not null,
  telefono text,
  pedido text,                            -- número de pedido, si lo tiene
  productos text,                         -- qué quiere devolver
  motivo text,
  status text not null default 'nuevo',   -- nuevo | en_proceso | resuelto
  notified_at timestamptz                 -- cuándo se mandaron los emails
);

alter table public.arrepentimientos enable row level security;

grant insert on public.arrepentimientos to anon, authenticated;
grant select, update, delete on public.arrepentimientos to authenticated;
grant select, update on public.arrepentimientos to service_role;  -- la función notify-arrepentimiento lo lee y marca el aviso

-- Cualquiera puede pedirlo, sin cuenta (lo exige la norma). El código tiene que salir del id,
-- así nadie puede inventar uno. Solo el admin ve y gestiona los pedidos.
drop policy if exists "arrepentimientos: public insert" on public.arrepentimientos;
create policy "arrepentimientos: public insert" on public.arrepentimientos
  for insert to anon, authenticated
  with check (status = 'nuevo' and notified_at is null and codigo = 'ARR-' || upper(left(id::text, 8)));

drop policy if exists "arrepentimientos: admin read" on public.arrepentimientos;
create policy "arrepentimientos: admin read" on public.arrepentimientos
  for select using (public.lad_is_admin());

drop policy if exists "arrepentimientos: admin update" on public.arrepentimientos;
create policy "arrepentimientos: admin update" on public.arrepentimientos
  for update using (public.lad_is_admin()) with check (public.lad_is_admin());

drop policy if exists "arrepentimientos: admin delete" on public.arrepentimientos;
create policy "arrepentimientos: admin delete" on public.arrepentimientos
  for delete using (public.lad_is_admin());
