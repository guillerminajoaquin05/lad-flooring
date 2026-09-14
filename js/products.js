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
    usageInfo: row.usage_info,
    variantOptions: (row.variant_options || '').split('\n').map(v => v.trim()).filter(Boolean),
    family: row.family,
    usageTier: row.usage_tier
  };
}

/* La familia "Spray Mop" (mopa + repuestos/accesorios) va siempre primero en
   la tienda; el resto de las familias se ordena alfabéticamente detrás. */
const LAD_FEATURED_FAMILY = 'spray mop';

async function ladGetProducts({ line, tier, includeHidden = false } = {}) {
  if (!ladSupabase) { console.warn('[Lad Flooring] Supabase no conectado — ladGetProducts() devuelve []'); return []; }
  let query = ladSupabase.from('products').select('*');
  if (!includeHidden) query = query.eq('hidden', false);
  if (line && line !== 'todos') query = query.eq('line', line);
  if (tier && tier !== 'todos') query = query.eq('usage_tier', tier);
  const { data, error } = await query;
  if (error) { console.error('[Lad Flooring] Error cargando productos:', error.message); return []; }
  const products = data.map(ladMapProduct);
  products.sort((a, b) => {
    const af = (a.family || '').toLowerCase();
    const bf = (b.family || '').toLowerCase();
    const aFeatured = af.includes(LAD_FEATURED_FAMILY) ? 0 : 1;
    const bFeatured = bf.includes(LAD_FEATURED_FAMILY) ? 0 : 1;
    if (aFeatured !== bFeatured) return aFeatured - bFeatured;
    if (af !== bf) {
      if (!af) return 1;
      if (!bf) return -1;
      return af.localeCompare(bf);
    }
    return a.name.localeCompare(b.name);
  });
  return products;
}

async function ladGetProductById(id) {
  if (!ladSupabase) { console.warn('[Lad Flooring] Supabase no conectado — ladGetProductById() devuelve null'); return null; }
  const { data, error } = await ladSupabase.from('products').select('*').eq('id', id).single();
  if (error) { console.error('[Lad Flooring] Error cargando producto:', error.message); return null; }
  return ladMapProduct(data);
}

async function ladGetProductImages(productId) {
  if (!ladSupabase) return [];
  const { data, error } = await ladSupabase.from('product_images').select('*').eq('product_id', productId).order('sort_order');
  if (error) { console.error('[Lad Flooring] Error cargando galería del producto:', error.message); return []; }
  return data;
}
