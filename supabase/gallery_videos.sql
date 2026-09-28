-- Permite subir videos (MP4, WebM, MOV) a la galería de servicios, que usa el bucket "product-images".
-- Correr una sola vez en el SQL Editor de Supabase. No cambia nada si el bucket ya acepta cualquier tipo de archivo.

-- Si el bucket tiene una lista de tipos permitidos, le suma los de video
update storage.buckets
set allowed_mime_types = array(
  select distinct unnest(allowed_mime_types || array['video/mp4', 'video/webm', 'video/quicktime'])
)
where id = 'product-images' and allowed_mime_types is not null;

-- Si el bucket tiene un límite de tamaño menor a 50 MB, lo sube a 50 MB (el máximo del plan gratuito)
update storage.buckets
set file_size_limit = 52428800
where id = 'product-images' and file_size_limit is not null and file_size_limit < 52428800;

-- Para ver cómo quedó:
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'product-images';
