/**
 * Contact management rules (Delkor-Fiberk ERP → Delkor-Fiberk).
 *
 * Customer opening balance = amount the customer still owes us (receivable).
 * Supplier opening balance = amount we still owe the supplier (payable).
 * Advanced balance (customer) = amount WE owe the customer (overpay / deposit).
 * Advanced balance (supplier) = amount THEY owe us (we overpaid).
 * Walk-in due is always 0. Credit sale needs a named customer under their limit.
 * Customer group calculation % is applied silently to selling price (not a discount line).
 */
import { supabase } from './supabaseClient.js';
import { loadBizSettings } from './settings-store.js';

export const PAY_METHODS = [
  ['cash', 'Cash'],
  ['momo', 'MoMo (MTN / Telecel / AT)'],
  ['bank', 'Bank transfer'],
  ['card', 'Card'],
  ['cheque', 'Cheque'],
];

export const LEDGER_KINDS = [
  ['opening_balance', 'Opening balance'],
  ['sell', 'Sell'],
  ['purchase', 'Purchase'],
  ['payment', 'Payment'],
  ['sell_return', 'Sell return'],
  ['purchase_return', 'Purchase return'],
  ['advance', 'Advance'],
  ['discount', 'Discount'],
];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => {
    if (ch === '&') return '&' + 'amp;';
    if (ch === '<') return '&' + 'lt;';
    if (ch === '>') return '&' + 'gt;';
    if (ch === '"') return '&' + 'quot;';
    return '&' + '#39;';
  });
}

export function isWalkIn(row) {
  if (!row) return true;
  if (row.is_default) return true;
  const n = String(row.name || '').toLowerCase().replace(/[\s_-]+/g, '');
  return n === 'walkincustomer' || n === 'walkin';
}

export function groupPrice(base, pct) {
  const b = Number(base) || 0;
  const p = Number(pct) || 0;
  return Math.round(b * (1 + p / 100) * 100) / 100;
}

export const DEFAULT_CUSTOMER_GROUPS = [
  { name: 'Retail walk-in', price_group: 'Retail', calculation_percentage: 0, subsidiary_code: 'fiberk' },
  { name: 'Wholesale', price_group: 'Wholesale', calculation_percentage: -12, subsidiary_code: 'axidigetek' },
  { name: 'BNPL hire-purchase', price_group: 'Retail', calculation_percentage: 0, subsidiary_code: 'bnpl' },
  { name: 'Corporate', price_group: 'VIP', calculation_percentage: -8, subsidiary_code: 'delkor' },
  { name: 'Staff', price_group: 'Retail', calculation_percentage: -20, subsidiary_code: 'group' },
];

/** Demo / missing group: Fiberk retail, Axidigetek wholesale, BNPL hire-purchase, Delkor corporate. */
export function groupFromSubsidiary(code, locHint = '') {
  const c = String(code || '').toLowerCase();
  const loc = String(locHint || '').toLowerCase();
  if (c === 'bnpl' || c === 'buynowpayslater' || /bnpl|hire.?purchase|field/.test(loc)) return 'BNPL hire-purchase';
  if (c === 'axidigetek' || /axi|e-?comm|online store/.test(loc)) return 'Wholesale';
  if (c === 'delkor' || /delkor|logist|furniture/.test(loc)) return 'Corporate';
  if (c === 'fiberk' || /fiberk/.test(loc)) return 'Retail walk-in';
  return 'Retail walk-in';
}

export function resolveCustomerGroup(row, groups = []) {
  const byId = (groups || []).find((g) =>
    String(g.id) === String(row?.customer_group_id || row?.group_id || ''));
  if (byId?.name) return byId.name;
  if (row?.group_name) return row.group_name;
  if (row?.customer_group) return row.customer_group;
  return groupFromSubsidiary(row?.subsidiary_code || row?.home_subsidiary, row?.location_code || row?.location_name);
}

export async function loadCustomerGroups() {
  const { data, error } = await supabase.from('customer_groups').select('*').order('name').limit(80);
  if (!error && data?.length) return data;
  if (!data?.length && !error) {
    for (const g of DEFAULT_CUSTOMER_GROUPS) {
      const { error: ins } = await supabase.from('customer_groups').insert(g);
      if (ins) break;
    }
    const again = await supabase.from('customer_groups').select('*').order('name').limit(80);
    if (again.data?.length) return again.data;
  }
  return DEFAULT_CUSTOMER_GROUPS;
}

export function groupPctFor(groups, customer) {
  if (!customer || isWalkIn(customer)) return 0;
  const byId = (groups || []).find((g) => String(g.id) === String(customer.customer_group_id));
  if (byId) return Number(byId.calculation_percentage) || 0;
  const byName = (groups || []).find((g) => String(g.name || '').toLowerCase() === String(customer.group_name || '').toLowerCase());
  return Number(byName?.calculation_percentage) || 0;
}

function missingColumn(msg) {
  const s = String(msg || '');
  const m = s.match(/Could not find the '([^']+)' column/i)
    || s.match(/column "([^"]+)" of relation/i)
    || s.match(/column ([a-z0-9_]+) does not exist/i);
  return m?.[1] || null;
}

async function peelWrite(table, payload, { id } = {}) {
  const row = { ...payload };
  Object.keys(row).forEach((k) => { if (row[k] === '') row[k] = null; });
  if (row.additional_number) {
    if (!row.alternate_number) row.alternate_number = row.additional_number;
    else row.notes = [row.notes, 'Secondary: ' + row.additional_number].filter(Boolean).join('\n');
  }
  delete row.additional_number;
  delete row.entity;

  const write = () => id
    ? supabase.from(table).update(row).eq('id', id).select('*').single()
    : supabase.from(table).insert(row).select('*').single();

  let q = await write();
  for (let i = 0; i < 40 && q.error; i++) {
    const col = missingColumn(q.error.message);
    if (!col || !(col in row)) break;
    delete row[col];
    q = await write();
  }
  if (q.error) {
    const extra = [
      'contact_code', 'contact_type', 'prefix', 'landline', 'tax_number', 'momo_wallet',
      'pay_term', 'pay_term_type', 'opening_balance', 'advance_balance', 'credit_limit',
      'assigned_to', 'customer_group_id', 'loyalty_card', 'loyalty_points', 'is_default',
      'contact_id', 'group_name', 'ghana_card', 'ghana_post_gps', 'city', 'region',
      'suburb', 'address_line', 'address_line2', 'notes', 'customer_type', 'preferred_agent', 'kind',
      'source', 'subsidiary_code', 'location_code', 'email', 'phone',
      'is_active', 'first_name', 'last_name', 'business_name', 'shipping_address', 'dob', 'contact_since',
      'alternate_number', 'middle_name', 'contact_persons', 'zip', 'landmark', 'street', 'building',
      'country', 'custom_field_1', 'custom_field_2', 'custom_field_3', 'custom_field_4',
    ];
    for (const k of extra) {
      if (!(k in row)) continue;
      delete row[k];
      q = await write();
      if (!q.error) return q;
    }
  }
  return q;
}

export async function nextContactCode(kind) {
  const table = kind === 'supplier' ? 'suppliers' : 'customers';
  const prefix = kind === 'supplier' ? 'SU' : 'CO';
  const { data } = await supabase.from(table).select('contact_code').limit(800);
  let max = 0;
  (data || []).forEach((r) => {
    const n = parseInt(String(r.contact_code || '').replace(/\D/g, ''), 10);
    if (Number.isFinite(n) && n > max) max = n;
  });
  return prefix + String(max + 1).padStart(4, '0');
}

export async function saveParty(kind, row) {
  const table = kind === 'supplier' ? 'suppliers' : 'customers';
  const payload = { ...row };
  if (payload.first_name || payload.business_name) {
    payload.name = composeName(payload) || payload.name;
  }
  if (!payload.contact_code) payload.contact_code = await nextContactCode(kind);
  if (kind === 'customer' && !payload.loyalty_card && !isWalkIn(payload)) {
    payload.loyalty_card = payload.contact_code;
  }
  if (kind === 'customer' && !payload.contact_type) payload.contact_type = 'customer';
  if (kind === 'supplier' && !payload.contact_type) payload.contact_type = 'supplier';
  if (payload.is_active == null) payload.is_active = true;
  if (!payload.group_name) payload.group_name = groupFromSubsidiary(payload.subsidiary_code);
  const id = payload.id;
  delete payload.id;
  const saved = await peelWrite(table, payload, { id });
  if (saved.error || !saved.data) return saved;
  await syncOpeningBalance(kind, saved.data, Number(payload.opening_balance));
  if (String(payload.contact_type || '') === 'both') {
    await mirrorBoth(kind, saved.data);
  }
  return saved;
}

async function mirrorBoth(fromKind, party) {
  const other = fromKind === 'customer' ? 'suppliers' : 'customers';
  const { data: hit } = await supabase.from(other).select('id').eq('phone', party.phone || '__none__').maybeSingle();
  if (hit?.id) return;
  const row = {
    name: party.name,
    phone: party.phone,
    email: party.email,
    tax_number: party.tax_number,
    city: party.city,
    address_line: party.address_line,
    contact_type: 'both',
    contact_code: await nextContactCode(fromKind === 'customer' ? 'supplier' : 'customer'),
    notes: 'Mirrored from ' + fromKind + ' (contact type Both)',
  };
  await peelWrite(other, row);
}

export async function syncOpeningBalance(kind, party, amount) {
  if (!party?.id) return;
  const amt = Number(amount);
  if (!Number.isFinite(amt)) return;
  const { data: existing } = await supabase.from('contact_payments')
    .select('id, amount').eq('party_kind', kind).eq('party_id', party.id).eq('kind', 'opening_balance').limit(1);
  const direction = kind === 'supplier' ? 'credit' : 'debit';
  if (existing?.[0]) {
    if (Number(existing[0].amount) === amt) return;
    if (amt === 0) {
      await supabase.from('contact_payments').delete().eq('id', existing[0].id);
      return;
    }
    await supabase.from('contact_payments').update({ amount: amt, direction }).eq('id', existing[0].id);
    return;
  }
  if (amt === 0) return;
  await postLedger({
    party_kind: kind,
    party_id: party.id,
    party_name: party.name,
    contact_id: party.contact_id || null,
    kind: 'opening_balance',
    direction,
    amount: amt,
    method: 'opening',
    note: 'Opening balance',
    paid_on: new Date().toISOString().slice(0, 10),
  });
}

async function postLedger(row) {
  const payload = { ...row, amount: Math.abs(Number(row.amount) || 0) };
  let q = await supabase.from('contact_payments').insert(payload).select('id').single();
  if (!q.error) return q;
  const peel = ['contact_id', 'location_code', 'subsidiary_code', 'created_by', 'reference', 'method', 'note'];
  for (const k of peel) {
    delete payload[k];
    const r2 = await supabase.from('contact_payments').insert(payload).select('id').single();
    if (!r2.error) return r2;
    q = r2;
  }
  return q;
}

export async function postPayment({ kind, partyId, partyName, amount, method, note, payKind = 'payment', direction, reference, subsidiary, location, paidOn }) {
  const amt = Math.abs(Number(amount) || 0);
  if (!amt || !partyId) return { error: { message: 'Amount and contact required' } };
  const dir = direction || defaultDirection(kind, payKind);
  const q = await postLedger({
    party_kind: kind,
    party_id: partyId,
    party_name: partyName,
    kind: payKind,
    direction: dir,
    amount: amt,
    method: method || 'cash',
    note: note || null,
    reference: reference || null,
    paid_on: paidOn || new Date().toISOString().slice(0, 10),
    subsidiary_code: subsidiary || null,
    location_code: location || null,
  });
  if (!q.error && partyId) {
    try {
      const bal = await partyBalance(kind, { id: partyId, name: partyName });
      const table = kind === 'supplier' ? 'suppliers' : 'customers';
      await supabase.from(table).update({ advance_balance: bal.advance }).eq('id', partyId);
    } catch (_) { /* column may be missing until sql/95 */ }
  }
  return q;
}

function defaultDirection(partyKind, payKind) {
  // Customer: due = debit − credit. Payment / advance / discount / return = credit.
  // Supplier: payable = credit − debit. Payment / advance / return = debit.
  const customerCredit = ['payment', 'advance', 'discount', 'sell_return'];
  const customerDebit = ['opening_balance', 'sell'];
  if (partyKind === 'supplier') {
    if (payKind === 'payment' || payKind === 'advance' || payKind === 'purchase_return' || payKind === 'discount') return 'debit';
    return 'credit';
  }
  if (customerCredit.includes(payKind)) return 'credit';
  if (customerDebit.includes(payKind)) return 'debit';
  return 'credit';
}

export async function buildLedger(kind, party, { from, to, types } = {}) {
  const partyId = party?.id;
  const name = party?.name;
  const lines = [];

  if (partyId) {
    let q = supabase.from('contact_payments').select('*').eq('party_kind', kind).eq('party_id', partyId).order('paid_on').limit(500);
    const { data } = await q;
    (data || []).forEach((p) => {
      lines.push({
        id: p.id,
        date: p.paid_on || (p.created_at || '').slice(0, 10),
        type: p.kind,
        ref: p.reference || '',
        location: p.location_code || '',
        debit: p.direction === 'debit' ? Number(p.amount) || 0 : 0,
        credit: p.direction === 'credit' ? Number(p.amount) || 0 : 0,
        note: p.note || p.method || '',
        method: p.method,
        source: 'ledger',
      });
    });
  }

  if (kind === 'customer' && !isWalkIn(party)) {
    const filters = [];
    if (partyId) filters.push(`customer_id.eq.${partyId}`);
    if (name) filters.push(`customer_name.eq.${name}`);
    if (party?.contact_id) filters.push(`customer_id.eq.${party.contact_id}`);
    let sales = [];
    if (filters.length) {
      const r = await supabase.from('sales_orders')
        .select('id, reference, status, payment_status, total_amount, amount_paid, created_at, order_date, location_name, notes, customer_name')
        .or(filters.join(',')).order('created_at', { ascending: true }).limit(400);
      sales = r.data || [];
      if (r.error && name) {
        const r2 = await supabase.from('sales_orders').select('id, reference, status, payment_status, total_amount, created_at, order_date, location_name, notes, customer_name')
          .eq('customer_name', name).order('created_at', { ascending: true }).limit(400);
        sales = r2.data || [];
      }
    }
    sales.forEach((s) => {
      if (/draft|quot|cancel/i.test(s.status || '')) return;
      const isReturn = /return|refund/i.test(s.status || '');
      const total = Number(s.total_amount) || 0;
      const paid = Number(s.amount_paid);
      const unpaid = /unpaid|partial|credit|due/i.test(s.payment_status || s.status || '');
      const date = (s.order_date || s.created_at || '').toString().slice(0, 10);
      if (isReturn) {
        lines.push({ id: s.id, date, type: 'sell_return', ref: s.reference, location: s.location_name || '', debit: 0, credit: total, note: 'Sell return', source: 'sale' });
        return;
      }
      lines.push({ id: s.id, date, type: 'sell', ref: s.reference, location: s.location_name || '', debit: total, credit: 0, note: s.payment_status || s.status || 'Sell', source: 'sale' });
      if (!unpaid && total) {
        lines.push({ id: s.id + '-pay', date, type: 'payment', ref: s.reference, location: s.location_name || '', debit: 0, credit: Number.isFinite(paid) && paid > 0 ? paid : total, note: 'Invoice payment', source: 'sale' });
      } else if (Number.isFinite(paid) && paid > 0) {
        lines.push({ id: s.id + '-pay', date, type: 'payment', ref: s.reference, location: s.location_name || '', debit: 0, credit: paid, note: 'Partial payment', source: 'sale' });
      }
    });
  }

  if (kind === 'supplier') {
    const filters = [];
    if (partyId) filters.push(`supplier_id.eq.${partyId}`);
    if (name) filters.push(`supplier_name.eq.${name}`);
    let bills = [];
    if (filters.length) {
      const r = await supabase.from('purchase_invoices')
        .select('id, reference, status, total_amount, amount_paid, invoice_date, created_at, supplier_name')
        .or(filters.join(',')).order('created_at', { ascending: true }).limit(400);
      bills = r.data || [];
      if (r.error && name) {
        const r2 = await supabase.from('purchase_invoices').select('id, reference, status, total_amount, amount_paid, invoice_date, created_at, supplier_name')
          .eq('supplier_name', name).limit(400);
        bills = r2.data || [];
      }
    }
    bills.forEach((b) => {
      const total = Number(b.total_amount) || 0;
      const paid = Number(b.amount_paid) || 0;
      const date = (b.invoice_date || b.created_at || '').toString().slice(0, 10);
      lines.push({ id: b.id, date, type: 'purchase', ref: b.reference, location: '', debit: 0, credit: total, note: b.status || 'Purchase', source: 'purchase' });
      if (paid > 0) {
        lines.push({ id: b.id + '-pay', date, type: 'payment', ref: b.reference, location: '', debit: paid, credit: 0, note: 'Bill payment', source: 'purchase' });
      }
    });
  }

  let filtered = lines;
  if (from) filtered = filtered.filter((l) => !l.date || l.date >= from);
  if (to) filtered = filtered.filter((l) => !l.date || l.date <= to);
  if (types && types.length) filtered = filtered.filter((l) => types.includes(l.type));
  filtered.sort((a, b) => String(a.date).localeCompare(String(b.date)));

  let run = 0;
  const withRun = filtered.map((l) => {
    if (kind === 'supplier') run += (Number(l.credit) || 0) - (Number(l.debit) || 0);
    else run += (Number(l.debit) || 0) - (Number(l.credit) || 0);
    return { ...l, running: run };
  });

  const totals = summarise(kind, withRun);
  return { lines: withRun, ...totals };
}

function summarise(kind, lines) {
  const debit = lines.reduce((a, l) => a + (Number(l.debit) || 0), 0);
  const credit = lines.reduce((a, l) => a + (Number(l.credit) || 0), 0);
  const amt = (l) => (Number(l.debit) || 0) + (Number(l.credit) || 0);
  const by = (t) => lines.filter((l) => l.type === t).reduce((a, l) => a + amt(l), 0);
  const sell = by('sell');
  const sellReturn = by('sell_return');
  const purchase = by('purchase');
  const purchaseReturn = by('purchase_return');
  if (kind === 'supplier') {
    const payable = Math.max(0, credit - debit);
    const advance = Math.max(0, debit - credit);
    return { debit, credit, due: payable, advance, sell, sellReturn, purchase, purchaseReturn };
  }
  const due = Math.max(0, debit - credit);
  const advance = Math.max(0, credit - debit);
  return { debit, credit, due, advance, sell, sellReturn, purchase, purchaseReturn };
}

export async function partyBalance(kind, party) {
  if (!party || isWalkIn(party)) {
    return { due: 0, advance: 0, debit: 0, credit: 0, lines: [], sell: 0, sellReturn: 0, purchase: 0, purchaseReturn: 0 };
  }
  return buildLedger(kind, party, {});
}

export function creditRemaining(customer, due) {
  if (!customer || isWalkIn(customer)) return 0;
  const cap = Number(customer.credit_limit) || 0;
  if (cap <= 0) return Infinity;
  return Math.max(0, cap - (Number(due) || 0));
}

export function canCreditSale(customer, due, thisSale) {
  if (!customer || isWalkIn(customer)) {
    return { ok: false, reason: 'Credit sale needs a named customer. Walk-In is cash / MoMo / card only.' };
  }
  const cap = Number(customer.credit_limit) || 0;
  if (cap <= 0) return { ok: true, remaining: Infinity };
  const next = (Number(due) || 0) + (Number(thisSale) || 0);
  if (next > cap + 0.009) {
    return {
      ok: false,
      reason: 'This ticket would take ' + customer.name + ' to GH₵ ' + next.toFixed(2) + ' due, over the GH₵ ' + cap.toFixed(2) + ' credit limit.',
      remaining: Math.max(0, cap - (Number(due) || 0)),
    };
  }
  return { ok: true, remaining: cap - next };
}

export async function loadRewardSettings() {
  const s = await loadBizSettings();
  return {
    enabled: !!s.enable_reward_points,
    earnAmount: Number(s.rp_earn_amount) || 10,
    redeemAmount: Number(s.rp_redeem_amount) || 0.5,
    minOrder: Number(s.rp_min_order) || 0,
  };
}

export function pointsForSale(total, cfg) {
  if (!cfg?.enabled) return 0;
  const spend = Number(total) || 0;
  if (spend < (cfg.minOrder || 0)) return 0;
  const per = Number(cfg.earnAmount) || 0;
  if (per <= 0) return 0;
  return Math.floor(spend / per);
}

export function redeemValue(points, cfg) {
  return (Number(points) || 0) * (Number(cfg?.redeemAmount) || 0);
}

export async function earnLoyalty(customer, { total, saleId, saleRef, actor } = {}) {
  if (!customer?.id || isWalkIn(customer)) return { points: 0 };
  const cfg = await loadRewardSettings();
  const pts = pointsForSale(total, cfg);
  if (!pts) return { points: 0 };
  const next = (Number(customer.loyalty_points) || 0) + pts;
  await supabase.from('customers').update({ loyalty_points: next }).eq('id', customer.id);
  await supabase.from('loyalty_ledger').insert({
    customer_id: customer.id,
    points: pts,
    kind: 'earn',
    sale_id: saleId || null,
    sale_ref: saleRef || null,
    note: 'Earned on ' + (saleRef || 'sale'),
    created_by: actor || null,
  });
  return { points: pts, balance: next };
}

export async function redeemLoyalty(customer, points, { saleId, saleRef, actor } = {}) {
  if (!customer?.id || isWalkIn(customer)) return { error: { message: 'Walk-in has no loyalty card' } };
  const want = Math.abs(Number(points) || 0);
  const have = Number(customer.loyalty_points) || 0;
  if (want <= 0) return { points: 0, value: 0, balance: have };
  if (want > have) return { error: { message: 'Only ' + have + ' points on this card' } };
  const cfg = await loadRewardSettings();
  const next = have - want;
  await supabase.from('customers').update({ loyalty_points: next }).eq('id', customer.id);
  await supabase.from('loyalty_ledger').insert({
    customer_id: customer.id,
    points: -want,
    kind: 'redeem',
    sale_id: saleId || null,
    sale_ref: saleRef || null,
    note: 'Redeemed on till',
    created_by: actor || null,
  });
  return { points: want, value: redeemValue(want, cfg), balance: next };
}

export async function adjustLoyalty(customer, points, note, actor) {
  if (!customer?.id || isWalkIn(customer)) return { error: { message: 'Walk-in has no loyalty card' } };
  const delta = Number(points) || 0;
  const next = Math.max(0, (Number(customer.loyalty_points) || 0) + delta);
  await supabase.from('customers').update({ loyalty_points: next }).eq('id', customer.id);
  await supabase.from('loyalty_ledger').insert({
    customer_id: customer.id,
    points: delta,
    kind: 'adjust',
    note: note || 'Manual adjust',
    created_by: actor || null,
  });
  return { balance: next };
}

export function payTermLabel(row) {
  const n = Number(row?.pay_term);
  if (!n) return '—';
  const t = row.pay_term_type === 'months' ? (n === 1 ? 'month' : 'months') : (n === 1 ? 'day' : 'days');
  return n + ' ' + t;
}

export const GHANA_REGIONS = [
  'Greater Accra', 'Ashanti', 'Western', 'Eastern', 'Central', 'Northern', 'Volta',
  'Upper East', 'Upper West', 'Bono', 'Bono East', 'Ahafo', 'Oti', 'Savannah',
  'North East', 'Western North',
];

export function isActive(row) {
  return !row || row.is_active !== false;
}

export function displayName(row) {
  if (!row) return '—';
  if (row.kind === 'business' && row.business_name) return row.business_name;
  const parts = [row.prefix, row.first_name, row.middle_name, row.last_name].filter(Boolean);
  if (parts.length >= 2) return parts.join(' ');
  return row.name || '—';
}

export function composeName({ kind, prefix, first_name, middle_name, last_name, business_name, name }) {
  if (kind === 'business') return String(business_name || name || '').trim();
  const parts = [prefix, first_name, middle_name, last_name].filter(Boolean);
  return (parts.join(' ') || name || '').trim();
}

export async function setPartyActive(kind, id, active) {
  const table = kind === 'supplier' ? 'suppliers' : 'customers';
  return supabase.from(table).update({ is_active: !!active }).eq('id', id);
}

export function downloadCsv(filename, headers, rows) {
  const cell = (v) => {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const csv = [headers.map(cell).join(','), ...rows.map((r) => r.map(cell).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

export async function loadLoyaltyHistory(customerId) {
  if (!customerId) return [];
  const { data } = await supabase.from('loyalty_ledger')
    .select('*').eq('customer_id', customerId)
    .order('created_at', { ascending: false }).limit(80);
  return data || [];
}

export async function groupSalesReport() {
  const groups = await loadCustomerGroups();
  const { data: customers } = await supabase.from('customers')
    .select('id, name, group_name, customer_group_id, opening_balance, is_default, is_active')
    .limit(800);
  const named = (customers || []).filter((c) => !isWalkIn(c));
  const { data: sales } = await supabase.from('sales_orders')
    .select('customer_id, customer_name, total_amount, status, payment_status, amount_paid')
    .limit(1200);
  const live = (sales || []).filter((s) => !/draft|quot|cancel/i.test(s.status || ''));
  return groups.map((g) => {
    const members = named.filter((c) =>
      (g.id && String(c.customer_group_id) === String(g.id))
      || String(c.group_name || '').toLowerCase() === String(g.name || '').toLowerCase()
    );
    const ids = new Set(members.map((m) => String(m.id)));
    const names = new Set(members.map((m) => m.name));
    const gs = live.filter((s) => ids.has(String(s.customer_id)) || names.has(s.customer_name));
    let sell = 0;
    let sellReturn = 0;
    let unpaid = 0;
    gs.forEach((s) => {
      const t = Number(s.total_amount) || 0;
      if (/return|refund/i.test(s.status || '')) {
        sellReturn += t;
        return;
      }
      sell += t;
      if (/unpaid|partial|credit|due/i.test(s.payment_status || s.status || '')) {
        unpaid += Math.max(0, t - (Number(s.amount_paid) || 0));
      }
    });
    const opening = members.reduce((a, c) => a + (Number(c.opening_balance) || 0), 0);
    return {
      id: g.id,
      name: g.name,
      pct: Number(g.calculation_percentage) || 0,
      price_group: g.price_group || '',
      customers: members.length,
      active: members.filter((m) => m.is_active !== false).length,
      sell,
      sellReturn,
      net: sell - sellReturn,
      due: unpaid + opening,
      opening,
    };
  });
}

export async function supplierProducts(supplier) {
  if (!supplier) return [];
  const filters = [];
  if (supplier.id) filters.push(`supplier_id.eq.${supplier.id}`);
  if (supplier.name) filters.push(`supplier_name.eq.${supplier.name}`);
  if (supplier.contact_code) filters.push(`supplier_code.eq.${supplier.contact_code}`);
  if (!filters.length) return [];
  let r = await supabase.from('products').select('id, name, sku, selling_price, cost_price, current_stock_value').or(filters.join(',')).limit(200);
  if (r.error && supplier.name) {
    r = await supabase.from('products').select('id, name, sku, selling_price, current_stock_value').limit(200);
  }
  if (r.error) return [];
  return r.data || [];
}
