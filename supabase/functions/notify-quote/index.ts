// Edge Function: notify-quote
// Avisa por email a Lad Flooring cada vez que alguien envía el formulario "Cotizá Tu Proyecto".
// Solo manda un aviso por cotización (marca notified_at), así no se puede usar para mandar spam.

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

const ETAPAS: Record<string, string> = {
  'obra-en-curso': 'Obra en curso',
  'a-refaccionar': 'A refaccionar',
  'desde-cero': 'Proyecto desde cero',
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
    const { quoteId } = await req.json();
    if (!quoteId) return json({ error: 'Falta quoteId' }, 400);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: q, error } = await supabase.from('cotizaciones').select('*').eq('id', quoteId).single();
    if (error || !q) return json({ error: 'Cotización no encontrada' }, 404);
    if (q.notified_at) return json({ ok: true, alreadyNotified: true });

    // Links temporales (7 días) para abrir los archivos adjuntos desde el email
    let filesHtml = '';
    if (q.files.length) {
      const { data: signed } = await supabase.storage.from('quote-files').createSignedUrls(q.files, 60 * 60 * 24 * 7);
      filesHtml = `<p><strong>Archivos adjuntos</strong> (links válidos por 7 días; también los ves en el admin):<br>${
        (signed || []).map((s: any, i: number) => s.signedUrl
          ? `<a href="${s.signedUrl}">${esc(q.files[i].split('/').pop())}</a>`
          : esc(q.files[i].split('/').pop())).join('<br>')
      }</p>`;
    }

    const row = (label: string, value: string) =>
      `<tr><td style="padding:6px 12px 6px 0;color:#8199a3;vertical-align:top;">${label}</td><td style="padding:6px 0;">${value}</td></tr>`;

    const html = `
      <div style="font-family:Georgia,'Georgia Pro',serif;color:#1D3A47;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="margin-bottom:4px;">Nuevo pedido de cotización</h2>
        <p style="color:#3C5763;margin-top:0;">${esc(q.nombre)} ${esc(q.apellido)} completó el formulario de la web.</p>
        <table style="border-collapse:collapse;margin:16px 0;">
          ${row('Email', `<a href="mailto:${esc(q.email)}">${esc(q.email)}</a>`)}
          ${row('Teléfono', esc(q.telefono))}
          ${row('Ubicación', `${esc(q.localidad)}, ${esc(q.provincia)}`)}
          ${row('Superficie', `${esc(q.superficie)} m²`)}
          ${row('Etapa', esc(ETAPAS[q.etapa] || q.etapa))}
          ${row('Módulos', esc(q.modulos.join(', ')))}
        </table>
        ${q.comentarios ? `<p><strong>Comentarios</strong><br><span style="white-space:pre-line;">${esc(q.comentarios)}</span></p>` : ''}
        ${filesHtml}
        <p style="margin-top:28px;color:#8199a3;font-size:0.85rem;">Lo tenés también en ladflooring.com/admin.html → Cotizaciones.</p>
      </div>`;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: NOTIFY_EMAIL,
        reply_to: q.email,
        subject: `Nueva cotización: ${q.nombre} ${q.apellido} — ${q.localidad} (${q.superficie} m²)`,
        html,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.json().catch(() => ({}));
      console.error('Error enviando email con Resend:', err);
      return json({ error: 'Error enviando el email', detail: err }, 500);
    }

    await supabase.from('cotizaciones').update({ notified_at: new Date().toISOString() }).eq('id', quoteId);
    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ error: err.message }, 500);
  }
});
