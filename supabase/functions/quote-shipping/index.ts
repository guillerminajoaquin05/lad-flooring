// Edge Function: quote-shipping
// Calcula el costo de envío de un carrito. Es la única fuente de verdad del envío: la usan el checkout
// (para mostrarlo) y create-order / create-mp-preference (para cobrarlo).
//
// - Si está configurada la cuenta de Andreani, cotiza en vivo un envío a domicilio y le suma el recargo
//   configurado en el admin.
// - Si no, o si Andreani no responde, usa la tarifa fija por zona según la provincia.
//
// Secretos (Supabase → Edge Functions → Secrets). El cotizador de Andreani es público: no hace falta clave de API.
//   ANDREANI_CLIENTE, ANDREANI_CONTRATO   número de cliente y de contrato de la cuenta de Andreani
//   ANDREANI_SUCURSAL                     opcional: sucursal de origen, si el contrato la pide
//
// Correo Argentino (API MiCorreo) estuvo integrado y se sacó a pedido mientras no lleguen sus credenciales.
// Para volver a sumarlo como segunda opción, el código está en el historial de git (commit b2176b0).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const ANDREANI_CLIENTE = Deno.env.get('ANDREANI_CLIENTE') || '';
const ANDREANI_CONTRATO = Deno.env.get('ANDREANI_CONTRATO') || '';
const ANDREANI_SUCURSAL = Deno.env.get('ANDREANI_SUCURSAL') || '';
const ANDREANI_BASE = 'https://apis.andreani.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/* Tarifa fija por zona: se usa mientras no esté conectado Andreani, o si no responde */
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
// Más que esto no se cotiza en vivo: se cobra la tarifa fija y el envío se coordina aparte
const MAX_WEIGHT_G = 50000;
const MAX_SIDE_CM = 200;

type Dim = { quantity: number; weight: number; height: number; width: number; length: number };

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

/* Cotizador de Andreani (GET /v1/tarifas): solo necesita el número de cliente y de contrato de la cuenta.
   El origen sale del contrato. Volumen en cm³, peso en kilos y valor declarado en pesos. */
async function andreaniHomeRate(destCp: string, dims: Dim[], declaredValue: number) {
  const volume = dims.reduce((s, d) => s + d.length * d.width * d.height * d.quantity, 0);
  const kilos = dims.reduce((s, d) => s + d.weight * d.quantity, 0) / 1000;
  const params = new URLSearchParams({
    cpDestino: destCp,
    contrato: ANDREANI_CONTRATO,
    cliente: ANDREANI_CLIENTE,
    sucursalOrigen: ANDREANI_SUCURSAL,
    'bultos[0][valorDeclarado]': String(Math.max(1, Math.round(declaredValue))),
    'bultos[0][volumen]': String(Math.max(1, Math.round(volume))),
    'bultos[0][kilos]': String(Math.max(0.01, Math.round(kilos * 100) / 100)),
  });
  const res = await fetch(`${ANDREANI_BASE}/v1/tarifas?${params}`);
  if (!res.ok) throw new Error(`Andreani /v1/tarifas ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const price = parseFloat(data?.tarifaConIva?.total);
  if (!(price > 0)) throw new Error('Andreani no devolvió una tarifa');
  return price;
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

    if (!ANDREANI_CLIENTE || !ANDREANI_CONTRATO) return json(fixed);
    const destCp = normalizePostalCode(postalCode);
    if (!destCp || !Array.isArray(items) || !items.length) return json(fixed);

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: setting } = await supabase.from('site_settings').select('value').eq('key', 'envios').maybeSingle();
    const recargo = Math.max(0, Number(setting?.value?.recargo) || 0);

    // Peso, medidas y precio de cada producto (los que no tienen peso/medidas usan la caja por defecto)
    const ids = [...new Set(items.map((i: any) => i.id))];
    const { data: products } = await supabase
      .from('products')
      .select('id, price, weight_g, length_cm, width_cm, height_cm')
      .in('id', ids);
    const byId = new Map((products || []).map((p: any) => [p.id, p]));
    const dims: Dim[] = items.map((i: any) => {
      const p: any = byId.get(i.id) || {};
      return {
        quantity: Math.max(1, parseInt(i.qty) || 1),
        weight: p.weight_g || DEFAULT_PACKAGE.weight,
        height: p.height_cm || DEFAULT_PACKAGE.height,
        width: p.width_cm || DEFAULT_PACKAGE.width,
        length: p.length_cm || DEFAULT_PACKAGE.length,
      };
    });
    const declaredValue = items.reduce((s: number, i: any) => s + (Number(byId.get(i.id)?.price) || 0) * Math.max(1, parseInt(i.qty) || 1), 0);
    const totalWeight = dims.reduce((s, d) => s + d.weight * d.quantity, 0);
    if (totalWeight > MAX_WEIGHT_G || dims.some((d) => Math.max(d.height, d.width, d.length) > MAX_SIDE_CM)) return json(fixed);

    try {
      const price = await andreaniHomeRate(destCp, dims, declaredValue);
      return json({
        source: 'andreani',
        price: Math.ceil(price + recargo),
        label: 'Andreani — envío a domicilio',
        deliveryTimeMin: null,
        deliveryTimeMax: null,
      });
    } catch (e) {
      console.error('No se pudo cotizar con Andreani, uso tarifa fija:', e);
      return json(fixed);
    }
  } catch (err) {
    console.error(err);
    return json({ error: err.message }, 500);
  }
});
