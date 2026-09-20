/** June–Aug ledger Internal Transfer + opening stock → live df_stock_transfers. Not Fiberkapp silo. */
import { readLs, writeLs } from './ls-rows.js';

const KEY = 'df_stock_transfers';
const FLAG = 'df_ledger_transfers_v1';

function codeOf(name) {
  const n = String(name || '').toLowerCase();
  if (/main warehouse|phone stock|head office/.test(n)) return 'OPS-HUB';
  if (/fiberk shop/.test(n)) return 'FIB-SHOP';
  if (/retail shop|christy/.test(n)) return 'FIB-SHOP';
  if (/easybuy|baaba/.test(n)) return 'BNPL-FIELD';
  return 'BNPL-FIELD';
}

function dmy(s) {
  const m = String(s).match(/^(\d{2})-([A-Za-z]{3})-(\d{2})$/);
  if (!m) return s;
  const mo = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' }[m[2]] || '01';
  return `20${m[3]}-${mo}-${m[1]}`;
}

/** [date, product, qty, from, to, kind] — from the uploaded Ledger sheet. */
const ROWS = [
  ['04-Jun-26', 'TECNO Spark 50 (4 + 128)GB', 2, 'Main Warehouse', 'Annabel', 'opening'],
  ['04-Jun-26', 'TECNO Pop 20 (4 + 128)GB', 1, 'Main Warehouse', 'Annabel', 'opening'],
  ['04-Jun-26', 'ITEL City 200 (4+128)GB', 1, 'Main Warehouse', 'F. Easybuy (E. Baaba)', 'opening'],
  ['04-Jun-26', 'TECNO Camon 50 (8 + 256)GB', 1, 'Main Warehouse', 'F. Easybuy (E. Baaba)', 'opening'],
  ['04-Jun-26', 'TECNO Spark 50 (4 + 128)GB', 1, 'Main Warehouse', 'F. Easybuy (E. Baaba)', 'opening'],
  ['04-Jun-26', 'TECNO Spark 50 (4 + 128)GB', 2, 'Main Warehouse', 'Ivy', 'opening'],
  ['04-Jun-26', 'TECNO Spark 50 (4 + 128)GB', 1, 'Main Warehouse', 'Susana', 'opening'],
  ['04-Jun-26', 'TECNO Spark 50 (4 + 128)GB', 1, 'Main Warehouse', 'Mercy', 'opening'],
  ['04-Jun-26', 'ITEL A200 (3+128)GB', 1, 'Main Warehouse', 'Mercy', 'opening'],
  ['04-Jun-26', 'ITEL A200 (3+128)GB', 1, 'Main Warehouse', 'Patience', 'opening'],
  ['04-Jun-26', 'TECNO Pop 20 (4 + 128)GB', 1, 'Main Warehouse', 'Patience', 'opening'],
  ['04-Jun-26', 'TECNO Pop 20 (4 + 64)GB', 1, 'Main Warehouse', 'Diana', 'opening'],
  ['04-Jun-26', 'TECNO Pop 20 (4 + 128)GB', 1, 'Main Warehouse', 'Diana', 'opening'],
  ['04-Jun-26', 'TECNO Camon 50 PRO (8 + 256)GB', 1, 'Main Warehouse', 'Akinola', 'opening'],
  ['04-Jul-26', 'INFINIX Smart 20 (4+64)GB', 1, 'Main Warehouse', 'Gifty', 'opening'],
  ['04-Jul-26', 'INFINIX Smart 20 (4+64)GB', 1, 'Main Warehouse', 'Annabel', 'opening'],
  ['15-Jun-26', 'TECNO Spark 50 (4 + 128)GB', 1, 'Mercy', 'Abel', 'transfer'],
  ['15-Jun-26', 'TECNO Spark 50 (4 + 128)GB', 1, 'Susana', 'Wisdom', 'transfer'],
  ['15-Jun-26', 'TECNO Spark 50 (4 + 128)GB', 1, 'Ivy', 'F. Easybuy (E. Baaba)', 'transfer'],
  ['15-Jun-26', 'TECNO Camon 50 (8 + 256)GB', 1, 'F. Easybuy (E. Baaba)', 'Abel', 'transfer'],
  ['19-Jun-26', 'INFINIX Smart 20 (4+64)GB', 1, 'F. Easybuy (E. Baaba)', 'Ivy', 'transfer'],
  ['19-Jun-26', 'TECNO Spark 50 (4 + 128)GB', 1, 'F. Easybuy (E. Baaba)', 'Bright', 'transfer'],
  ['19-Jun-26', 'TECNO Pop 20 (4 + 128)GB', 1, 'Patience', 'Bright', 'transfer'],
  ['19-Jun-26', 'ITEL A200 (3+128)GB', 1, 'Patience', 'F. Easybuy (E. Baaba)', 'transfer'],
  ['02-Jul-26', 'ITEL A200 (3+128)GB', 1, 'Aaron(Somy.)', 'Bright', 'transfer'],
  ['02-Jul-26', 'ITEL A200 (3+64)GB', 1, 'Aaron(Somy.)', 'Bright', 'transfer'],
  ['02-Jul-26', 'INFINIX Hot 70 (4+128)GB', 2, 'Aaron(Somy.)', 'Bright', 'transfer'],
  ['02-Jul-26', 'INFINIX Smart 20 (4+128)GB', 2, 'Aaron(Somy.)', 'Bright', 'transfer'],
  ['02-Jul-26', 'INFINIX Smart 20 (4+128)GB', 3, 'Nathan (Asut.)', 'Bright', 'transfer'],
  ['02-Jul-26', 'INFINIX Hot 70 (4+128)GB', 3, 'Nathan (Asut.)', 'Bright', 'transfer'],
  ['02-Jul-26', 'ITEL A200 (3+64)GB', 1, 'Nathan (Asut.)', 'Bright', 'transfer'],
  ['02-Jul-26', 'ITEL A200 (3+128)GB', 1, 'Nathan (Asut.)', 'Bright', 'transfer'],
  ['02-Jul-26', 'INFINIX Hot 70 (4+128)GB', 1, 'F. Easybuy (E. Baaba)', 'Bright', 'transfer'],
  ['02-Jul-26', 'ITEL A200 (3+128)GB', 2, 'F. Easybuy (E. Baaba)', 'Bright', 'transfer'],
  ['02-Jul-26', 'TECNO Camon 50 PRO (8 + 256)GB', 1, 'F. Easybuy (E. Baaba)', 'Bright', 'transfer'],
  ['02-Jul-26', 'TECNO Pop 20 (4 + 64)GB', 2, 'F. Easybuy (E. Baaba)', 'Bright', 'transfer'],
  ['02-Jul-26', 'TECNO Spark 50 (4 + 128)GB', 3, 'F. Easybuy (E. Baaba)', 'Bright', 'transfer'],
  ['03-Jul-26', 'INFINIX Smart 20 (4+64)GB', 1, 'Annabel', 'Gifty', 'transfer'],
  ['03-Jul-26', 'TECNO Pop 20 (4 + 64)GB', 2, 'Mercy', 'Bright', 'transfer'],
  ['03-Jul-26', 'INFINIX Hot 70 (4+128)GB', 1, 'Mercy', 'Bright', 'transfer'],
  ['03-Jul-26', 'ITEL A200 (3+128)GB', 1, 'Mercy', 'Bright', 'transfer'],
  ['03-Jul-26', 'TECNO Spark 50 (4 + 128)GB', 1, 'Akinola', 'Kofi', 'transfer'],
  ['03-Jul-26', 'TECNO Spark 50 (4 + 128)GB', 1, 'Akinola', 'Mercy', 'transfer'],
  ['06-Jul-26', 'INFINIX Smart 20 (4+64)GB', 1, 'Annabel', 'Bright', 'transfer'],
  ['06-Jul-26', 'TECNO Camon 50 PRO (8 + 256)GB', 1, 'Bright', 'Akinola', 'transfer'],
  ['06-Jul-26', 'INFINIX Hot 70 (4+128)GB', 1, 'Bright', 'Akinola', 'transfer'],
  ['06-Jul-26', 'INFINIX Smart 20 (4+128)GB', 1, 'Bright', 'Gifty', 'transfer'],
  ['06-Jul-26', 'TECNO Spark 50 (4 + 128)GB', 1, 'Annabel', 'Wisdom', 'transfer'],
  ['06-Jul-26', 'TECNO Spark 50 (4 + 128)GB', 1, 'Annabel', 'Ivy', 'transfer'],
  ['06-Jul-26', 'TECNO Spark 50 (4 + 128)GB', 1, 'Ishmael', 'Nathan (Asut.)', 'transfer'],
  ['06-Jul-26', 'SAMSUNG A06 (4 + 64)GB', 1, 'F. Easybuy (E. Baaba)', 'Retail Shop (Christy. Okine)', 'transfer'],
  ['06-Jul-26', 'ITEL A200 (3+128)GB', 1, 'Bright', 'Kofi', 'transfer'],
  ['07-Jul-26', 'ITEL City 200 (4+128)GB', 1, 'F. Easybuy (E. Baaba)', 'Retail Shop (Christy. Okine)', 'transfer'],
  ['07-Jul-26', 'INFINIX Smart 20 (4+128)GB', 1, 'Fiberk Shop', 'Phone Stock (Head office)', 'transfer'],
  ['08-Jul-26', 'INFINIX Hot 70 (4+128)GB', 4, 'Bright', 'Fiberk Shop', 'transfer'],
  ['08-Jul-26', 'INFINIX Smart 20 (4+128)GB', 4, 'Bright', 'Fiberk Shop', 'transfer'],
  ['08-Jul-26', 'ITEL A200 (3+128)GB', 4, 'Bright', 'Fiberk Shop', 'transfer'],
  ['08-Jul-26', 'TECNO Spark 50 (4 + 128)GB', 1, 'Bright', 'Fiberk Shop', 'transfer'],
  ['09-Jul-26', 'TECNO Camon 50 PRO (8 + 256)GB', 1, 'Akinola', 'Fiberk Shop', 'transfer'],
  ['09-Jul-26', 'INFINIX Hot 70 (4+128)GB', 1, 'Fiberk Shop', 'F. Easybuy (E. Baaba)', 'transfer'],
  ['09-Jul-26', 'TECNO Spark 50 (4 + 128)GB', 1, 'Fiberk Shop', 'F. Easybuy (E. Baaba)', 'transfer'],
  ['09-Jul-26', 'ITEL A200 (3+128)GB', 2, 'Fiberk Shop', 'F. Easybuy (E. Baaba)', 'transfer'],
  ['09-Jul-26', 'TECNO Camon 50 PRO (8 + 256)GB', 1, 'Fiberk Shop', 'F. Easybuy (E. Baaba)', 'transfer'],
  ['09-Jul-26', 'INFINIX Smart 20 (4+128)GB', 1, 'Fiberk Shop', 'F. Easybuy (E. Baaba)', 'transfer'],
  ['10-Jul-26', 'INFINIX Smart 20 (4+128)GB', 1, 'Gifty', 'Bright', 'transfer'],
  ['10-Jul-26', 'TECNO Spark 50 (4 + 128)GB', 1, 'F. Easybuy (E. Baaba)', 'Anita Asare', 'transfer'],
  ['13-Jul-26', 'INFINIX Smart 20 (4+128)GB', 2, 'Fiberk Shop', 'F. Easybuy (E. Baaba)', 'transfer'],
  ['13-Jul-26', 'ITEL A200 (3+128)GB', 2, 'Fiberk Shop', 'F. Easybuy (E. Baaba)', 'transfer'],
  ['13-Jul-26', 'INFINIX Hot 70 (4+128)GB', 3, 'Fiberk Shop', 'F. Easybuy (E. Baaba)', 'transfer'],
  ['14-Jul-26', 'TECNO Spark 50 (4 + 128)GB', 1, 'Anita Asare', 'F. Easybuy (E. Baaba)', 'transfer'],
  ['14-Jul-26', 'INFINIX Hot 70 (4+128)GB', 2, 'F. Easybuy (E. Baaba)', 'Nathan (Asut.)', 'transfer'],
  ['14-Jul-26', 'ITEL A200 (3+128)GB', 2, 'F. Easybuy (E. Baaba)', 'Nathan (Asut.)', 'transfer'],
  ['14-Jul-26', 'TECNO Camon 50 PRO (8 + 256)GB', 1, 'F. Easybuy (E. Baaba)', 'Nathan (Asut.)', 'transfer'],
  ['14-Jul-26', 'TECNO Spark 50 (4 + 128)GB', 1, 'F. Easybuy (E. Baaba)', 'Nathan (Asut.)', 'transfer'],
  ['23-Jul-26', 'TECNO Spark 50 (4 + 128)GB', 2, 'Mercy', 'F. Easybuy (E. Baaba)', 'transfer'],
  ['23-Jul-26', 'INFINIX Smart 20 (4+64)GB', 1, 'Annabel', 'Gifty', 'transfer'],
  ['23-Jul-26', 'INFINIX Hot 70 (4+128)GB', 1, 'F. Easybuy (E. Baaba)', 'Bright', 'transfer'],
  ['23-Jul-26', 'ITEL A200 (3+128)GB', 1, 'F. Easybuy (E. Baaba)', 'Bright', 'transfer'],
  ['27-Jul-26', 'TECNO Spark 50 (4 + 128)GB', 1, 'F. Easybuy (E. Baaba)', 'Akinola', 'transfer'],
  ['28-Jul-26', 'INFINIX Smart 20 (4+128)GB', 2, 'F. Easybuy (E. Baaba)', 'Nathan (Asut.)', 'transfer'],
  ['28-Jul-26', 'INFINIX Hot 70 (4+128)GB', 1, 'F. Easybuy (E. Baaba)', 'Nathan (Asut.)', 'transfer'],
  ['28-Jul-26', 'TECNO Spark 50 (4 + 128)GB', 1, 'F. Easybuy (E. Baaba)', 'Nathan (Asut.)', 'transfer'],
  ['31-Jul-26', 'INFINIX Smart 20 (4+128)GB', 1, 'F. Easybuy (E. Baaba)', 'Bright', 'transfer'],
  ['31-Jul-26', 'ITEL A200 (3+128)GB', 1, 'F. Easybuy (E. Baaba)', 'Bright', 'transfer'],
  ['03-Aug-26', 'TECNO Pop 20 (4 + 64)GB', 1, 'Annabel', 'Gifty', 'transfer'],
  ['04-Aug-26', 'INFINIX Smart 20 (4+64)GB', 1, 'Akinola', 'Bright', 'transfer'],
];

export function hydrateLedgerTransfers() {
  const made = ROWS.map((r, i) => {
    const [date, product, qty, from, to, kind] = r;
    const day = dmy(date);
    const id = `st-led-${String(i + 1).padStart(3, '0')}`;
    return {
      id,
      reference: kind === 'opening' ? `OPN-${id.slice(-3)}` : `ST-LED-${String(i + 1).padStart(3, '0')}`,
      reference_no: kind === 'opening' ? `OPN-${id.slice(-3)}` : `ST-LED-${String(i + 1).padStart(3, '0')}`,
      date: day,
      transfer_date: day,
      from_location: codeOf(from),
      to_location: codeOf(to),
      from_location_name: from,
      to_location_name: to,
      legacy_from: from,
      legacy_to: to,
      status: 'completed',
      shipping_charges: 0,
      total_amount: 0,
      notes: `${kind === 'opening' ? 'Opening stock' : 'Internal transfer'} · ${product} ×${qty}`,
      lines: [{ name: product, product_name: product, qty, quantity: qty }],
      subsidiary_code: codeOf(to) === 'FIB-SHOP' ? 'fiberk' : 'bnpl',
      source: 'ledger',
      hp_live: true,
    };
  });
  const cur = readLs(KEY, []) || [];
  const map = new Map(cur.map((r) => [String(r.id), r]));
  made.forEach((r) => map.set(r.id, { ...(map.get(r.id) || {}), ...r }));
  writeLs(KEY, [...map.values()]);
  try { localStorage.setItem(FLAG, '1'); } catch { /* */ }
  return { n: made.length };
}
