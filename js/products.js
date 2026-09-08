/* Productos — leídos desde Supabase (antes eran datos mock hardcodeados) */

function ladFormatPrice(value) {
  return value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
}

function ladMapProduct(row) {
  return {
    id: row.id,
    name: row.name,
    line: row.line,
    category: row.category,
    price: row.price,
    oldPrice: row.old_price,
    img: row.image_url,
    stock: row.stock,
    hidden: row.hidden,
    description: row.description,
    usageInfo: row.usage_info
  };
}

async function ladGetProducts({ line, includeHidden = false } = {}) {
  if (!ladSupabase) { console.warn('[Lad Flooring] Supabase no conectado — ladGetProducts() devuelve []'); return []; }
  let query = ladSupabase.from('products').select('*').order('name');
  if (!includeHidden) query = query.eq('hidden', false);
  if (line && line !== 'todos') query = query.eq('line', line);
  const { data, error } = await query;
  if (error) { console.error('[Lad Flooring] Error cargando productos:', error.message); return []; }
  return data.map(ladMapProduct);
}

async function ladGetProductById(id) {
  if (!ladSupabase) { console.warn('[Lad Flooring] Supabase no conectado — ladGetProductById() devuelve null'); return null; }
  const { data, error } = await ladSupabase.from('products').select('*').eq('id', id).single();
  if (error) { console.error('[Lad Flooring] Error cargando producto:', error.message); return null; }
  return ladMapProduct(data);
}
