/**
 * Field Ops lives twice: inside the ERP (signed-in module) and outside
 * (public landing Field Ops). They share this snapshot so the two sides
 * stay in step without copying the whole ERP.
 */
import { readLs, writeLs } from './ls-rows.js';

export const PUBLIC_KEY = 'df_field_ops_public';
export const INSIDE_FLAG = 'df_field_ops_inside';
export const JOIN_KEY = 'df_field_ops_leads';

export function readJoinLeads() {
  return readLs(JOIN_KEY, []);
}

export function saveJoinLead(lead) {
  const rows = readJoinLeads();
  const next = [{
    id: 'jl-' + Date.now().toString(36),
    created_at: new Date().toISOString(),
    status: 'new',
    name: String(lead.name || '').trim(),
    phone: String(lead.phone || '').trim(),
    area: String(lead.area || '').trim(),
    interest: lead.interest === 'customer' ? 'customer' : 'agent',
    note: String(lead.note || '').trim(),
  }, ...rows].slice(0, 500);
  writeLs(JOIN_KEY, next);
  return next[0];
}

export function deleteJoinLead(id) {
  const next = readJoinLeads().filter((r) => String(r.id) !== String(id));
  writeLs(JOIN_KEY, next);
  return next;
}

export function readPublicSnapshot() {
  return readLs(PUBLIC_KEY, {
    published_at: '',
    agents: [],
    customers: [],
    visits: [],
    stock_hub: [],
    open_books: [],
  });
}

export function publishPublicSnapshot(payload) {
  const next = {
    published_at: new Date().toISOString(),
    agents: payload.agents || [],
    customers: payload.customers || [],
    visits: payload.visits || [],
    stock_hub: payload.stock_hub || [],
    open_books: payload.open_books || [],
    source: 'erp',
  };
  writeLs(PUBLIC_KEY, next);
  try { localStorage.setItem(INSIDE_FLAG, '1'); } catch { /* ignore */ }
  return next;
}

export function publicAge(snap = readPublicSnapshot()) {
  if (!snap?.published_at) return 'Never published';
  const t = new Date(snap.published_at).getTime();
  if (!t) return 'Never published';
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return 'Just now';
  if (mins === 1) return '1 minute ago';
  if (mins < 60) return mins + ' minutes ago';
  const hrs = Math.round(mins / 60);
  return hrs + ' hour' + (hrs === 1 ? '' : 's') + ' ago';
}
