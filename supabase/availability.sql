-- Disponible / No disponible en vez de stock (se compra al proveedor por pedido).
-- Correr una sola vez en el SQL Editor de Supabase.
-- En el admin, "Disponible" guarda stock = 9999 y "No disponible" guarda 0. Esto pasa los productos
-- que hoy tienen stock cargado (50) a "disponible" con ese mismo número, para que los pedidos
-- no los vayan agotando.
update public.products set stock = 9999 where stock > 0;
