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

/* Misma fuente de verdad que create-mp-preference/index.ts — si cambian los
   cupones o las tarifas de envío, actualizar en los dos lugares. */
const VALID_COUPONS: Record<string, number> = { LAD10: 0.10 };
const SHIPPING_RATES: Record<string, number> = { caba: 4500, gba: 6800, cercano: 8900, lejano: 13500 };

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
    const { items, shippingInfo, couponCode } = body;

    if (!items || items.length === 0) return json({ error: 'El carrito está vacío' }, 400);

    const productIds = [...new Set(items.map((i: any) => i.id))];
    const { data: dbProducts, error: productsError } = await supabase
      .from('products')
      .select('id, name, price, line')
      .in('id', productIds);
    if (productsError) throw productsError;

    const productById = new Map(dbProducts.map((p: any) => [p.id, p]));
    for (const i of items) {
      if (!productById.has(i.id)) return json({ error: `Producto no encontrado: ${i.id}` }, 400);
      // Los pisos se venden por consulta (precio variable), no por el carrito
      if (productById.get(i.id)!.line === 'flotantes') return json({ error: `${productById.get(i.id)!.name} se vende por consulta` }, 400);
      if (!Number.isInteger(i.qty) || i.qty <= 0) return json({ error: 'Cantidad inválida' }, 400);
    }

    const pricedItems = items.map((i: any) => {
      const p = productById.get(i.id)!;
      return { id: p.id, price: p.price, qty: i.qty, variant: i.variant || null };
    });
    const subtotal = pricedItems.reduce((sum, i) => sum + i.price * i.qty, 0);

    const discountPct = (couponCode && VALID_COUPONS[String(couponCode).toUpperCase()]) || 0;
    const discount = subtotal * discountPct;

    const shippingCost = SHIPPING_RATES[shippingInfo?.provincia] ?? null;
    if (shippingCost === null) return json({ error: 'Zona de envío inválida' }, 400);

    const total = subtotal - discount + shippingCost;

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
        shipping_zone: shippingInfo.shippingZone,
        shipping_cost: shippingCost,
        coupon_code: discountPct > 0 ? couponCode : null,
        subtotal,
        discount,
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
