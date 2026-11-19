// Edge Function: sync-orders-sheet
// Copia cada pedido a una planilla de Google Sheets, para tener un registro fuera del admin.
// La dispara un Database Webhook de Supabase sobre la tabla "orders" (INSERT, UPDATE y DELETE):
//  - pedido nuevo o cambio de pago, envío o seguimiento → crea o actualiza la fila del pedido;
//  - pedido eliminado → borra la fila.
// La planilla recibe los datos con un Apps Script publicado como aplicación web (google-sheets/Codigo.gs).
//
// Secretos (Supabase → Edge Functions → Secrets):
//   SHEETS_WEBHOOK_URL  la URL de la aplicación web del Apps Script
//   SHEETS_SECRET       una clave cualquiera; la misma va en el Apps Script y en el header
//                       "x-sync-secret" del Database Webhook, así nadie más puede escribir en la planilla

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SHEETS_WEBHOOK_URL = Deno.env.get('SHEETS_WEBHOOK_URL') || '';
const SHEETS_SECRET = Deno.env.get('SHEETS_SECRET') || '';

// Solo vale la pena actualizar la planilla si cambió algo de esto (no por las marcas internas de emails)
const RELEVANT_FIELDS = [
  'nombre', 'apellido', 'email', 'telefono', 'direccion', 'depto', 'localidad', 'provincia', 'codigo_postal', 'notas',
  'shipping_zone', 'shipping_cost', 'subtotal', 'total', 'payment_method', 'payment_status', 'order_status',
  'shipping_carrier', 'tracking_number',
];

const PAYMENT_METHOD: Record<string, string> = { mp: 'Mercado Pago', transferencia: 'Transferencia' };
const PAYMENT_STATUS: Record<string, string> = { pendiente: 'Pendiente', aprobado: 'Aprobado', rechazado: 'Rechazado' };
const ORDER_STATUS: Record<string, string> = { preparando: 'Preparando', despachado: 'Despachado', en_camino: 'En camino', entregado: 'Entregado' };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function sendToSheet(payload: Record<string, unknown>) {
  const res = await fetch(SHEETS_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: SHEETS_SECRET, ...payload }),
  });
  const text = await res.text();
  if (!res.ok || text.trim() !== 'ok') throw new Error(`La planilla respondió ${res.status}: ${text.slice(0, 200)}`);
}

Deno.serve(async (req) => {
  try {
    if (!SHEETS_WEBHOOK_URL || !SHEETS_SECRET) return json({ error: 'Faltan SHEETS_WEBHOOK_URL o SHEETS_SECRET' }, 500);
    if (req.headers.get('x-sync-secret') !== SHEETS_SECRET) return json({ error: 'No autorizado' }, 401);

    const { type, record, old_record } = await req.json();

    if (type === 'DELETE') {
      if (old_record?.id == null) return json({ ok: true, skipped: 'sin id' });
      await sendToSheet({ action: 'delete', id: String(old_record.id) });
      return json({ ok: true, deleted: old_record.id });
    }

    if (!record?.id) return json({ ok: true, skipped: 'sin registro' });
    if (type === 'UPDATE' && old_record && RELEVANT_FIELDS.every((f) => String(record[f] ?? '') === String(old_record[f] ?? ''))) {
      return json({ ok: true, skipped: 'sin cambios relevantes' });
    }

    // En un pedido nuevo, los productos se guardan un instante después que el pedido: esperamos un poco
    if (type === 'INSERT') await new Promise((r) => setTimeout(r, 3000));

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: order, error } = await supabase
      .from('orders')
      .select('*, order_items(qty, unit_price, variant, products(name))')
      .eq('id', record.id)
      .maybeSingle();
    if (error) throw error;
    if (!order) return json({ ok: true, skipped: 'el pedido ya no existe' });

    const productos = (order.order_items || [])
      .map((i: any) => `${i.qty} × ${i.products?.name || 'Producto'}${i.variant ? ` (${i.variant})` : ''}`)
      .join('; ');

    await sendToSheet({
      action: 'upsert',
      row: {
        'Pedido': String(order.id),
        'Fecha': new Date(order.created_at).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }),
        'Cliente': `${order.nombre || ''} ${order.apellido || ''}`.trim(),
        'Email': order.email || '',
        'Teléfono': order.telefono || '',
        'Dirección': [order.direccion, order.depto].filter(Boolean).join(' '),
        'Localidad': order.localidad || '',
        'Provincia': order.provincia || '',
        'Código postal': order.codigo_postal || '',
        'Productos': productos,
        'Subtotal': Number(order.subtotal) || 0,
        'Envío': Number(order.shipping_cost) || 0,
        'Tipo de envío': order.shipping_zone || '',
        'Total': Number(order.total) || 0,
        'Medio de pago': PAYMENT_METHOD[order.payment_method] || order.payment_method || '',
        'Estado del pago': PAYMENT_STATUS[order.payment_status] || order.payment_status || '',
        'Estado del envío': ORDER_STATUS[order.order_status] || order.order_status || '',
        'Empresa de envío': order.shipping_carrier || '',
        'N° de seguimiento': order.tracking_number || '',
        'Notas': order.notas || '',
        'Actualizado': new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }),
      },
    });
    return json({ ok: true, synced: order.id });
  } catch (err) {
    console.error(err);
    return json({ error: err.message }, 500);
  }
});
