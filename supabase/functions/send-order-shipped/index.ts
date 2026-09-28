// Edge Function: send-order-shipped
// Le avisa al cliente por email que su pedido salió, con la empresa de envío y el número de seguimiento.
// La llama el panel de admin al marcar un pedido como "Despachado".
// Solo manda si el pedido está despachado (o en camino), y una sola vez por pedido (marca shipped_email_sent_at).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FROM_EMAIL = Deno.env.get('ORDERS_FROM_EMAIL') || 'Lad Flooring <onboarding@resend.dev>';
const REPLY_TO = Deno.env.get('ORDERS_NOTIFY_EMAIL') || 'info@ladflooring.com';
const SITE_URL = 'https://ladflooring.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function esc(s: unknown) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { orderId } = await req.json();
    if (!orderId) return json({ error: 'Falta orderId' }, 400);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: order, error } = await supabase
      .from('orders')
      .select('*, order_items(qty, variant, products(name))')
      .eq('id', orderId)
      .single();
    if (error || !order) return json({ error: 'Pedido no encontrado' }, 404);
    if (!['despachado', 'en_camino'].includes(order.order_status)) return json({ ok: true, skipped: 'El pedido no está despachado' });
    if (order.shipped_email_sent_at) return json({ ok: true, alreadySent: true });

    const itemsHtml = order.order_items.map((i: any) =>
      `<li>${esc(i.products ? i.products.name : 'Producto')}${i.variant ? ` (${esc(i.variant)})` : ''} × ${i.qty}</li>`).join('');

    const trackingHtml = order.shipping_carrier || order.tracking_number
      ? `<div style="background:#F6F1E7;border-radius:10px;padding:14px 18px;margin:18px 0;">
           ${order.shipping_carrier ? `<div><span style="color:#8199a3;">Empresa de envío:</span> <strong>${esc(order.shipping_carrier)}</strong></div>` : ''}
           ${order.tracking_number ? `<div style="margin-top:4px;"><span style="color:#8199a3;">Número de seguimiento:</span> <strong style="font-size:1.1rem;letter-spacing:0.5px;">${esc(order.tracking_number)}</strong></div>` : ''}
           ${order.tracking_number && order.shipping_carrier ? `<div style="margin-top:8px;font-size:0.88rem;color:#3C5763;">Con este número podés seguir el envío en la web de ${esc(order.shipping_carrier)}.</div>` : ''}
         </div>`
      : '';

    const html = `
      <div style="font-family:Georgia,'Georgia Pro',serif;color:#1D3A47;max-width:560px;margin:0 auto;padding:24px;">
        <h2 style="color:#1D3A47;margin-bottom:4px;">¡Tu pedido ya está en camino, ${esc(order.nombre)}!</h2>
        <p style="color:#3C5763;">Despachamos tu pedido <strong>#${order.id}</strong>.</p>
        ${trackingHtml}
        <p style="color:#3C5763;margin-bottom:4px;"><strong>Qué enviamos:</strong></p>
        <ul style="color:#3C5763;margin-top:0;padding-left:20px;">${itemsHtml}</ul>
        <p style="color:#3C5763;">
          <strong>Dirección de entrega:</strong><br>
          ${esc(order.direccion)}${order.depto ? ', ' + esc(order.depto) : ''}, ${esc(order.localidad)}, ${esc(order.provincia)} (CP ${esc(order.codigo_postal)})
        </p>
        <p style="margin:24px 0;">
          <a href="${SITE_URL}/envio.html?pedido=${order.id}" style="background:#B98950;color:#fff;text-decoration:none;padding:12px 22px;border-radius:30px;display:inline-block;">Ver mi pedido</a>
        </p>
        <p style="color:#3C5763;font-size:0.9rem;">¿Alguna consulta sobre la entrega? Respondé este email o escribinos por WhatsApp al +54 9 11 2637-1921.</p>
        <p style="margin-top:28px;color:#8199a3;font-size:0.85rem;">Lad Flooring — Pisos de Madera</p>
      </div>`;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: order.email,
        reply_to: REPLY_TO,
        subject: `Tu pedido #${order.id} está en camino`,
        html,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.json().catch(() => ({}));
      console.error('Error enviando email con Resend:', err);
      return json({ error: 'Error enviando el email', detail: err }, 500);
    }

    await supabase.from('orders').update({ shipped_email_sent_at: new Date().toISOString() }).eq('id', orderId);
    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ error: err.message }, 500);
  }
});
