// Edge Function: unsubscribe
// Link público (sin login) que va en el pie de cada email del newsletter.
// Borra al suscriptor por su id y muestra una confirmación simple en HTML.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function page(body: string) {
  return new Response(
    `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Lad Flooring</title></head>
    <body style="font-family:Georgia,'Georgia Pro',serif;color:#1D3A47;text-align:center;padding:80px 20px;background:#FBF8F2;">${body}</body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return page('<p>Falta el identificador de la suscripción.</p>');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await supabase.from('newsletter_subscribers').delete().eq('id', id);

  if (error) {
    console.error(error);
    return page('<p>No pudimos procesar tu baja. Escribinos a info@ladflooring.com.</p>');
  }

  return page('<h2>Listo</h2><p>Te diste de baja del newsletter de Lad Flooring.</p>');
});
