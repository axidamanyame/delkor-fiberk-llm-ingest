/** ERP Assistant memory — grows as staff ask questions. Local first, optional sync. */
import { readLs, writeLs, saveRow, loadRows } from './ls-rows.js';

export const MEM_KEY = 'df_assistant_memory';
export const TABLE = 'assistant_memory';

function norm(q) {
  return String(q || '').toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function loadMemory() {
  return (readLs(MEM_KEY, []) || []).filter((r) => r && r.q && r.a);
}

export async function hydrateMemory() {
  try {
    const rows = await loadRows(TABLE, MEM_KEY, loadMemory());
    return rows;
  } catch {
    return loadMemory();
  }
}

export function recall(question) {
  const q = norm(question);
  if (q.length < 4) return null;
  const rows = loadMemory();
  let best = null;
  let bestN = 0;
  rows.forEach((r) => {
    const k = String(r.q || '');
    if (!k) return;
    if (q === k) { best = r; bestN = 999; return; }
    if (q.includes(k) || k.includes(q)) {
      const n = Math.min(q.length, k.length);
      if (n > bestN) { best = r; bestN = n; }
    }
  });
  return bestN >= 8 ? best : null;
}

export async function remember(question, answer, meta = {}) {
  const q = norm(question);
  const a = String(answer || '').trim();
  if (q.length < 6 || a.length < 20) return;
  if (/could not|try again|looking through/i.test(a)) return;
  const rows = loadMemory();
  const i = rows.findIndex((r) => r.q === q);
  const row = {
    id: i >= 0 ? rows[i].id : ('mem-' + q.replace(/\s+/g, '-').slice(0, 40)),
    q,
    a,
    href: meta.href || '',
    n: (i >= 0 ? Number(rows[i].n || 1) : 0) + 1,
    at: new Date().toISOString(),
  };
  if (i >= 0) rows[i] = { ...rows[i], ...row };
  else rows.unshift(row);
  writeLs(MEM_KEY, rows.slice(0, 250));
  try { await saveRow(TABLE, MEM_KEY, row); } catch { /* local is enough */ }
}
