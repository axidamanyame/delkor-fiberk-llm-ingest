/**
 * Essentials & HRM rules (Delkor-Fiberk ERP → Delkor-Fiberk).
 * Leave default = pending. Payroll ref PAY-0001. Sales target = slab % on sales.
 * SSNIT on payroll: employee 5.5%, employer 13% of basic (display only).
 */
import { supabase } from './supabaseClient.js';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => {
    if (ch === '&') return '&' + 'amp;';
    if (ch === '<') return '&' + 'lt;';
    if (ch === '>') return '&' + 'gt;';
    if (ch === '"') return '&' + 'quot;';
    return '&' + '#39;';
  });
}

export async function peelWrite(table, payload, { id } = {}) {
  const row = { ...payload };
  Object.keys(row).forEach((k) => { if (row[k] === '') row[k] = null; });
  const extra = Object.keys(row);
  if (id) {
    let q = await supabase.from(table).update(row).eq('id', id).select('*').single();
    if (!q.error) return q;
    for (const k of extra) {
      if (!(k in row)) continue;
      delete row[k];
      const r2 = await supabase.from(table).update(row).eq('id', id).select('*').single();
      if (!r2.error) return r2;
      q = r2;
    }
    return q;
  }
  let q = await supabase.from(table).insert(row).select('*').single();
  if (!q.error) return q;
  for (const k of extra) {
    if (!(k in row)) continue;
    delete row[k];
    const r2 = await supabase.from(table).insert(row).select('*').single();
    if (!r2.error) return r2;
    q = r2;
  }
  return q;
}

export async function loadProfiles() {
  const { data } = await supabase.from('profiles').select('id, full_name, email, role').order('full_name').limit(300);
  return data || [];
}

export async function loadHrmSettings() {
  const { data } = await supabase.from('hrm_settings').select('*').eq('id', 1).maybeSingle();
  return data || { leave_instructions: 'Apply leave before the start date.', payroll_prefix: 'PAY', payroll_next: 1, sales_target_exclude_tax: false };
}

export async function nextPayrollRef() {
  const s = await loadHrmSettings();
  const prefix = s.payroll_prefix || 'PAY';
  const { data } = await supabase.from('hrm_payroll').select('ref_no').limit(400);
  let max = Number(s.payroll_next) || 1;
  (data || []).forEach((r) => {
    const n = Number(String(r.ref_no || '').replace(/\D/g, ''));
    if (n >= max) max = n + 1;
  });
  return prefix + '-' + String(max).padStart(4, '0');
}

export function daysBetween(a, b) {
  if (!a || !b) return 0;
  const d1 = new Date(a);
  const d2 = new Date(b);
  return Math.max(1, Math.round((d2 - d1) / 86400000) + 1);
}

/**
 * Slab shapes accepted, so a slab configured under a different name still pays.
 * The canonical keys are min_amount / max_amount / commission_pct; the rest are
 * spellings found in the sales-target and settings screens, or the obvious
 * guesses someone would type by hand.
 */
const SLAB_KEYS = {
  min: ['min_amount', 'min', 'from', 'from_amount', 'lower', 'start'],
  max: ['max_amount', 'max', 'to', 'to_amount', 'upto', 'up_to', 'upper', 'end'],
  pct: ['commission_pct', 'pct', 'percent', 'percentage', 'rate', 'commission', 'commission_rate'],
};

function slabField(slab, which, fallback) {
  for (const k of SLAB_KEYS[which]) {
    if (slab && slab[k] !== undefined && slab[k] !== null && slab[k] !== '') {
      const n = Number(String(slab[k]).replace(/[%,\s]/g, ''));
      if (Number.isFinite(n)) return n;
    }
  }
  return fallback;
}

/**
 * Report what is wrong with a slab table, so a misconfigured one is visible
 * instead of silently paying zero. Returns [] when the table is usable.
 *
 * This was a real trap: the only shape slabCommission() understood was
 * min_amount / max_amount / commission_pct, and anything else scored zero
 * commission without an error — so staff would be paid nothing and nothing
 * would complain.
 */
export function validateSlabs(slabs) {
  const list = Array.isArray(slabs) ? slabs : [];
  if (!list.length) return ['No commission slabs are configured, so every commission is zero.'];

  const problems = [];
  const parsed = list.map((s, i) => ({
    i,
    min: slabField(s, 'min', NaN),
    max: slabField(s, 'max', NaN),
    pct: slabField(s, 'pct', NaN),
    raw: s,
  }));

  parsed.forEach((p) => {
    const at = `Slab ${p.i + 1}`;
    if (!Number.isFinite(p.pct)) problems.push(`${at}: no commission percentage. Expected commission_pct; found ${Object.keys(p.raw || {}).join(', ') || 'nothing'}.`);
    else if (p.pct <= 0) problems.push(`${at}: the commission percentage is ${p.pct}, so it pays nothing.`);
    else if (p.pct > 100) problems.push(`${at}: the commission percentage is ${p.pct}, which is above 100%.`);
    if (!Number.isFinite(p.min)) problems.push(`${at}: no lower bound. Expected min_amount.`);
    if (!Number.isFinite(p.max)) problems.push(`${at}: no upper bound. Expected max_amount.`);
    if (Number.isFinite(p.min) && Number.isFinite(p.max) && p.min > p.max) {
      problems.push(`${at}: the lower bound (${p.min}) is above the upper bound (${p.max}), so it can never match.`);
    }
  });

  /* gaps and overlaps between bands */
  const bands = parsed
    .filter((p) => Number.isFinite(p.min) && Number.isFinite(p.max))
    .sort((x, y) => x.min - y.min);
  for (let i = 1; i < bands.length; i++) {
    const prev = bands[i - 1];
    const cur = bands[i];
    if (cur.min <= prev.max) {
      problems.push(`Slabs ${prev.i + 1} and ${cur.i + 1} overlap between ${cur.min} and ${prev.max}; the first match wins.`);
    } else if (cur.min - prev.max > 1) {
      problems.push(`Nothing covers sales between ${prev.max} and ${cur.min}, so those earn no commission.`);
    }
  }
  if (bands.length && bands[0].min > 0) {
    problems.push(`Nothing covers sales below ${bands[0].min}, so those earn no commission.`);
  }
  return problems;
}

export function slabCommission(slabs, amount) {
  const n = Number(amount) || 0;
  const hit = (slabs || []).find((s) => {
    const min = slabField(s, 'min', 0);
    const max = slabField(s, 'max', Infinity);
    return n >= min && n <= max;
  });
  if (!hit) return 0;
  const pct = slabField(hit, 'pct', 0);
  return Math.round(n * pct / 100 * 100) / 100;
}

export function snnitSplit(basic) {
  const b = Number(basic) || 0;
  return {
    employee: Math.round(b * 0.055 * 100) / 100,
    employer: Math.round(b * 0.13 * 100) / 100,
  };
}

export function netPay({ basic, allowance, deduction, sales_target_commission, snnit_employee }) {
  return Math.round((
    (Number(basic) || 0) +
    (Number(allowance) || 0) +
    (Number(sales_target_commission) || 0) -
    (Number(deduction) || 0) -
    (Number(snnit_employee) || 0)
  ) * 100) / 100;
}

export function statusPill(st) {
  const s = String(st || 'pending').toLowerCase();
  const bg = s === 'approved' || s === 'paid' ? '#dcfce7' : s === 'cancelled' ? '#fee2e2' : '#fef3c7';
  const fg = s === 'approved' || s === 'paid' ? '#166534' : s === 'cancelled' ? '#991b1b' : '#92400e';
  return `<span style="font-size:11px;border-radius:999px;padding:2px 8px;background:${bg};color:${fg}">${esc(s)}</span>`;
}
