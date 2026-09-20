/**
 * Payment accounts + stock transfer / adjustment rules (Delkor-Fiberk ERP).
 * - Account balance = opening_balance + signed txns
 * - Fund transfer writes transfer_out + transfer_in
 * - Stock transfer changes stock ONLY when status becomes completed
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

export async function peelWrite(table, payload, opts = {}) {
  const row = { ...payload };
  Object.keys(row).forEach((k) => { if (row[k] === '') row[k] = null; });
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  function isUuid(v) {
    return UUID_RE.test(String(v || '').trim());
  }
  const id0 = opts.id || row.id;
  let id = id0;
  function persistLocal(saved) {
    try {
      const keys = ['df_' + table];
      if (table === 'profiles') keys.push('df_users');
      if (table === 'users') keys.push('df_profiles');
      if (table === 'app_roles') keys.push('df_roles');
      const next = { ...(saved || {}), ...payload, id: payload.id || saved?.id || id || (crypto.randomUUID?.() || ('id-' + Date.now())) };
      for (const key of keys) {
        let rows = [];
        try { rows = JSON.parse(localStorage.getItem(key) || '[]'); } catch { rows = []; }
        if (!Array.isArray(rows)) rows = [];
        const i = rows.findIndex((r) => String(r.id) === String(next.id));
        if (i >= 0) rows[i] = { ...rows[i], ...next };
        else rows.unshift(next);
        localStorage.setItem(key, JSON.stringify(rows));
      }
      return next;
    } catch {
      return { ...payload, ...(saved || {}) };
    }
  }
  function rlsBlocked(err) {
    const m = String(err?.message || err?.code || '');
    return /42501|row-level security|RLS/i.test(m);
  }
  function schemaMiss(err) {
    const m = String(err?.message || err?.code || '');
    return /PGRST205|PGRST204|42703|22P02|invalid input syntax for type uuid|does not exist|schema cache|Could not find the table/i.test(m);
  }
  function badColumn(err) {
    const m = String(err?.message || '').match(/Could not find the '([^']+)' column/i)
      || String(err?.message || '').match(/column "([^"]+)" of relation/i)
      || String(err?.message || '').match(/column "([^"]+)"/i)
      || String(err?.message || '').match(/Could not find the '([^']+)'/);
    return m?.[1] || null;
  }
  function uuidOffender(err, body) {
    if (!/22P02|invalid input syntax for type uuid/i.test(String(err?.message || err?.code || ''))) return null;
    const quoted = String(err?.message || '').match(/invalid input syntax for type uuid:\s*"([^"]+)"/i);
    const badVal = quoted?.[1];
    if (badVal) {
      const hit = Object.keys(body).find((k) => String(body[k]) === badVal);
      if (hit) return hit;
    }
    return ['role_id', 'id', 'user_id', 'parent_id'].find((k) => k in body && body[k] != null && !isUuid(body[k])) || null;
  }
  function fkAuth(err) {
    return /profiles_id_fkey/i.test(String(err?.message || err || ''));
  }
  function coerceFail(err) {
    const m = String(err?.message || err?.code || '');
    return /PGRST116|coerce the result to a single JSON/i.test(m);
  }
  async function run(kind) {
    let body = { ...row };
    if (table === 'profiles' && body.role_id != null && !isUuid(body.role_id)) {
      delete body.role_id;
    }
    if (table === 'app_roles' && body.id != null && !isUuid(body.id)) {
      delete body.id;
    }
    ['updated_at', 'created_at', '_localOnly', '_error', '_shared'].forEach((k) => { delete body[k]; });
    if (kind === 'update') delete body.id;
    async function send(kindNow, payload) {
      if (kindNow === 'update') {
        const q = await supabase.from(table).update(payload).eq('id', id).select('*').maybeSingle();
        if (q.error && coerceFail(q.error)) {
          const u = await supabase.from(table).update(payload).eq('id', id);
          if (!u.error) return { data: persistLocal(payload), error: null };
        }
        return q;
      }
      const q = await supabase.from(table).insert(payload).select('*').maybeSingle();
      if (q.error && coerceFail(q.error)) {
        const u = await supabase.from(table).insert(payload);
        if (!u.error) return { data: persistLocal(payload), error: null };
      }
      return q;
    }
    let q = await send(kind, body);
    if (fkAuth(q.error)) {
      persistLocal(payload);
      return { data: persistLocal(payload), error: null, localOnly: true };
    }
    if (!q.error && q.data) return { ...q, data: persistLocal(q.data) };
    if (table === 'profiles' && id && (!q.data || q.error)) {
      const patch = {};
      Object.entries(body).forEach(([k, v]) => {
        if (v == null || v === '') return;
        if (typeof v === 'object') return;
        patch[k] = v;
      });
      const rpc = await supabase.rpc('df_patch_profile', { target: id, patch });
      if (fkAuth(rpc?.error)) {
        persistLocal(payload);
        return { data: persistLocal(payload), error: null, localOnly: true };
      }
      if (!rpc.error && rpc.data && rpc.data._skipped) {
        persistLocal(payload);
        return { data: persistLocal(payload), error: null, localOnly: true };
      }
      if (!rpc.error && rpc.data) return { data: persistLocal(rpc.data), error: null };
      persistLocal(payload);
      return {
        data: persistLocal(payload),
        error: { message: rpc?.error?.message || q.error?.message || 'Profile write blocked. Run sql/133_profile_write.sql with the green Run button.' },
        localOnly: true,
      };
    }
    if (!q.error && !q.data) {
      persistLocal(payload);
      return { data: persistLocal(payload), error: { message: 'Could not write this person to the company book. Run sql/133_profile_write.sql in Supabase, then try Update again.' }, localOnly: true };
    }
    if (rlsBlocked(q.error) || coerceFail(q.error)) {
      persistLocal(payload);
      return { data: persistLocal(payload), error: q.error, localOnly: true };
    }
    for (let i = 0; i < 14; i++) {
      const col = badColumn(q.error) || uuidOffender(q.error, body);
      if (!col || !(col in body)) break;
      delete body[col];
      q = await send(kind, body);
      if (!q.error && q.data) return { ...q, data: persistLocal(q.data) };
      if (!q.error && !q.data) {
        persistLocal(payload);
        return { data: persistLocal(payload), error: { message: 'Could not write this person to the company book. Run sql/133_profile_write.sql in Supabase, then try Update again.' }, localOnly: true };
      }
      if (rlsBlocked(q.error) || coerceFail(q.error)) {
        persistLocal(payload);
        return { data: persistLocal(payload), error: q.error, localOnly: true };
      }
    }
    persistLocal(payload);
    return schemaMiss(q.error) ? { data: persistLocal(payload), error: null } : { ...q, localOnly: true };
  }
  if (table === 'profiles') {
    const patch = {};
    Object.entries(row).forEach(([k, v]) => {
      if (v == null || v === '') return;
      if (typeof v === 'object') return;
      if (['id', 'created_at', 'updated_at', 'role_id'].includes(k)) return;
      patch[k] = v;
    });
    const target = isUuid(id) ? id : '00000000-0000-4000-8000-000000000000';
    const rpc = await supabase.rpc('df_patch_profile', { target, patch });
    if (!rpc.error && rpc.data && !rpc.data._skipped) {
      return { data: persistLocal(rpc.data), error: null };
    }
    persistLocal(payload);
    if (rpc?.error && !/409|duplicate|unique|profiles_id_fkey/i.test(String(rpc.error.message || ''))) {
      return {
        data: persistLocal(payload),
        error: { message: rpc.error.message },
        localOnly: true,
      };
    }
    return { data: persistLocal(payload), error: null, localOnly: true };
  }
  if (table === 'app_roles') {
    if (!isUuid(id) && row.name) {
      try {
        const found = await supabase.from('app_roles').select('id').ilike('name', String(row.name).trim()).maybeSingle();
        if (found?.data?.id && isUuid(found.data.id)) id = found.data.id;
      } catch { /* insert a new company row */ }
    }
    if (!isUuid(id)) {
      delete row.id;
      id = undefined;
      return run('insert');
    }
  }
  if (id) return run('update');
  return run('insert');
}

export function signForType(type) {
  if (['deposit', 'transfer_in', 'sale', 'customer'].includes(type)) return 1;
  if (['withdraw', 'transfer_out', 'purchase', 'expense', 'supplier'].includes(type)) return -1;
  return 1;
}

export function accountBalance(account, txns) {
  const open = Number(account.opening_balance || 0);
  const mine = (txns || []).filter((t) => t.account_id === account.id);
  const delta = mine.reduce((s, t) => s + signForType(t.txn_type) * Number(t.amount || 0), 0);
  return open + delta;
}

export async function postTxn(row) {
  if (!row.account_id) throw new Error('Choose a payment account.');
  if (!(Number(row.amount) > 0)) throw new Error('Amount must be greater than 0.');
  const { data, error } = await supabase.from('payment_account_txns').insert({
    account_id: row.account_id,
    contra_account_id: row.contra_account_id || null,
    txn_type: row.txn_type,
    amount: Number(row.amount),
    method: row.method || null,
    ref: row.ref || null,
    paid_on: row.paid_on || new Date().toISOString().slice(0, 10),
    location_code: row.location_code || null,
    party_type: row.party_type || null,
    party_id: row.party_id || null,
    note: row.note || null,
  }).select('*').single();
  if (error) throw error;
  return data;
}

export async function fundTransfer({ fromId, toId, amount, paid_on, note, ref }) {
  if (!fromId || !toId) throw new Error('Choose both accounts.');
  if (fromId === toId) throw new Error('Cannot transfer to the same account.');
  const amt = Number(amount);
  if (!(amt > 0)) throw new Error('Amount must be greater than 0.');
  const paidOn = paid_on || new Date().toISOString().slice(0, 10);
  const out = await postTxn({
    account_id: fromId, contra_account_id: toId,
    txn_type: 'transfer_out', amount: amt, paid_on: paidOn, note, ref,
  });
  await postTxn({
    account_id: toId, contra_account_id: fromId,
    txn_type: 'transfer_in', amount: amt, paid_on: paidOn, note, ref,
  });
  return out;
}

export function statusPill(s) {
  const v = String(s || 'pending');
  const color = v === 'completed' ? '#16a34a' : v === 'cancelled' ? '#dc2626' : v === 'in_transit' ? '#2563eb' : '#a16207';
  return `<span style="color:${color};font-weight:600">${esc(v)}</span>`;
}

export async function nextRef(table, prefix) {
  const { data } = await supabase.from(table).select('ref_no').limit(400);
  let max = 1;
  (data || []).forEach((r) => {
    const n = Number(String(r.ref_no || '').replace(/\D/g, ''));
    if (n >= max) max = n + 1;
  });
  return prefix + '-' + String(max).padStart(4, '0');
}

/** Stock only moves when a transfer is marked completed. */
export async function setTransferStatus(id, next) {
  const { data: row, error } = await supabase.from('stock_transfers').select('*').eq('id', id).single();
  if (error || !row) throw new Error(error?.message || 'Transfer not found');
  if (row.status === 'completed' && next !== 'completed') {
    throw new Error('Completed transfers cannot be reopened (stock already moved).');
  }
  const { error: e2 } = await supabase.from('stock_transfers').update({ status: next }).eq('id', id);
  if (e2) throw e2;
  return { ...row, status: next, stockMoved: next === 'completed' && row.status !== 'completed' };
}
