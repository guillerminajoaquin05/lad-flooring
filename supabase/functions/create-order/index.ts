// Edge Function: create-order
// Crea un pedido con pago por transferencia bancaria (payment_status: pendiente).
// Antes esto lo hacía el navegador insertando directo en la tabla "orders" —
// lo que significaba que cualquier usuario logueado podía mandar el subtotal,
// el descuento y el total que quisiera, sin que nadie los revisara. Acá se
// recalculan todos los montos a partir de datos de confianza, igual que en
// create-mp-preference.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/* Misma fuente de verdad que create-mp-preference/index.ts — si cambian las tarifas
   de envío o las provincias de cada zona, actualizar en los dos lugares. */
const SHIPPING_ZONES: Record<string, { label: string; price: number }> = {
  caba: { label: 'Envío CABA', price: 4500 },
  gba: { label: 'Envío GBA', price: 6800 },
  cercano: { label: 'Envío Interior (zona cercana)', price: 8900 },
  lejano: { label: 'Envío Interior (zona lejana)', price: 13500 },
};
const PROVINCE_ZONES: Record<string, string> = {
  'Ciudad Autónoma de Buenos Aires': 'caba',
  'Buenos Aires': 'gba',
  'Córdoba': 'cercano', 'Entre Ríos': 'cercano', 'La Pampa': 'cercano', 'Mendoza': 'cercano',
  'San Juan': 'cercano', 'San Luis': 'cercano', 'Santa Fe': 'cercano',
  'Catamarca': 'lejano', 'Chaco': 'lejano', 'Chubut': 'lejano', 'Corrientes': 'lejano', 'Formosa': 'lejano',
  'Jujuy': 'lejano', 'La Rioja': 'lejano', 'Misiones': 'lejano', 'Neuquén': 'lejano', 'Río Negro': 'lejano',
  'Salta': 'lejano', 'Santa Cruz': 'lejano', 'Santiago del Estero': 'lejano', 'Tierra del Fuego': 'lejano',
  'Tucumán': 'lejano',
};

// La zona sale de la provincia real. También acepta un código de zona, que es lo que mandaba el checkout anterior.
function shippingZoneFor(provincia: string) {
  const key = PROVINCE_ZONES[provincia] || (SHIPPING_ZONES[provincia] ? provincia : null);
  return key ? SHIPPING_ZONES[key] : null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return json({ error: 'No autenticado' }, 401);
    const user = userData.user;

    const body = await req.json();
    const { items, shippingInfo } = body;

    if (!items || items.length === 0) return json({ error: 'El carrito está vacío' }, 400);

    const productIds = [...new Set(items.map((i: any) => i.id))];
    const { data: dbProducts, error: productsError } = await supabase
      .from('products')
      .select('id, name, price, line, stock')
      .in('id', productIds);
    if (productsError) throw productsError;

    const productById = new Map(dbProducts.map((p: any) => [p.id, p]));
    for (const i of items) {
      if (!productById.has(i.id)) return json({ error: `Producto no encontrado: ${i.id}` }, 400);
      // Los pisos se venden por consulta (precio variable), no por el carrito
      if (productById.get(i.id)!.line === 'flotantes') return json({ error: `${productById.get(i.id)!.name} se vende por consulta` }, 400);
      if (!Number.isInteger(i.qty) || i.qty <= 0) return json({ error: 'Cantidad inválida' }, 400);
    }

    // Stock suficiente (sumando las variantes del mismo producto). Se descuenta recién al aprobarse el pago.
    const qtyByProduct = new Map<string, number>();
    for (const i of items) qtyByProduct.set(i.id, (qtyByProduct.get(i.id) || 0) + i.qty);
    for (const [id, qty] of qtyByProduct) {
      const p = productById.get(id)!;
      if (qty > p.stock) {
        return json({ error: p.stock > 0 ? `Solo quedan ${p.stock} unidades de ${p.name}` : `${p.name} está sin stock` }, 400);
      }
    }

    const pricedItems = items.map((i: any) => {
      const p = productById.get(i.id)!;
      return { id: p.id, price: p.price, qty: i.qty, variant: i.variant || null };
    });
    const subtotal = pricedItems.reduce((sum, i) => sum + i.price * i.qty, 0);


    const zone = shippingZoneFor(shippingInfo?.provincia);
    if (!zone) return json({ error: 'Provincia de envío inválida' }, 400);
    const shippingCost = zone.price;

    const total = subtotal + shippingCost;

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: user.id,
        nombre: shippingInfo.nombre,
        apellido: shippingInfo.apellido,
        email: shippingInfo.email,
        telefono: shippingInfo.telefono,
        direccion: shippingInfo.direccion,
        depto: shippingInfo.depto || null,
        localidad: shippingInfo.localidad,
        provincia: shippingInfo.provincia,
        codigo_postal: shippingInfo.codigoPostal,
        notas: shippingInfo.notas || null,
        shipping_zone: zone.label,
        shipping_cost: shippingCost,
        coupon_code: null,
        subtotal,
        discount: 0,
        total,
        payment_method: 'transferencia',
        payment_status: 'pendiente',
        order_status: 'preparando',
      })
      .select()
      .single();

    if (orderError) throw orderError;

    const orderItems = pricedItems.map((i) => ({
      order_id: order.id,
      product_id: i.id,
      qty: i.qty,
      unit_price: i.price,
      variant: i.variant,
    }));
    const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
    if (itemsError) throw itemsError;

    fetch(`${SUPABASE_URL}/functions/v1/send-order-confirmation`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order.id }),
    }).catch((e) => console.error('Error invocando send-order-confirmation:', e));

    return json({ ok: true, orderId: order.id });
  } catch (err) {
    console.error(err);
    return json({ error: err.message }, 500);
  }
});
