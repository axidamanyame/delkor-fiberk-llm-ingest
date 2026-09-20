/** Shared till calculator keypad. */

export const CALC_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><rect x="7" y="5" width="10" height="4" rx="1" fill="currentColor" opacity=".25"/><circle cx="8.5" cy="13" r="1.1" fill="currentColor"/><circle cx="12" cy="13" r="1.1" fill="currentColor"/><circle cx="15.5" cy="13" r="1.1" fill="currentColor"/><circle cx="8.5" cy="16.5" r="1.1" fill="currentColor"/><circle cx="12" cy="16.5" r="1.1" fill="currentColor"/><circle cx="15.5" cy="16.5" r="1.1" fill="currentColor"/></svg>`;

export function calcHtml() {
  const keys = [
    ['C', '±', '%', '÷'],
    ['7', '8', '9', '×'],
    ['4', '5', '6', '−'],
    ['1', '2', '3', '+'],
    ['0', '.', '='],
  ];
  return `<div class="till-calc" role="dialog" aria-label="Calculator">
    <div class="calc-screen" id="calc-screen">0</div>
    <div class="calc-keys">${keys.map((row) => row.map((k) => {
      const cls = k === '0' ? 'calc-k wide'
        : k === '=' ? 'calc-k eq'
        : k === 'C' ? 'calc-k acc'
        : (k === '±' || k === '%') ? 'calc-k fn'
        : (/^[÷×−+]$/.test(k) ? 'calc-k op' : 'calc-k');
      return `<button type="button" class="${cls}" data-k="${k}">${k}</button>`;
    }).join('')).join('')}</div>
  </div>`;
}

export function bindCalc(root) {
  if (!root) return;
  let cur = '0';
  let prev = null;
  let op = null;
  let fresh = true;
  const screen = root.querySelector('#calc-screen') || root.querySelector('.calc-screen');
  const paint = () => { if (screen) screen.textContent = cur; };
  const num = (s) => Number(String(s).replace(/,/g, '')) || 0;
  const apply = () => {
    if (prev == null || !op) return;
    const a = num(prev);
    const b = num(cur);
    let r = b;
    if (op === '+') r = a + b;
    else if (op === '−' || op === '-') r = a - b;
    else if (op === '×' || op === '*') r = a * b;
    else if (op === '÷' || op === '/') r = b === 0 ? NaN : a / b;
    cur = Number.isFinite(r) ? String(Number(r.toFixed(10))) : 'Error';
    prev = null;
    op = null;
    fresh = true;
  };
  root.querySelectorAll('[data-k]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const k = btn.dataset.k;
      if (k === 'C') { cur = '0'; prev = null; op = null; fresh = true; paint(); return; }
      if (k === '±') { cur = String(-num(cur)); paint(); return; }
      if (k === '%') { cur = String(num(cur) / 100); paint(); return; }
      if (k === '=') { apply(); paint(); return; }
      if (/^[÷×−+\-*\/]$/.test(k)) {
        if (prev != null && !fresh) apply();
        prev = cur;
        op = k;
        fresh = true;
        paint();
        return;
      }
      if (k === '.') {
        if (fresh) { cur = '0.'; fresh = false; }
        else if (!cur.includes('.')) cur += '.';
        paint();
        return;
      }
      if (fresh || cur === '0' || cur === 'Error') { cur = k; fresh = false; }
      else if (cur.length < 14) cur += k;
      paint();
    });
  });
  paint();
}
