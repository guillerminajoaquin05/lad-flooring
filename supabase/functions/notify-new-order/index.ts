// Edge Function: notify-new-order
// Avisa por email a Lad Flooring que entró un pedido nuevo, con todo lo necesario para despacharlo.
// La llaman create-order (transferencia, apenas se crea) y mp-webhook (Mercado Pago, cuando se aprueba el pago).
// Solo avisa una vez por pedido (marca business_notified_at) y nunca por un pago de Mercado Pago sin aprobar.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FROM_EMAIL = Deno.env.get('ORDERS_FROM_EMAIL') || 'Lad Flooring <onboarding@resend.dev>';
const NOTIFY_EMAIL = Deno.env.get('ORDERS_NOTIFY_EMAIL') || 'info@ladflooring.com';

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
    if (order.business_notified_at) return json({ ok: true, alreadyNotified: true });
    if (order.payment_method === 'mp' && order.payment_status !== 'aprobado') {
      return json({ ok: true, skipped: 'Pago de Mercado Pago todavía no aprobado' });
    }

    const isTransfer = order.payment_method === 'transferencia';
    const row = (label: string, value: string) =>
      `<tr><td style="padding:5px 12px 5px 0;color:#8199a3;vertical-align:top;">${label}</td><td style="padding:5px 0;">${value}</td></tr>`;
    const itemsHtml = order.order_items.map((i: any) => `
      <tr>
        <td style="padding:6px 0;border-bottom:1px solid #E3DCCE;">
          ${esc(i.products ? i.products.name : 'Producto')}${i.variant ? ` <span style="color:#8199a3;">(${esc(i.variant)})</span>` : ''} × ${i.qty}
        </td>
        <td style="padding:6px 0;border-bottom:1px solid #E3DCCE;text-align:right;">${formatPrice(i.unit_price * i.qty)}</td>
      </tr>`).join('');

    const html = `
      <div style="font-family:Georgia,'Georgia Pro',serif;color:#1D3A47;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="margin-bottom:4px;">Nuevo pedido #${order.id}</h2>
        <p style="margin-top:0;padding:10px 14px;border-radius:8px;background:${isTransfer ? '#FBF3E7' : '#EAF4EE'};color:${isTransfer ? '#8A6417' : '#2F6B47'};">
          ${isTransfer
            ? '<strong>Transferencia pendiente:</strong> revisá que llegue la plata y aprobá el pago en el admin para que se descuente el stock y avancemos con el envío.'
            : '<strong>Pagado con Mercado Pago.</strong> Ya se puede preparar el envío.'}
        </p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          ${itemsHtml}
          <tr><td style="padding:6px 0;">${esc(order.shipping_zone || 'Envío')}</td><td style="padding:6px 0;text-align:right;">${formatPrice(order.shipping_cost)}</td></tr>
          <tr><td style="padding:8px 0 0;font-weight:bold;">Total</td><td style="padding:8px 0 0;font-weight:bold;text-align:right;">${formatPrice(order.total)}</td></tr>
        </table>
        <h3 style="margin-bottom:4px;">Datos de entrega</h3>
        <table style="border-collapse:collapse;">
          ${row('Cliente', `${esc(order.nombre)} ${esc(order.apellido)}`)}
          ${row('Teléfono', esc(order.telefono))}
          ${row('Email', `<a href="mailto:${esc(order.email)}">${esc(order.email)}</a>`)}
          ${row('Dirección', `${esc(order.direccion)}${order.depto ? ', ' + esc(order.depto) : ''}`)}
          ${row('Localidad', `${esc(order.localidad)}, ${esc(order.provincia)}`)}
          ${row('Código postal', esc(order.codigo_postal))}
        </table>
        ${order.notas ? `<p><strong>Notas del cliente:</strong><br><span style="white-space:pre-line;">${esc(order.notas)}</span></p>` : ''}
        <p style="margin-top:28px;color:#8199a3;font-size:0.85rem;">Gestionalo en ladflooring.com/admin.html → Pedidos.</p>
      </div>`;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: NOTIFY_EMAIL,
        reply_to: order.email,
        subject: `${isTransfer ? 'Nuevo pedido (transferencia pendiente)' : 'Nuevo pedido pagado'} #${order.id} — ${order.nombre} ${order.apellido} — ${formatPrice(order.total)}`,
        html,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.json().catch(() => ({}));
      console.error('Error enviando email con Resend:', err);
      return json({ error: 'Error enviando el email', detail: err }, 500);
    }

    await supabase.from('orders').update({ business_notified_at: new Date().toISOString() }).eq('id', orderId);
    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ error: err.message }, 500);
  }
});
