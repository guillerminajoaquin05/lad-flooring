-- Descuento de stock cuando se aprueba el pago de un pedido.
-- Correr una sola vez en el SQL Editor de Supabase. Usa public.lad_is_admin() de projects.sql.

-- Marca si el pedido ya descontó su stock, para no descontarlo dos veces
-- (Mercado Pago avisa varias veces del mismo pago).
alter table public.orders add column if not exists stock_applied boolean not null default false;

create or replace function public.lad_apply_order_stock(p_order_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Solo la puede usar el servidor (webhook de Mercado Pago) o un admin (botón "Aprobar pago")
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' and not public.lad_is_admin() then
    raise exception 'No autorizado';
  end if;

  -- Marca el pedido; si ya estaba marcado (o no existe) no hace nada
  update public.orders set stock_applied = true
  where id::text = p_order_id and stock_applied = false;
  if not found then
    return;
  end if;

  update public.products p
  set stock = greatest(p.stock - i.qty, 0)
  from (
    select product_id, sum(qty) as qty
    from public.order_items
    where order_id::text = p_order_id
    group by product_id
  ) i
  where p.id = i.product_id;
end;
$$;

revoke all on function public.lad_apply_order_stock(text) from public, anon;
grant execute on function public.lad_apply_order_stock(text) to authenticated, service_role;
