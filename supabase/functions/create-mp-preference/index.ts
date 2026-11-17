// Edge Function: create-mp-preference
// Crea el pedido en la base (pendiente) y una preferencia de pago en Mercado Pago.
// Devuelve el link de pago (init_point) al que redirigimos al comprador.
//
// SEGURIDAD: el precio de cada producto y el costo de envío se RECALCULAN acá
// adentro a partir de datos de confianza (la tabla products y la cotización de
// la función quote-shipping). Nunca se usa el price/shippingCost que manda el navegador para
// calcular el total — eso evita que alguien arme el pedido a mano (por consola,
// sin pasar por la tienda) y le pida a Mercado Pago que le cobre lo que quiera.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/* El envío lo calcula la función quote-shipping (Correo Argentino en vivo, o la tarifa fija por zona
   si Correo no está conectado o no responde). Es la misma cuenta que le mostramos al comprador en el
   checkout, y acá se vuelve a pedir del lado del servidor: nunca usamos el costo que manda el navegador. */
async function quoteShipping(items: any[], shippingInfo: any): Promise<{ price: number; label: string } | { error: string }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/quote-shipping`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: items.map((i: any) => ({ id: i.id, qty: i.qty })),
      postalCode: shippingInfo?.codigoPostal,
      provincia: shippingInfo?.provincia,
    }),
  }).catch(() => null);
  const data = res ? await res.json().catch(() => ({})) : {};
  if (!res || !res.ok || !(Number(data.price) >= 0) || !data.label) return { error: data.error || 'No pudimos calcular el envío' };
  return { price: Number(data.price), label: String(data.label) };
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
    if (userError || !userData.user) {
      return json({ error: 'No autenticado' }, 401);
    }
    const user = userData.user;

    const body = await req.json();
    const { items, shippingInfo, siteUrl: bodySiteUrl } = body;

    if (!items || items.length === 0) {
      return json({ error: 'El carrito está vacío' }, 400);
    }

    // 1. Recalculamos el precio real de cada producto (ignoramos el price que mandó el navegador).
    const productIds = [...new Set(items.map((i: any) => i.id))];
    const { data: dbProducts, error: productsError } = await supabase
      .from('products')
      .select('id, name, price, stock, line')
      .in('id', productIds);
    if (productsError) throw productsError;

    const productById = new Map(dbProducts.map((p: any) => [p.id, p]));
    for (const i of items) {
      if (!productById.has(i.id)) return json({ error: `Producto no encontrado: ${i.id}` }, 400);
      // Los pisos se venden por consulta (precio variable), no por el carrito
      if (productById.get(i.id)!.line === 'flotantes') return json({ error: `${productById.get(i.id)!.name} se vende por consulta` }, 400);
      if (!Number.isInteger(i.qty) || i.qty <= 0) return json({ error: 'Cantidad inválida' }, 400);
    }

    // Stock suficiente (sumando las variantes del mismo producto). Se descuenta recién al aprobarse el pago (mp-webhook).
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
      return { id: p.id, name: p.name, price: p.price, qty: i.qty, variant: i.variant || null };
    });
    const subtotal = pricedItems.reduce((sum, i) => sum + i.price * i.qty, 0);

    // 2. Recalculamos el envío con quote-shipping (ignoramos el shippingCost del navegador).
    const shipping = await quoteShipping(pricedItems, shippingInfo);
    if ('error' in shipping) return json({ error: shipping.error }, 400);
    const shippingCost = shipping.price;

    const total = subtotal + shippingCost;

    // 3. Creamos el pedido (pendiente de pago) con los montos ya verificados.
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
        shipping_zone: shipping.label,
        shipping_cost: shippingCost,
        coupon_code: null,
        subtotal,
        discount: 0,
        total,
        payment_method: 'mp',
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

    // 4. Creamos la preferencia de pago en Mercado Pago con los mismos precios verificados.
    const siteUrl = (bodySiteUrl || req.headers.get('origin') || 'http://localhost:5500/').replace(/\/$/, '');
    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [
          ...pricedItems.map((i) => ({
            title: i.variant ? `${i.name} (${i.variant})` : i.name,
            quantity: i.qty,
            unit_price: i.price,
            currency_id: 'ARS',
          })),
          // El envío se cobra como un ítem más, así Mercado Pago le cobra al
          // comprador productos + envío juntos (coincide con el "total" del pedido).
          { title: shipping.label, quantity: 1, unit_price: shippingCost, currency_id: 'ARS' },
        ],
        payer: { name: shippingInfo.nombre, email: shippingInfo.email },
        back_urls: {
          success: `${siteUrl}/checkout.html?status=success&order_id=${order.id}`,
          failure: `${siteUrl}/checkout.html?status=failure&order_id=${order.id}`,
          pending: `${siteUrl}/checkout.html?status=pending&order_id=${order.id}`,
        },
        auto_return: 'approved',
        external_reference: String(order.id),
        notification_url: `${SUPABASE_URL}/functions/v1/mp-webhook`,
      }),
    });

    const preference = await mpResponse.json();
    if (!mpResponse.ok) {
      // Mercado Pago falló: revertimos el pedido que acabamos de crear para no dejarlo huérfano
      await supabase.from('order_items').delete().eq('order_id', order.id);
      await supabase.from('orders').delete().eq('id', order.id);
      throw new Error(preference.message || 'Error creando la preferencia de Mercado Pago');
    }

    // Mandamos el email de confirmación (no bloqueamos la respuesta si falla; waitUntil evita que se corte)
    const confirmation = fetch(`${SUPABASE_URL}/functions/v1/send-order-confirmation`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order.id }),
    }).catch((e) => console.error('Error invocando send-order-confirmation:', e));
    const runtime = (globalThis as any).EdgeRuntime;
    if (runtime?.waitUntil) runtime.waitUntil(confirmation);

    return json({ init_point: preference.init_point, order_id: order.id });
  } catch (err) {
    console.error(err);
    return json({ error: err.message }, 500);
  }
});
