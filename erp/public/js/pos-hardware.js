/**
 * POS hardware adapters.
 * Keyboard wedge scanners already type into the product search field.
 * Receipt + cash drawer: Web Serial ESC/POS when a printer is paired,
 * otherwise browser print dialog.
 */
const ESC = '\x1b';
const GS = '\x1d';

let port = null;
let writer = null;

export async function connectPrinter() {
  if (!('serial' in navigator)) {
    return { ok: false, message: 'This browser has no Web Serial. Use Chrome/Edge and pair a USB receipt printer.' };
  }
  try {
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });
    writer = port.writable.getWriter();
    localStorage.setItem('ax_pos_hw', 'serial');
    return { ok: true, message: 'Receipt printer connected' };
  } catch (e) {
    return { ok: false, message: e.message || 'Printer not selected' };
  }
}

async function send(bytes) {
  if (!writer) return false;
  const enc = bytes instanceof Uint8Array ? bytes : new TextEncoder().encode(bytes);
  await writer.write(enc);
  return true;
}

/** ESC p 0 25 250 — open cash drawer on pin 2 */
export async function kickDrawer() {
  const cmd = new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]);
  const ok = await send(cmd);
  return ok;
}

export async function printEscPos(lines = []) {
  let text = ESC + '@';
  for (const line of lines) text += String(line) + '\n';
  text += '\n\n' + GS + 'V' + '\x00';
  return send(text);
}

export function printBrowserReceipt(html) {
  const w = window.open('', 'rcpt', 'width=420,height=640');
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}

export async function afterCashSale({ reference, total, lines = [], location = 'Delkor-Fiberk' }) {
  await kickDrawer();
  const escLines = [
    location,
    reference || '',
    new Date().toLocaleString('en-GB'),
    '----------------',
    ...lines.map((L) => `${L.qty || 1} x ${L.name || ''}  ${L.price || ''}`),
    '----------------',
    'TOTAL  ' + (total || ''),
    'Thank you',
  ];
  const sent = await printEscPos(escLines);
  if (!sent) {
    printBrowserReceipt(`<html><head><title>Receipt ${reference || ''}</title>
      <style>body{font-family:ui-monospace,monospace;padding:16px;width:280px}h2{text-align:center}</style></head>
      <body><h2>${location}</h2><p>${reference || ''}<br>${new Date().toLocaleString()}</p>
      <p>${(lines || []).map((L) => `${L.qty || 1} × ${L.name || ''}`).join('<br>')}</p>
      <p><strong>${total || ''}</strong></p><script>print()<\/script></body></html>`);
  }
}
