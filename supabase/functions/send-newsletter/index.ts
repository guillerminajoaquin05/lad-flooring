// Edge Function: send-newsletter
// Manda un email a todos los suscriptores del newsletter. Solo puede
// invocarla un usuario logueado con rol admin (se verifica acá, no confiamos
// en el front). Cada email se manda por separado (no en un solo "to" con
// varios destinatarios) para no exponer las direcciones de unos a otros, e
// incluye un link de baja individual.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FROM_EMAIL = Deno.env.get('ORDERS_FROM_EMAIL') || 'Lad Flooring <onboarding@resend.dev>';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Verificamos que quien llama esté logueado y sea admin.
    const authHeader = req.headers.get('Authorization') ?? '';
    const authed = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await authed.auth.getUser();
    if (userError || !userData.user) return json({ error: 'No autenticado' }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: profile, error: profileError } = await admin.from('profiles').select('role').eq('id', userData.user.id).single();
    if (profileError) {
      console.error('Error consultando el perfil del usuario:', profileError);
      return json({ error: 'Error verificando permisos: ' + profileError.message }, 500);
    }
    if (!profile || profile.role !== 'admin') return json({ error: 'No tenés permisos de administrador' }, 403);

    // 2. Validamos el contenido del email.
    const { subject, message, imageUrl } = await req.json();
    if (!subject || !message) return json({ error: 'Falta el asunto o el mensaje' }, 400);

    // 3. Mandamos un email individual a cada suscriptor.
    const { data: subscribers, error: subsError } = await admin.from('newsletter_subscribers').select('id, email');
    if (subsError) throw subsError;
    if (!subscribers || subscribers.length === 0) return json({ ok: true, sent: 0, failed: [] });

    let sent = 0;
    const failed: string[] = [];

    for (const sub of subscribers) {
      const unsubscribeUrl = `${SUPABASE_URL}/functions/v1/unsubscribe?id=${sub.id}`;
      const html = `
        <div style="font-family:Georgia,'Georgia Pro',serif;color:#1D3A47;max-width:560px;margin:0 auto;padding:24px;">
          ${imageUrl ? `<img src="${imageUrl}" alt="" style="max-width:100%;border-radius:8px;margin-bottom:20px;display:block;">` : ''}
          <p style="white-space:pre-line;color:#3C5763;">${message}</p>
          <p style="margin-top:28px;color:#8199a3;font-size:0.8rem;">
            Lad Flooring — Pisos de Madera<br>
            <a href="${unsubscribeUrl}" style="color:#8199a3;">Darse de baja del newsletter</a>
          </p>
        </div>`;

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM_EMAIL, to: sub.email, subject, html }),
      });

      if (res.ok) sent++;
      else failed.push(sub.email);
    }

    // 4. Guardamos el envío en el historial para poder revisarlo después desde el admin.
    const { error: historyError } = await admin.from('newsletter_sends').insert({
      subject,
      message,
      image_url: imageUrl || null,
      sent_count: sent,
      recipient_count: subscribers.length,
    });
    if (historyError) console.error('Error guardando el historial del newsletter:', historyError);

    return json({ ok: true, sent, failed });
  } catch (err) {
    console.error(err);
    return json({ error: err.message }, 500);
  }
});
