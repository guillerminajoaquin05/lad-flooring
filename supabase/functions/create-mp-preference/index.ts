// Edge Function: create-mp-preference
// Crea el pedido en la base (pendiente) y una preferencia de pago en Mercado Pago.
// Devuelve el link de pago (init_point) al que redirigimos al comprador.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const { items, shippingInfo, shippingCost, discountPct, couponCode, siteUrl: bodySiteUrl } = body;

    if (!items || items.length === 0) {
      return json({ error: 'El carrito está vacío' }, 400);
    }

    const subtotal = items.reduce((sum: number, i: any) => sum + i.price * i.qty, 0);
    const discount = subtotal * (discountPct || 0);
    const total = subtotal - discount + shippingCost;

    // 1. Crear el pedido (pendiente de pago)
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
        coupon_code: couponCode || null,
        subtotal,
        discount,
        total,
        payment_method: 'mp',
        payment_status: 'pendiente',
        order_status: 'preparando',
      })
      .select()
      .single();

    if (orderError) throw orderError;

    const orderItems = items.map((i: any) => ({
      order_id: order.id,
      product_id: i.id,
      qty: i.qty,
      unit_price: i.price,
      variant: i.variant || null,
    }));
    const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
    if (itemsError) throw itemsError;

    // 2. Crear la preferencia de pago en Mercado Pago
    // Usamos la URL que manda el front (incluye subcarpeta si el sitio no vive en la raíz, ej. GitHub Pages)
    const siteUrl = (bodySiteUrl || req.headers.get('origin') || 'http://localhost:5500/').replace(/\/$/, '');
    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: items.map((i: any) => ({
          title: i.variant ? `${i.name} (${i.variant})` : i.name,
          quantity: i.qty,
          unit_price: i.price,
          currency_id: 'ARS',
        })),
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

    return json({ init_point: preference.init_point, order_id: order.id });
  } catch (err) {
    console.error(err);
    return json({ error: err.message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
