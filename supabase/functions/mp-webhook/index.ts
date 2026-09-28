// Edge Function: mp-webhook
// Mercado Pago llama a esta URL cada vez que cambia el estado de un pago.
// Nunca confiamos en el contenido del aviso a ciegas: volvemos a consultarle
// a Mercado Pago el estado real del pago antes de actualizar el pedido.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};

    const paymentId = body?.data?.id || url.searchParams.get('data.id') || url.searchParams.get('id');
    const topic = body?.type || url.searchParams.get('type') || url.searchParams.get('topic');

    // Solo nos interesan las notificaciones de pagos
    if (!paymentId || topic !== 'payment') {
      return new Response('ok', { status: 200 });
    }

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });
    const payment = await mpRes.json();
    if (!mpRes.ok) {
      console.error('Error consultando el pago en Mercado Pago:', payment);
      return new Response('error consultando el pago', { status: 200 });
    }

    const orderId = payment.external_reference;
    if (!orderId) return new Response('ok', { status: 200 });

    let paymentStatus = 'pendiente';
    if (payment.status === 'approved') paymentStatus = 'aprobado';
    else if (payment.status === 'rejected' || payment.status === 'cancelled') paymentStatus = 'rechazado';

    console.log(`Actualizando pedido ${orderId} a payment_status=${paymentStatus} (payment ${paymentId}, status MP=${payment.status})`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: updated, error: updateError } = await supabase
      .from('orders')
      .update({ payment_status: paymentStatus })
      .eq('id', orderId)
      .select();

    if (updateError) {
      console.error('Error actualizando el pedido:', updateError);
    } else {
      console.log('Filas actualizadas:', updated?.length ?? 0, JSON.stringify(updated));
    }

    // Pago aprobado: descontamos el stock (la función ignora pedidos que ya lo descontaron)
    if (paymentStatus === 'aprobado') {
      const { error: stockError } = await supabase.rpc('lad_apply_order_stock', { p_order_id: String(orderId) });
      if (stockError) console.error('Error descontando stock del pedido', orderId, stockError);

      // Avisamos a Lad Flooring que entró un pedido pagado (la función avisa una sola vez por pedido)
      const notifyRes = await fetch(`${SUPABASE_URL}/functions/v1/notify-new-order`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      }).catch((e) => { console.error('Error invocando notify-new-order:', e); return null; });
      if (notifyRes && !notifyRes.ok) console.error('notify-new-order respondió', notifyRes.status, await notifyRes.text());
    }

    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response('error', { status: 500 });
  }
});
