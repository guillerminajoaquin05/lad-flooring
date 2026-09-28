// Edge Function: send-payment-approved
// Le avisa al cliente por email que su pago fue aprobado y que ya estamos preparando el pedido.
// La llaman mp-webhook (Mercado Pago aprobado) y el panel de admin (botón "Aprobar pago" de una transferencia).
// Solo manda si el pedido está realmente aprobado, y una sola vez por pedido (marca payment_email_sent_at).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FROM_EMAIL = Deno.env.get('ORDERS_FROM_EMAIL') || 'Lad Flooring <onboarding@resend.dev>';
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

function formatPrice(n: number) {
  return Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
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
      .select('*, order_items(qty, unit_price, variant, products(name))')
      .eq('id', orderId)
      .single();
    if (error || !order) return json({ error: 'Pedido no encontrado' }, 404);
    if (order.payment_status !== 'aprobado') return json({ ok: true, skipped: 'El pago no está aprobado' });
    if (order.payment_email_sent_at) return json({ ok: true, alreadySent: true });

    const itemsHtml = order.order_items.map((i: any) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #E3DCCE;">
          ${esc(i.products ? i.products.name : 'Producto')}${i.variant ? ` <span style="color:#8199a3;">(${esc(i.variant)})</span>` : ''} × ${i.qty}
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #E3DCCE;text-align:right;">${formatPrice(i.unit_price * i.qty)}</td>
      </tr>`).join('');

    const html = `
      <div style="font-family:Georgia,'Georgia Pro',serif;color:#1D3A47;max-width:560px;margin:0 auto;padding:24px;">
        <h2 style="color:#1D3A47;margin-bottom:4px;">¡Tu pago fue aprobado, ${esc(order.nombre)}!</h2>
        <p style="color:#3C5763;">Confirmamos el pago de tu pedido <strong>#${order.id}</strong>${order.payment_method === 'transferencia' ? ' por transferencia' : ''}. Ya lo estamos preparando y te avisamos por email cuando lo despachemos.</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          ${itemsHtml}
          <tr>
            <td style="padding:8px 0;">${esc(order.shipping_zone || 'Envío')}</td>
            <td style="padding:8px 0;text-align:right;">${formatPrice(order.shipping_cost)}</td>
          </tr>
          <tr>
            <td style="padding:10px 0 0;font-weight:bold;">Total pagado</td>
            <td style="padding:10px 0 0;font-weight:bold;text-align:right;">${formatPrice(order.total)}</td>
          </tr>
        </table>
        <p style="color:#3C5763;">
          <strong>Lo enviamos a:</strong><br>
          ${esc(order.direccion)}${order.depto ? ', ' + esc(order.depto) : ''}, ${esc(order.localidad)}, ${esc(order.provincia)} (CP ${esc(order.codigo_postal)})
        </p>
        <p style="margin:24px 0;">
          <a href="${SITE_URL}/envio.html?pedido=${order.id}" style="background:#B98950;color:#fff;text-decoration:none;padding:12px 22px;border-radius:30px;display:inline-block;">Seguir mi pedido</a>
        </p>
        <p style="color:#3C5763;font-size:0.9rem;">¿Alguna consulta? Respondé este email o escribinos por WhatsApp al +54 9 11 2637-1921.</p>
        <p style="margin-top:28px;color:#8199a3;font-size:0.85rem;">Lad Flooring — Pisos de Madera</p>
      </div>`;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: order.email,
        reply_to: Deno.env.get('ORDERS_NOTIFY_EMAIL') || 'info@ladflooring.com',
        subject: `Pago aprobado — tu pedido #${order.id} está en preparación`,
        html,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.json().catch(() => ({}));
      console.error('Error enviando email con Resend:', err);
      return json({ error: 'Error enviando el email', detail: err }, 500);
    }

    await supabase.from('orders').update({ payment_email_sent_at: new Date().toISOString() }).eq('id', orderId);
    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ error: err.message }, 500);
  }
});
