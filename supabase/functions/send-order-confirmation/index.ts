// Edge Function: send-order-confirmation
// Manda un email de confirmación al cliente apenas se crea un pedido
// (tanto para transferencia como para Mercado Pago).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FROM_EMAIL = Deno.env.get('ORDERS_FROM_EMAIL') || 'Lad Flooring <onboarding@resend.dev>';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function formatPrice(n: number) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
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
    const { orderId } = await req.json();
    if (!orderId) return json({ error: 'Falta orderId' }, 400);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: order, error } = await supabase
      .from('orders')
      .select('*, order_items(qty, unit_price, variant, products(name))')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      console.error('Pedido no encontrado:', error);
      return json({ error: 'Pedido no encontrado' }, 404);
    }

    const itemsHtml = order.order_items.map((i: any) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #E3DCCE;">
          ${i.products ? i.products.name : 'Producto'}${i.variant ? ` <span style="color:#8199a3;">(${i.variant})</span>` : ''} × ${i.qty}
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #E3DCCE;text-align:right;">${formatPrice(i.unit_price * i.qty)}</td>
      </tr>`).join('');

    const paymentNote = order.payment_method === 'transferencia'
      ? 'Tu pago por transferencia quedó <strong>pendiente de aprobación</strong>. En cuanto confirmemos la acreditación, vamos a habilitar tu pedido y te avisamos por email.'
      : 'En cuanto Mercado Pago confirme tu pago, vamos a empezar a preparar tu pedido.';

    const html = `
      <div style="font-family:Georgia,'Georgia Pro',serif;color:#1D3A47;max-width:560px;margin:0 auto;padding:24px;">
        <h2 style="color:#1D3A47;margin-bottom:4px;">¡Gracias por tu compra, ${order.nombre}!</h2>
        <p style="color:#3C5763;">Recibimos tu pedido <strong>#${order.id}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          ${itemsHtml}
          <tr>
            <td style="padding:10px 0 0;font-weight:bold;">Total</td>
            <td style="padding:10px 0 0;font-weight:bold;text-align:right;">${formatPrice(order.total)}</td>
          </tr>
        </table>
        <p style="color:#3C5763;">${paymentNote}</p>
        <p style="color:#3C5763;">
          <strong>Envío a:</strong><br>
          ${order.direccion}${order.depto ? ', ' + order.depto : ''}, ${order.localidad}, ${order.provincia}
        </p>
        <p style="margin-top:28px;color:#8199a3;font-size:0.85rem;">Lad Flooring — Pisos de Madera</p>
      </div>`;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: order.email,
        subject: `Confirmación de tu pedido #${order.id} — Lad Flooring`,
        html,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.json().catch(() => ({}));
      console.error('Error enviando email con Resend:', err);
      return json({ error: 'Error enviando el email', detail: err }, 500);
    }

    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ error: err.message }, 500);
  }
});
