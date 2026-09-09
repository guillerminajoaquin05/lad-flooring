/* Servicios — leídos desde Supabase (antes eran datos mock hardcodeados) */

function ladMapService(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    img: row.image_url,
    shortDescription: row.short_description,
    description: row.description,
    includes: row.includes || [],
    hidden: row.hidden,
    usageInfo: row.usage_info
  };
}

async function ladGetServices({ includeHidden = false } = {}) {
  if (!ladSupabase) { console.warn('[Lad Flooring] Supabase no conectado — ladGetServices() devuelve []'); return []; }
  let query = ladSupabase.from('services').select('*').order('name');
  if (!includeHidden) query = query.eq('hidden', false);
  const { data, error } = await query;
  if (error) { console.error('[Lad Flooring] Error cargando servicios:', error.message); return []; }
  return data.map(ladMapService);
}

async function ladGetServiceById(id) {
  if (!ladSupabase) { console.warn('[Lad Flooring] Supabase no conectado — ladGetServiceById() devuelve null'); return null; }
  const { data, error } = await ladSupabase.from('services').select('*').eq('id', id).single();
  if (error) { console.error('[Lad Flooring] Error cargando servicio:', error.message); return null; }
  return ladMapService(data);
}

async function ladGetServiceImages(serviceId) {
  if (!ladSupabase) return [];
  const { data, error } = await ladSupabase.from('service_images').select('*').eq('service_id', serviceId).order('sort_order');
  if (error) { console.error('[Lad Flooring] Error cargando galería del servicio:', error.message); return []; }
  return data;
}
