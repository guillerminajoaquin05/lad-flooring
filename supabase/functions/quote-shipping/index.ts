// Edge Function: quote-shipping
// Calcula el costo de envío de un carrito. Es la única fuente de verdad del envío: la usan el checkout
// (para mostrarlo) y create-order / create-mp-preference (para cobrarlo).
//
// - Si están cargadas las credenciales de Correo Argentino (MiCorreo) y el código postal de origen,
//   cotiza en vivo un envío a domicilio (API MiCorreo, POST /rates) y le suma el recargo configurado.
// - Si no, o si Correo no responde, usa la tarifa fija por zona según la provincia.
//
// Secretos (Supabase → Edge Functions → Secrets), cuando Correo entregue las credenciales:
//   CORREO_API_USER, CORREO_API_PASSWORD  usuario y clave de la API (los da Correo, distintos para test y producción)
//   CORREO_CUSTOMER_ID                    id de cliente de MiCorreo; si no se carga, se obtiene con
//   CORREO_EMAIL, CORREO_PASSWORD         el email y la contraseña de la cuenta MiCorreo
//   CORREO_ENV                            "test" para el ambiente de prueba; vacío = producción

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const CORREO_API_USER = Deno.env.get('CORREO_API_USER') || '';
const CORREO_API_PASSWORD = Deno.env.get('CORREO_API_PASSWORD') || '';
const CORREO_EMAIL = Deno.env.get('CORREO_EMAIL') || '';
const CORREO_PASSWORD = Deno.env.get('CORREO_PASSWORD') || '';
const CORREO_BASE = Deno.env.get('CORREO_ENV') === 'test'
  ? 'https://apitest.correoargentino.com.ar/micorreo/v1'
  : 'https://api.correoargentino.com.ar/micorreo/v1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/* Tarifa fija por zona: se usa mientras no esté conectado Correo Argentino, o si no responde */
const SHIPPING_ZONES: Record<string, { label: string; price: number }> = {
  caba: { label: 'Envío CABA', price: 4500 },
  gba: { label: 'Envío GBA', price: 6800 },
  cercano: { label: 'Envío Interior (zona cercana)', price: 8900 },
  lejano: { label: 'Envío Interior (zona lejana)', price: 13500 },
};
const PROVINCE_ZONES: Record<string, string> = {
  'Ciudad Autónoma de Buenos Aires': 'caba',
  'Buenos Aires': 'gba',
  'Córdoba': 'cercano', 'Entre Ríos': 'cercano', 'La Pampa': 'cercano', 'Mendoza': 'cercano',
  'San Juan': 'cercano', 'San Luis': 'cercano', 'Santa Fe': 'cercano',
  'Catamarca': 'lejano', 'Chaco': 'lejano', 'Chubut': 'lejano', 'Corrientes': 'lejano', 'Formosa': 'lejano',
  'Jujuy': 'lejano', 'La Rioja': 'lejano', 'Misiones': 'lejano', 'Neuquén': 'lejano', 'Río Negro': 'lejano',
  'Salta': 'lejano', 'Santa Cruz': 'lejano', 'Santiago del Estero': 'lejano', 'Tierra del Fuego': 'lejano',
  'Tucumán': 'lejano',
};

// Producto sin peso/medidas cargados: lo tratamos como una caja de 1 kg de 10 x 10 x 10 cm
const DEFAULT_PACKAGE = { weight: 1000, length: 10, width: 10, height: 10 };
// Límites de la cotización de MiCorreo
const MAX_WEIGHT_G = 25000;
const MAX_SIDE_CM = 150;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// "C1425ABC", "1425", "B1842ZAB" → "1425"
function normalizePostalCode(cp: unknown) {
  const m = String(cp ?? '').match(/\d{4}/);
  return m ? m[0] : null;
}

/* Token y customerId de MiCorreo, guardados en memoria mientras la función siga activa */
let cachedToken: { token: string; expiresAt: number } | null = null;
let cachedCustomerId: string | null = Deno.env.get('CORREO_CUSTOMER_ID') || null;

async function correoToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;
  const res = await fetch(`${CORREO_BASE}/token`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(`${CORREO_API_USER}:${CORREO_API_PASSWORD}`) },
  });
  if (!res.ok) throw new Error(`Correo /token ${res.status}`);
  const data = await res.json();
  // "expires": "2022-04-26 21:16:20" (hora de Argentina). Si no se puede leer, lo renovamos en 30 minutos.
  const parsed = Date.parse(String(data.expires || '').replace(' ', 'T') + '-03:00');
  cachedToken = { token: data.token, expiresAt: Number.isFinite(parsed) ? parsed : Date.now() + 30 * 60_000 };
  return cachedToken.token;
}

async function correoCustomerId(token: string) {
  if (cachedCustomerId) return cachedCustomerId;
  const res = await fetch(`${CORREO_BASE}/users/validate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: CORREO_EMAIL, password: CORREO_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Correo /users/validate ${res.status}`);
  cachedCustomerId = (await res.json()).customerId;
  return cachedCustomerId!;
}

async function correoHomeRate(originCp: string, destCp: string, pkg: typeof DEFAULT_PACKAGE) {
  const token = await correoToken();
  const customerId = await correoCustomerId(token);
  const res = await fetch(`${CORREO_BASE}/rates`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerId,
      postalCodeOrigin: originCp,
      postalCodeDestination: destCp,
      deliveredType: 'D',
      dimensions: pkg,
    }),
  });
  if (!res.ok) throw new Error(`Correo /rates ${res.status}: ${await res.text()}`);
  const rates = ((await res.json()).rates || []).filter((r: any) => r.deliveredType === 'D' && Number(r.price) > 0);
  if (!rates.length) throw new Error('Correo no devolvió tarifas a domicilio');
  // La más barata (normalmente "Paq.ar Clásico")
  return rates.sort((a: any, b: any) => Number(a.price) - Number(b.price))[0];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { items, postalCode, provincia } = await req.json();

    const zoneKey = PROVINCE_ZONES[provincia];
    if (!zoneKey) return json({ error: 'Provincia de envío inválida' }, 400);
    const fixed = { source: 'fixed', price: SHIPPING_ZONES[zoneKey].price, label: SHIPPING_ZONES[zoneKey].label };

    const correoReady = CORREO_API_USER && CORREO_API_PASSWORD && (cachedCustomerId || (CORREO_EMAIL && CORREO_PASSWORD));
    if (!correoReady) return json(fixed);

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: setting } = await supabase.from('site_settings').select('value').eq('key', 'envios').maybeSingle();
    const originCp = normalizePostalCode(setting?.value?.origen_cp);
    const recargo = Math.max(0, Number(setting?.value?.recargo) || 0);
    const destCp = normalizePostalCode(postalCode);
    if (!originCp || !destCp || !Array.isArray(items) || !items.length) return json(fixed);

    // Armamos un solo paquete: suma de pesos, el largo y el ancho del producto más grande,
    // y las alturas apiladas (criterio de los plugins de MiCorreo).
    const ids = [...new Set(items.map((i: any) => i.id))];
    const { data: products } = await supabase
      .from('products')
      .select('id, weight_g, length_cm, width_cm, height_cm')
      .in('id', ids);
    const byId = new Map((products || []).map((p: any) => [p.id, p]));
    const pkg = { weight: 0, length: 0, width: 0, height: 0 };
    for (const i of items) {
      const qty = Math.max(1, parseInt(i.qty) || 1);
      const p: any = byId.get(i.id) || {};
      const w = p.weight_g || DEFAULT_PACKAGE.weight;
      const l = p.length_cm || DEFAULT_PACKAGE.length;
      const wd = p.width_cm || DEFAULT_PACKAGE.width;
      const h = p.height_cm || DEFAULT_PACKAGE.height;
      pkg.weight += w * qty;
      pkg.length = Math.max(pkg.length, l);
      pkg.width = Math.max(pkg.width, wd);
      pkg.height += h * qty;
    }
    pkg.height = Math.min(pkg.height, MAX_SIDE_CM);
    // Demasiado grande o pesado para una sola cotización: tarifa fija (se coordina aparte)
    if (pkg.weight > MAX_WEIGHT_G || pkg.length > MAX_SIDE_CM || pkg.width > MAX_SIDE_CM) return json(fixed);

    try {
      const rate = await correoHomeRate(originCp, destCp, pkg);
      return json({
        source: 'correo',
        price: Math.ceil(Number(rate.price) + recargo),
        label: `Correo Argentino — ${rate.productName || 'envío'} a domicilio`,
        deliveryTimeMin: rate.deliveryTimeMin || null,
        deliveryTimeMax: rate.deliveryTimeMax || null,
      });
    } catch (e) {
      console.error('No se pudo cotizar con Correo Argentino, uso tarifa fija:', e);
      return json(fixed);
    }
  } catch (err) {
    console.error(err);
    return json({ error: err.message }, 500);
  }
});
