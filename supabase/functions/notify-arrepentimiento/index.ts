// Edge Function: notify-arrepentimiento
// Cuando alguien usa el Botón de arrepentimiento, manda dos emails:
//  - al cliente, la constancia con su código de solicitud (la norma pide enviarla dentro de las 24 hs);
//  - a Lad Flooring, el aviso con los datos para gestionarlo.
// Solo manda una vez por pedido (marca notified_at), así no se puede usar para mandar spam.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FROM_EMAIL = Deno.env.get('ORDERS_FROM_EMAIL') || 'Lad Flooring <onboarding@resend.dev>';
const NOTIFY_EMAIL = Deno.env.get('QUOTES_NOTIFY_EMAIL') || 'info@ladflooring.com';

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

async function sendEmail(payload: Record<string, unknown>) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, ...payload }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error('Resend: ' + JSON.stringify(err));
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { id } = await req.json();
    if (!id) return json({ error: 'Falta id' }, 400);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: a, error } = await supabase.from('arrepentimientos').select('*').eq('id', id).single();
    if (error || !a) return json({ error: 'Solicitud no encontrada' }, 404);
    if (a.notified_at) return json({ ok: true, alreadyNotified: true });

    const fecha = new Date(a.created_at).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
    const row = (label: string, value: string) =>
      `<tr><td style="padding:6px 12px 6px 0;color:#8199a3;vertical-align:top;">${label}</td><td style="padding:6px 0;">${value}</td></tr>`;
    const details = `
      <table style="border-collapse:collapse;margin:16px 0;">
        ${row('Código', `<strong>${esc(a.codigo)}</strong>`)}
        ${row('Fecha', esc(fecha))}
        ${row('Nombre', esc(a.nombre))}
        ${row('Email', esc(a.email))}
        ${a.telefono ? row('Teléfono', esc(a.telefono)) : ''}
        ${a.pedido ? row('Pedido', esc(a.pedido)) : ''}
        ${a.productos ? row('Productos', `<span style="white-space:pre-line;">${esc(a.productos)}</span>`) : ''}
        ${a.motivo ? row('Motivo', `<span style="white-space:pre-line;">${esc(a.motivo)}</span>`) : ''}
      </table>`;

    // Constancia para el cliente
    await sendEmail({
      to: a.email,
      reply_to: NOTIFY_EMAIL,
      subject: `Recibimos tu solicitud de arrepentimiento — ${a.codigo}`,
      html: `
        <div style="font-family:Georgia,'Georgia Pro',serif;color:#1D3A47;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="margin-bottom:4px;">Recibimos tu solicitud</h2>
          <p style="color:#3C5763;">Hola ${esc(a.nombre)}, registramos tu pedido para cancelar la compra (derecho de arrepentimiento). Tu código de solicitud es <strong>${esc(a.codigo)}</strong>: guardalo para cualquier consulta.</p>
          ${details}
          <p style="color:#3C5763;">Te vamos a contactar para coordinar la devolución del producto y el reintegro del dinero. Si tenés alguna duda, respondé este email o escribinos por WhatsApp al +54 9 11 2637-1921.</p>
          <p style="margin-top:28px;color:#8199a3;font-size:0.85rem;">Lad Flooring — Pisos de Madera</p>
        </div>`,
    });

    // Aviso para Lad Flooring
    await sendEmail({
      to: NOTIFY_EMAIL,
      reply_to: a.email,
      subject: `Botón de arrepentimiento: ${a.nombre}${a.pedido ? ' — pedido ' + a.pedido : ''} (${a.codigo})`,
      html: `
        <div style="font-family:Georgia,'Georgia Pro',serif;color:#1D3A47;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="margin-bottom:4px;">Nueva solicitud de arrepentimiento</h2>
          <p style="color:#3C5763;margin-top:0;">Un cliente pidió cancelar su compra desde el Botón de arrepentimiento. Ya le llegó la constancia con el código.</p>
          ${details}
          <p style="color:#3C5763;">Hay que contactarlo para coordinar la devolución y el reintegro.</p>
          <p style="margin-top:28px;color:#8199a3;font-size:0.85rem;">Lo tenés también en ladflooring.com/admin.html → Arrepentimientos.</p>
        </div>`,
    });

    await supabase.from('arrepentimientos').update({ notified_at: new Date().toISOString() }).eq('id', id);
    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ error: err.message }, 500);
  }
});
