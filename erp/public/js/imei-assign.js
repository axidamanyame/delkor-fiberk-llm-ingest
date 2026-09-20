/** IMEI + lock time from Pre-Active Phone Lock → Pinaro 00475 and Rabi RC-WA-14454. */
import { readLs, writeLs } from './ls-rows.js';

export const IMEI_KEY = 'df_imei_units';

/** One physical handset. Lock-app page comes later. */
export const IMEI_UNITS = [
  // Pinaro #00475 — Spark 50 ×5
  { invoice: 'PIN-00475', invoice_id: 'pin-po-00475', product: 'TECNO SPARK 50', product_id: null, imei: '356120702480175', at: '2026-09-08 22:10:53', tab: 'active' },
  { invoice: 'PIN-00475', invoice_id: 'pin-po-00475', product: 'TECNO SPARK 50', imei: '356120701922714', at: '2026-09-08 22:02:39', tab: 'active' },
  { invoice: 'PIN-00475', invoice_id: 'pin-po-00475', product: 'TECNO SPARK 50', imei: '356120702439411', at: '2026-09-08 21:25:51', tab: 'active' },
  { invoice: 'PIN-00475', invoice_id: 'pin-po-00475', product: 'TECNO SPARK 50', imei: '352196172551327', at: '2026-09-08 21:54:05', tab: 'delivery', lock_code: 'SX8FMU7Y', pre_apply: 'PRE1017666688402849845' },
  { invoice: 'PIN-00475', invoice_id: 'pin-po-00475', product: 'TECNO SPARK 50', imei: '356120702570553', at: '2026-09-08 21:43:07', tab: 'delivery' },
  // Pinaro — Hot 70 ×3
  { invoice: 'PIN-00475', invoice_id: 'pin-po-00475', product: 'INFINIX HOT 70', imei: '356723492931321', at: '2026-09-08 22:39:46', tab: 'active' },
  { invoice: 'PIN-00475', invoice_id: 'pin-po-00475', product: 'INFINIX HOT 70', imei: '356723492857843', at: '2026-09-08 22:30:56', tab: 'active' },
  { invoice: 'PIN-00475', invoice_id: 'pin-po-00475', product: 'INFINIX HOT 70', imei: '356723492520769', at: '2026-09-08 22:17:55', tab: 'active' },
  // Pinaro — Smart 20 ×1
  { invoice: 'PIN-00475', invoice_id: 'pin-po-00475', product: 'INFINIX SMART 20', imei: '352562721747353', at: '2026-09-08 23:06:13', tab: 'active' },
  // Pinaro — Itel A200 ×6
  { invoice: 'PIN-00475', invoice_id: 'pin-po-00475', product: 'ITEL A200', imei: '350138911884934', at: '2026-09-08 21:05:00', tab: 'active' },
  { invoice: 'PIN-00475', invoice_id: 'pin-po-00475', product: 'ITEL A200', imei: '350138911700684', at: '2026-09-08 20:55:28', tab: 'active' },
  { invoice: 'PIN-00475', invoice_id: 'pin-po-00475', product: 'ITEL A200', imei: '350138911509432', at: '2026-09-08 20:46:42', tab: 'active' },
  { invoice: 'PIN-00475', invoice_id: 'pin-po-00475', product: 'ITEL A200', imei: '350138911494031', at: '2026-09-08 20:36:48', tab: 'active' },
  { invoice: 'PIN-00475', invoice_id: 'pin-po-00475', product: 'ITEL A200', imei: '350138911619306', at: '2026-09-08 20:22:26', tab: 'active' },
  { invoice: 'PIN-00475', invoice_id: 'pin-po-00475', product: 'ITEL A200', imei: '350138911682429', at: '2026-09-08 20:06:39', tab: 'active' },

  // Rabi RC-WA-14454 — Smart 20 128 ×4
  { invoice: 'RC-WA-14454', invoice_id: 'po-rabi-wa-14454', product: 'INFINIX SMART 20 (128GB)', imei: '352562721730185', at: '2026-09-08 22:57:52', tab: 'active' },
  { invoice: 'RC-WA-14454', invoice_id: 'po-rabi-wa-14454', product: 'INFINIX SMART 20 (128GB)', imei: '352562721726738', at: '2026-09-08 22:47:36', tab: 'active' },
  { invoice: 'RC-WA-14454', invoice_id: 'po-rabi-wa-14454', product: 'INFINIX SMART 20 (128GB)', imei: '352562721727751', at: '2026-09-08 21:17:02', tab: 'active' },
  { invoice: 'RC-WA-14454', invoice_id: 'po-rabi-wa-14454', product: 'INFINIX SMART 20 (128GB)', imei: '352562721730201', at: '2026-09-08 23:10:11', tab: 'active' },
  // Rabi — Pop 20 64 ×6 (8 Sep Active)
  { invoice: 'RC-WA-14454', invoice_id: 'po-rabi-wa-14454', product: 'TECNO POP 20 (64GB)', imei: '358543972385436', at: '2026-09-08 23:45:21', tab: 'active', lock_code: '4Z2YQDXB', pre_apply: 'PRE1017694689781882935' },
  { invoice: 'RC-WA-14454', invoice_id: 'po-rabi-wa-14454', product: 'TECNO POP 20 (64GB)', imei: '358543972385345', at: '2026-09-08 23:42:23', tab: 'active' },
  { invoice: 'RC-WA-14454', invoice_id: 'po-rabi-wa-14454', product: 'TECNO POP 20 (64GB)', imei: '359851910201619', at: '2026-09-08 23:34:31', tab: 'active' },
  { invoice: 'RC-WA-14454', invoice_id: 'po-rabi-wa-14454', product: 'TECNO POP 20 (64GB)', imei: '359851913977917', at: '2026-09-08 23:25:47', tab: 'active' },
  { invoice: 'RC-WA-14454', invoice_id: 'po-rabi-wa-14454', product: 'TECNO POP 20 (64GB)', imei: '358543970268915', at: '2026-09-08 23:21:55', tab: 'active' },
  { invoice: 'RC-WA-14454', invoice_id: 'po-rabi-wa-14454', product: 'TECNO POP 20 (64GB)', imei: '358543972396193', at: '2026-09-08 23:15:02', tab: 'active' },

  // Franko Madina FM-AUG-LOCK — Aug Delivery / Removable (not on Pinaro or Rabi)
  { invoice: 'FM-AUG-LOCK', invoice_id: 'po-fm-aug-lock', product: 'TECNO SPARK 50', imei: '352455870377751', at: '2026-08-13 23:28:39', tab: 'delivery' },
  { invoice: 'FM-AUG-LOCK', invoice_id: 'po-fm-aug-lock', product: 'INFINIX SMART 20 (4G+64G)', imei: '352562721396607', at: '2026-08-13 23:25:21', tab: 'delivery' },
  { invoice: 'FM-AUG-LOCK', invoice_id: 'po-fm-aug-lock', product: 'INFINIX SMART 20 (4G+64G)', imei: '352562721366691', at: '2026-08-13 23:15:46', tab: 'delivery' },
  { invoice: 'FM-AUG-LOCK', invoice_id: 'po-fm-aug-lock', product: 'INFINIX SMART 20 (4G+64G)', imei: '352562721688854', at: '2026-08-08 19:21:27', tab: 'delivery' },
  { invoice: 'FM-AUG-LOCK', invoice_id: 'po-fm-aug-lock', product: 'TECNO POP 20', imei: '354396744923644', at: '2026-08-13 23:03:03', tab: 'delivery' },
  { invoice: 'FM-AUG-LOCK', invoice_id: 'po-fm-aug-lock', product: 'TECNO POP 20', imei: '354396744816509', at: '2026-08-13 22:52:04', tab: 'delivery' },
  { invoice: 'FM-AUG-LOCK', invoice_id: 'po-fm-aug-lock', product: 'TECNO POP 20', imei: '354396744855911', at: '2026-08-13 22:39:06', tab: 'delivery' },
  { invoice: 'FM-AUG-LOCK', invoice_id: 'po-fm-aug-lock', product: 'TECNO POP 20', imei: '354396744926258', at: '2026-08-13 23:09:00', tab: 'removable', lock_code: 'TBXYQ38A', pre_apply: 'PRE1008263453606936611' },
];

function samePhone(lineName, unitProduct) {
  const a = String(lineName || '').toUpperCase();
  const b = String(unitProduct || '').toUpperCase();
  if (b.includes('SPARK 50') && a.includes('SPARK 50')) return true;
  if (b.includes('HOT 70') && a.includes('HOT 70')) return true;
  if (b.includes('SMART 20') && a.includes('SMART 20')) return true;
  if (b.includes('A200') && a.includes('A200')) return true;
  if (b.includes('POP 20') && a.includes('POP 20')) return true;
  return false;
}

function stitchLines(rows, invoice) {
  const units = IMEI_UNITS.filter((u) => u.invoice === invoice);
  return (rows || []).map((r) => {
    const serials = units.filter((u) => samePhone(r.name || r.product_name, u.product));
    if (!serials.length) return r;
    return { ...r, serials, imei: serials.map((s) => s.imei).join(', ') };
  });
}

export function attachImeiToInvoices() {
  const units = IMEI_UNITS.map((u, i) => ({ id: 'imei-' + u.imei, ...u }));
  writeLs(IMEI_KEY, units);
  ['df_purchases', 'df_purchase_orders', 'df_purchase_invoices'].forEach((key) => {
    const rows = readLs(key, []) || [];
    let changed = false;
    const next = rows.map((r) => {
      const ref = String(r.reference || r.reference_no || r.vendor_invoice_no || '');
      const inv = ref.includes('PIN-00475') || r.id === 'pin-po-00475' || r.id === 'pin-inv-00475' ? 'PIN-00475'
        : ref.includes('RC-WA-14454') || r.id === 'po-rabi-wa-14454' || r.id === 'inv-rabi-wa-14454' ? 'RC-WA-14454'
        : ref.includes('FM-AUG-LOCK') || r.id === 'po-fm-aug-lock' || r.id === 'inv-fm-aug-lock' ? 'FM-AUG-LOCK'
        : '';
      if (!inv || !(r.lines || []).length) return r;
      changed = true;
      return { ...r, lines: stitchLines(r.lines, inv) };
    });
    if (changed) writeLs(key, next);
  });
  return units.length;
}
