/** Strict tax + margin math. None / 0% means no tax. Never assume Ghana 15%. */

export const TAX_CATALOG = [
  { id: '', name: 'None', rate: 0 },
  { id: 'vat', name: 'GRA VAT 15%', rate: 15, aliases: ['vat', 'gra vat 15%', 'vat 15%', 'gra vat', 'gra vat 15'] },
  { id: 'nhil', name: 'NHIL 2.5%', rate: 2.5, aliases: ['nhil'] },
  { id: 'getfund', name: 'GETFund 2.5%', rate: 2.5, aliases: ['getfund'] },
  { id: 'covid', name: 'COVID levy 1%', rate: 1, aliases: ['covid', 'covid levy'] },
];

function storedRates() {
  try {
    const rows = JSON.parse(localStorage.getItem('df_tax_rates') || '[]');
    if (!Array.isArray(rows)) return [];
    return rows.map((r) => ({
      id: String(r.id || r.name || ''),
      name: r.name || String(r.id || ''),
      rate: Number(r.amount ?? r.rate ?? r.percent ?? 0) || 0,
      aliases: [String(r.name || '').toLowerCase()],
    }));
  } catch {
    return [];
  }
}

export function allTaxes() {
  const extra = storedRates().filter((t) => t.id && !TAX_CATALOG.some((c) => c.id === t.id || c.name.toLowerCase() === t.name.toLowerCase()));
  return TAX_CATALOG.concat(extra);
}

export function parseTaxRate(value) {
  if (value == null || value === '') return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
  const s = String(value).trim().toLowerCase();
  if (!s || s === 'none' || s === '0' || s === '0%') return 0;
  const hit = allTaxes().find((t) =>
    t.id.toLowerCase() === s
    || t.name.toLowerCase() === s
    || (t.aliases || []).includes(s)
  );
  if (hit) return Number(hit.rate) || 0;
  const m = s.match(/(\d+(?:\.\d+)?)\s*%/);
  if (m) return Number(m[1]) || 0;
  const n = Number(s);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function taxOptionsHtml(selected = '') {
  const cur = String(selected ?? '');
  return allTaxes().map((t) => {
    const val = t.id;
    const label = t.rate ? `${t.name}` : t.name;
    const on = cur === val || cur === t.name || (cur !== '' && Number(cur) === t.rate && t.rate > 0) || (!cur && !val) ? ' selected' : '';
    return `<option value="${val}"${on}>${label}</option>`;
  }).join('');
}

export function roundMoney(n, places = 2) {
  const p = 10 ** places;
  return Math.round((Number(n) || 0) * p + Number.EPSILON) / p;
}

/** Exclusive amount → inc/tax. Rate 0 means inc === exc. */
export function withTax(exc, rate) {
  const r = parseTaxRate(rate);
  const e = Number(exc) || 0;
  if (!r) return { exc: roundMoney(e), inc: roundMoney(e), tax: 0, rate: 0 };
  const tax = roundMoney(e * r / 100);
  return { exc: roundMoney(e), inc: roundMoney(e + tax), tax, rate: r };
}

export function fromInclusive(inc, rate) {
  const r = parseTaxRate(rate);
  const i = Number(inc) || 0;
  if (!r) return { exc: roundMoney(i), inc: roundMoney(i), tax: 0, rate: 0 };
  const e = roundMoney(i / (1 + r / 100));
  return { exc: e, inc: roundMoney(i), tax: roundMoney(i - e), rate: r };
}

/** Margin 0% → sell === cost. Negative margin allowed. */
export function applyMargin(costExc, marginPct) {
  const c = Number(costExc) || 0;
  const m = Number(marginPct);
  const margin = Number.isFinite(m) ? m : 0;
  return roundMoney(c * (1 + margin / 100));
}

export function marginFromPrices(costExc, sellExc) {
  const c = Number(costExc) || 0;
  const s = Number(sellExc) || 0;
  if (!c) return 0;
  return roundMoney(((s / c) - 1) * 100);
}

export function lineAmounts({ qty = 1, unitPrice = 0, tax = 0, taxType = 'exclusive', discount = 0 } = {}) {
  const q = Number(qty) || 0;
  const rate = parseTaxRate(tax);
  let unit = Number(unitPrice) || 0;
  if (String(taxType).toLowerCase() === 'inclusive' && rate) {
    unit = fromInclusive(unit, rate).exc;
  }
  const disc = Number(discount) || 0;
  const net = roundMoney(q * unit - disc);
  const taxAmt = roundMoney(net * rate / 100);
  return { net, tax: taxAmt, gross: roundMoney(net + taxAmt), rate };
}

export function taxLabel(rate, fallback = 'Tax') {
  const r = parseTaxRate(rate);
  if (!r) return 'None';
  const hit = allTaxes().find((t) => t.rate === r && t.id);
  return hit ? hit.name : `${fallback} ${r}%`;
}
