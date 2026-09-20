/** Thermal print helpers used by POS and printer settings. */
export const THERMAL_DEFAULTS = { width: 80, copies: 1 };

export function printerForLocation() {
  try { return JSON.parse(localStorage.getItem('df_receipt_printers') || '[]')[0] || null; }
  catch { return null; }
}
export function thermalCss() {
  return '@page{size:80mm auto;margin:0}body{font:12px monospace}';
}
export function thermalReceiptHtml(sale = {}) {
  return `<pre>${sale.ref || sale.invoice_no || 'SALE'}\n${sale.total || sale.amount || ''}</pre>`;
}
export function sampleSale() {
  return { ref: 'SAMPLE', total: 0 };
}
export function printThermal(sale, printer) {
  const w = window.open('', 'thermal', 'width=400,height=600');
  if (!w) return false;
  w.document.write(`<html><head><style>${thermalCss()}</style></head><body>${thermalReceiptHtml(sale || {})}</body></html>`);
  w.document.close();
  try { w.print(); } catch { /* ignore */ }
  return true;
}
