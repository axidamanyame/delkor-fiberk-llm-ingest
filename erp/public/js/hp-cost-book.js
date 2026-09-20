/** Last known purchase unit cost by model. Only prices from paper / UBA / setup. */
export const COST_RULES = [
  { re: /SPARK\s*50/i, storage: '128', cost: 1645.5, src: 'UBA-7473459 20 pcs 15 Jun' },
  { re: /HOT\s*70/i, storage: '128', cost: 1380, src: 'Franko 15 Jun' },
  { re: /SMART\s*20/i, storage: '64', cost: 1440, src: 'Franko 15 Jun' },
  { re: /SMART\s*20/i, storage: '128', cost: 1260, src: 'Franko 15 Jun' },
  { re: /A200/i, storage: '128', cost: 1209, src: 'Franko / setup' },
  { re: /A200/i, storage: '64', cost: 889, src: 'Franko / setup' },
  { re: /POP\s*20/i, storage: '64', cost: 1287, src: 'Franko / setup' },
];

export const LATE_COST = [
  { re: /SPARK\s*50/i, cost: 1835, src: 'Pinaro 00475' },
  { re: /HOT\s*70/i, cost: 1736, src: 'Pinaro 00475' },
  { re: /SMART\s*20/i, cost: 1581, src: 'Pinaro / Rabi' },
  { re: /A200/i, cost: 995, src: 'Pinaro 00475' },
  { re: /POP\s*20/i, storage: '64', cost: 1355, src: 'Rabi' },
];

function storageOf(name) {
  const m = String(name || '').toUpperCase().match(/\b(64|128|256)\s*G/);
  return m ? m[1] : '';
}

export function costFor(name, { latest = false } = {}) {
  const n = String(name || '');
  const st = storageOf(n);
  const pool = latest ? [...LATE_COST, ...COST_RULES] : COST_RULES;
  const hit = pool.find((r) => r.re.test(n) && (!r.storage || r.storage === st || !st));
  const cost = Number(hit?.cost || 0);
  return cost > 0 ? cost : null;
}

export function costBand(names) {
  const costs = [...new Set((names || []).map((n) => costFor(n)).filter((n) => n != null))];
  if (!costs.length) return { min: null, max: null };
  return { min: Math.min(...costs), max: Math.max(...costs) };
}

export function profitOf(sell, name) {
  const c = costFor(name);
  const s = Number(sell);
  if (c == null || !Number.isFinite(s)) return null;
  return Math.round((s - c) * 100) / 100;
}
