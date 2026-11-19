/**
 * Planilla de pedidos de Lad Flooring.
 * Recibe los pedidos que manda la función sync-orders-sheet de Supabase y los escribe en la hoja "Pedidos":
 * una fila por pedido, que se actualiza cuando cambia el pago, el envío o el seguimiento, y se borra si
 * el pedido se elimina en el admin.
 *
 * Cómo instalarlo: en la planilla, Extensiones → Apps Script → pegar todo este archivo → cambiar CLAVE →
 * Implementar → Nueva implementación → Aplicación web (Ejecutar como: Yo · Quién tiene acceso: Cualquier persona).
 */

// La misma clave que el secreto SHEETS_SECRET de Supabase. Cambiala por una tuya, larga y sin espacios.
const CLAVE = 'CAMBIAR-ESTA-CLAVE';

const HOJA = 'Pedidos';
const COLUMNAS = [
  'Pedido', 'Fecha', 'Cliente', 'Email', 'Teléfono', 'Dirección', 'Localidad', 'Provincia', 'Código postal',
  'Productos', 'Subtotal', 'Envío', 'Tipo de envío', 'Total', 'Medio de pago', 'Estado del pago',
  'Estado del envío', 'Empresa de envío', 'N° de seguimiento', 'Notas', 'Actualizado',
];
const COLUMNAS_PLATA = ['Subtotal', 'Envío', 'Total'];
// Como texto, para que la planilla no les saque ceros ni los convierta en números
const COLUMNAS_TEXTO = ['Pedido', 'Teléfono', 'Código postal', 'N° de seguimiento'];

function doPost(e) {
  let datos;
  try {
    datos = JSON.parse(e.postData.contents);
  } catch (err) {
    return respuesta('error: datos inválidos');
  }
  if (datos.token !== CLAVE) return respuesta('error: no autorizado');

  // Evita que dos avisos al mismo tiempo escriban la misma fila
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const hoja = obtenerHoja();
    if (datos.action === 'delete') {
      const fila = buscarFila(hoja, datos.id);
      if (fila) hoja.deleteRow(fila);
      return respuesta('ok');
    }
    if (datos.action === 'upsert' && datos.row) {
      const valores = COLUMNAS.map(function (c) { return datos.row[c] !== undefined ? datos.row[c] : ''; });
      const fila = buscarFila(hoja, datos.row['Pedido']);
      if (fila) {
        hoja.getRange(fila, 1, 1, COLUMNAS.length).setValues([valores]);
      } else {
        hoja.appendRow(valores);
      }
      return respuesta('ok');
    }
    return respuesta('error: acción desconocida');
  } finally {
    lock.releaseLock();
  }
}

// Crea la hoja con los encabezados la primera vez
function obtenerHoja() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = libro.getSheetByName(HOJA);
  if (!hoja) hoja = libro.insertSheet(HOJA);
  if (hoja.getLastRow() === 0) {
    hoja.appendRow(COLUMNAS);
    hoja.getRange(1, 1, 1, COLUMNAS.length).setFontWeight('bold').setBackground('#1D3A47').setFontColor('#FFFFFF');
    hoja.setFrozenRows(1);
    COLUMNAS_PLATA.forEach(function (c) {
      hoja.getRange(2, COLUMNAS.indexOf(c) + 1, hoja.getMaxRows() - 1, 1).setNumberFormat('$ #,##0');
    });
    COLUMNAS_TEXTO.forEach(function (c) {
      hoja.getRange(2, COLUMNAS.indexOf(c) + 1, hoja.getMaxRows() - 1, 1).setNumberFormat('@');
    });
  }
  return hoja;
}

// Fila (número) del pedido según la columna "Pedido", o null si todavía no está
function buscarFila(hoja, id) {
  const ultima = hoja.getLastRow();
  if (ultima < 2) return null;
  const ids = hoja.getRange(2, 1, ultima - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return null;
}

function respuesta(texto) {
  return ContentService.createTextOutput(texto).setMimeType(ContentService.MimeType.TEXT);
}
