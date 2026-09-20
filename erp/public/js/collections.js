/**
 * Collections special desks — aging, plans, arrears.
 * Reads the Easybuy book first (same as Collections desk), then live tables.
 */
import { supabase } from './supabaseClient.js';
import { readLs } from './ls-rows.js';
import { ACC_KEY, CALL_KEY, PTP_KEY } from './collection-ops.js';
import { sortCallsRecent } from './call-when.js';

export function daysOverdue(nextDue, lastPay) {
  const raw = nextDue || lastPay;
  if (!raw) return 0;
  const d = new Date(raw);
  if (Number.isNaN(+d)) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

export function bucket(days) {
  if (days <= 30) return '0-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}

export function riskFromDays(days) {
  let n = 40;
  if (days > 30) n += 20;
  if (days > 60) n += 20;
  if (days > 90) n += 20;
  return Math.min(100, n);
}

function fromEasybuy() {
  const acc = readLs(ACC_KEY, []) || [];
  return acc.map((c) => {
    const days = daysOverdue(c.next_follow_up, c.last_at);
    return {
      ...c,
      name: c.name,
      phone: c.phone,
      days,
      bucket: bucket(days),
      risk: c.credit_score || riskFromDays(days),
      status: c.status || 'open',
    };
  });
}

export async function loadArrears() {
  const local = fromEasybuy();
  let remote = [];
  try {
    const { data, error } = await Promise.race([
      supabase.from('collection_accounts').select('id, name, phone, email, outstanding_balance, last_payment_date, next_due_date, risk_score, status, credit_grade, product, agent, amount_hint, next_follow_up, last_at').order('name').limit(2000),
      new Promise((resolve) => setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 4000)),
    ]);
    if (!error && data?.length) {
      remote = data.map((c) => {
        const days = daysOverdue(c.next_due_date || c.next_follow_up, c.last_payment_date || c.last_at);
        return {
          ...c,
          days,
          bucket: bucket(days),
          risk: c.risk_score || riskFromDays(days),
          status: c.status || 'open',
        };
      });
    }
  } catch { /* Easybuy book */ }
  if (remote.length && !local.length) return remote;
  if (!remote.length) return local;
  const by = new Map();
  [...remote, ...local].forEach((r) => {
    const k = String(r.id || r.phone || r.name);
    if (!by.has(k)) by.set(k, r);
  });
  return [...by.values()];
}

export async function saveCall(row) {
  const calls = readLs(CALL_KEY, []) || [];
  const rec = {
    id: 'call-' + Date.now(),
    account_id: row.customer_id || row.account_id,
    name: row.name || '',
    notes: row.notes || '',
    outcome: row.call_outcome || row.outcome || '',
    called_on: new Date().toISOString().slice(0, 10),
    channel: 'phone',
  };
  try { localStorage.setItem(CALL_KEY, JSON.stringify([rec, ...calls].slice(0, 2000))); } catch { /* quota */ }
  try { return await supabase.from('collection_calls').insert(rec).select().single(); } catch { return { data: rec }; }
}
export async function listCalls() {
  const local = readLs(CALL_KEY, []) || [];
  try {
    const { data, error } = await supabase.from('collection_calls').select('*').order('called_on', { ascending: false }).limit(300);
    if (!error && data?.length) return sortCallsRecent(data);
  } catch { /* local */ }
  return sortCallsRecent(local);
}
export async function savePromise(row) {
  const all = readLs(PTP_KEY, []) || [];
  const rec = { id: 'ptp-' + Date.now(), status: 'open', ...row };
  try { localStorage.setItem(PTP_KEY, JSON.stringify([rec, ...all].slice(0, 500))); } catch { /* quota */ }
  try { return await supabase.from('collection_ptps').insert(rec).select().single(); } catch { return { data: rec }; }
}
export async function listPromises() {
  const local = readLs(PTP_KEY, []) || [];
  try {
    const { data, error } = await supabase.from('collection_ptps').select('*').order('promised_on').limit(300);
    if (!error && data?.length) return data;
  } catch { /* local */ }
  return local;
}
export async function savePlan(row) {
  try { return await supabase.from('collections_payment_plans').insert(row).select().single(); } catch { return { data: row }; }
}
export async function listPlans() {
  try {
    const { data, error } = await supabase.from('collections_payment_plans').select('*').order('next_payment_date').limit(300);
    if (!error && data?.length) return data;
  } catch { /* none */ }
  return [];
}
const ESC_LS = 'df_collections_escalations';
export async function saveEscalation(row) {
  const rec = { id: row.id || 'esc-' + Date.now(), created_at: row.created_at || new Date().toISOString(), resolved: false, ...row };
  try {
    const prev = JSON.parse(localStorage.getItem(ESC_LS) || '[]');
    prev.unshift(rec);
    localStorage.setItem(ESC_LS, JSON.stringify(prev.slice(0, 400)));
  } catch { /* quota */ }
  try { return await supabase.from('collections_escalations').insert(rec).select().single(); } catch { return { data: rec }; }
}
export async function listEscalations() {
  let local = [];
  try { local = JSON.parse(localStorage.getItem(ESC_LS) || '[]'); } catch { local = []; }
  try {
    const { data, error } = await supabase.from('collections_escalations').select('*').order('created_at', { ascending: false }).limit(300);
    if (!error && data?.length) return data;
  } catch { /* none */ }
  return local;
}

export function fmt(n) {
  return 'GH₵ ' + Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function table(headers, rows) {
  const body = String(rows || '').trim();
  return `<div class="ult-card" data-tbl="live"><div class="ult-table-wrap table-wrapper"><table class="ult-table">
    <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${body || `<tr data-dummy="1"><td colspan="${headers.length}">No results match your filters.</td></tr>`}</tbody>
  </table></div></div>`;
}
