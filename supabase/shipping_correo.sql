-- Envíos con Correo Argentino (MiCorreo): peso y medidas de cada producto, y configuración de envíos.
-- Correr una sola vez en el SQL Editor de Supabase.

-- Peso (gramos) y medidas (cm) del producto ya embalado. Si quedan vacíos, la cotización usa
-- valores por defecto (1 kg, 10 x 10 x 10 cm).
alter table public.products add column if not exists weight_g integer;
alter table public.products add column if not exists length_cm integer;
alter table public.products add column if not exists width_cm integer;
alter table public.products add column if not exists height_cm integer;

-- Configuración de envíos, editable en Admin → Configuración:
--   origen_cp: código postal desde donde se despacha (sede o proveedor)
--   recargo:   monto fijo que se suma a cada cotización (embalaje, manipulación)
insert into public.site_settings (key, value) values ('envios', '{"origen_cp": "", "recargo": 0}'::jsonb)
on conflict (key) do nothing;
