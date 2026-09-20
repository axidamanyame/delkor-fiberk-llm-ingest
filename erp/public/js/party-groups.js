/** Shared list + edit for customer / supplier / client groups. */
import { pageChrome } from './ultimate-shell.js';
import { confirmAction, ackResult } from './confirm-action.js';
import { bindTable } from './home-tables.js';
import { SCOPE_EVENT, scopeCaption } from './scope.js';
import { subsidiaryLabel, stampScope, subsidiarySelect } from './entity-scope.js';
import { loadRows, saveRow, deleteRow } from './ls-rows.js';
import { KEYS, SEED_GROUPS, SEED_SUPPLIER_GROUPS, SEED_CLIENT_GROUPS } from './catalog-seed.js';

export const PARTY_GROUPS = {
  customer: {
    title: 'Customer Groups',
    noun: 'Customer Group',
    table: 'customer_groups',
    key: KEYS.groups,
    seed: SEED_GROUPS,
    list: '/customer-groups.html',
    edit: '/group-edit.html?kind=customer',
  },
  supplier: {
    title: 'Supplier Groups',
    noun: 'Supplier Group',
    table: 'supplier_groups',
    key: KEYS.supplier_groups,
    seed: SEED_SUPPLIER_GROUPS,
    list: '/supplier-groups.html',
    edit: '/group-edit.html?kind=supplier',
  },
  client: {
    title: 'Client Groups',
    noun: 'Client Group',
    table: 'client_groups',
    key: KEYS.client_groups,
    seed: [],
    list: '/client-groups.html',
    edit: '/group-edit.html?kind=client',
  },
};

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;' }[c]));
}

export function groupKind() {
  const q = new URLSearchParams(location.search).get('kind');
  const file = (location.pathname.split('/').pop() || '').toLowerCase();
  if (q && PARTY_GROUPS[q]) return q;
  if (file.startsWith('supplier-group')) return 'supplier';
  if (file.startsWith('client-group')) return 'client';
  return 'customer';
}

export async function bootPartyGroupList(kind = groupKind()) {
  const cfg = PARTY_GROUPS[kind] || PARTY_GROUPS.customer;
  const app = document.getElementById('app');
  async function load() {
    const data = await loadRows(cfg.table, cfg.key, cfg.seed);
    const rows = data.length ? data : cfg.seed;
    app.innerHTML = `
      ${pageChrome(cfg.title, kind === 'client'
        ? 'Investors, Partners, and Consultants. Add more groups as needed.'
        : kind === 'supplier'
          ? 'Same structure as Customer Groups for now — used when purchasing and paying suppliers.'
          : scopeCaption())}
      <div class="card" data-tbl="groups">
        <div class="head"><h2>All ${esc(cfg.title)}</h2><a class="add" href="${cfg.edit}">+ Add</a></div>
        <div class="bar">
          <label>Show <select data-tbl-size><option selected>25</option><option>50</option><option>100</option><option>All</option></select> entries</label>
          <div class="grow"></div>
          <button type="button" data-exp="csv">Export CSV</button>
          <button type="button" data-exp="xls">Export Excel</button>
          <button type="button" data-exp="print">Print</button>
          <button type="button" data-exp="cols">Column visibility</button>
          <input data-tbl-search placeholder="Search …" />
        </div>
        <div class="ult-table-wrap"><table class="ult-table">
          <thead><tr>
            <th>${esc(cfg.noun)} Name</th>
            <th>Calculation Percentage (%)</th>
            <th>${kind === 'client' ? 'Type' : 'Selling Price Group'}</th>
            <th>Notes</th>
            <th>Subsidiary</th>
            <th>Action</th>
          </tr></thead>
          <tbody>${rows.map((g) => `<tr data-id="${esc(g.id)}">
            <td>${esc(g.name)}</td>
            <td>${esc(g.calculation_percentage ?? g.percent ?? g.amount ?? 0)}</td>
            <td>${esc(g.price_group || g.selling_price_group || g.kind || '')}</td>
            <td>${esc(g.notes || '')}</td>
            <td>${esc(subsidiaryLabel(g.subsidiary_code))}</td>
            <td>
              <a class="btn-edit" href="${cfg.edit}&id=${encodeURIComponent(g.id)}">✎ Edit</a>
              <button type="button" class="btn-del" data-del="${esc(g.id)}">🗑 Delete</button>
            </td>
          </tr>`).join('') || '<tr data-dummy="1"><td colspan="6" style="text-align:center">No data available in table</td></tr>'}</tbody>
        </table></div>
        <div style="display:flex;justify-content:space-between;margin-top:10px"><div data-tbl-info></div><div class="pager" data-tbl-pager></div></div>
      </div>`;
    bindTable(app.querySelector('[data-tbl="groups"]'), { title: cfg.title, storageKey: kind + '-groups' });
    app.querySelectorAll('[data-del]').forEach((b) => {
      b.onclick = async () => {
        if (!(await confirmAction('Delete this group?', 'This cannot be undone.'))) return;
        const r = await deleteRow(cfg.table, cfg.key, b.dataset.del);
        if (r?.cancelled) return;
        ackResult(true, 'Group deleted.');
        load();
      };
    });
  }
  window.addEventListener(SCOPE_EVENT, load);
  await load();
}

export async function bootPartyGroupEdit(kind = groupKind()) {
  const cfg = PARTY_GROUPS[kind] || PARTY_GROUPS.customer;
  const id = new URLSearchParams(location.search).get('id');
  const app = document.getElementById('app');
  const rows = await loadRows(cfg.table, cfg.key, cfg.seed);
  let row = rows.find((r) => String(r.id) === String(id)) || {
    name: '', calc_type: 'percentage', calculation_percentage: '', price_group: '', notes: '',
  };
  const v = (k) => row[k] ?? '';
  app.innerHTML = `
    ${pageChrome((id ? 'Edit' : 'Add') + ' ' + cfg.noun, cfg.title)}
    <form id="f" class="ult-card" style="max-width:640px">
      ${subsidiarySelect(row.subsidiary_code || '')}
      <label>${esc(cfg.noun)} Name:*</label>
      <input name="name" required value="${esc(v('name'))}" />
      <label>Price calculation type:</label>
      <select name="calc_type">
        <option value="percentage" ${v('calc_type') !== 'selling_price_group' ? 'selected' : ''}>Percentage</option>
        <option value="selling_price_group" ${v('calc_type') === 'selling_price_group' ? 'selected' : ''}>Selling Price Group</option>
      </select>
      <div id="pct-wrap">
        <label>Calculation Percentage (%):</label>
        <input name="calculation_percentage" type="number" step="0.01" value="${esc(v('calculation_percentage') ?? v('amount') ?? '')}" />
      </div>
      <div id="pg-wrap" ${v('calc_type') === 'selling_price_group' ? '' : 'hidden'}>
        <label>${kind === 'client' ? 'Type' : 'Selling Price Group'}</label>
        <input name="price_group" value="${esc(v('price_group') || v('selling_price_group') || '')}" />
      </div>
      <label>Notes</label>
      <input name="notes" value="${esc(v('notes'))}" />
      <div class="row" style="display:flex;gap:8px;justify-content:flex-end;margin-top:18px">
        <button type="submit" class="save" style="background:#4f46e5;color:#fff;border:0;border-radius:8px;padding:10px 18px;font-weight:700">Save</button>
        <a class="close" href="${cfg.list}" style="background:#111;color:#fff;border:0;border-radius:8px;padding:10px 18px;text-decoration:none">Close</a>
      </div>
    </form>`;
  const typeSel = document.querySelector('[name="calc_type"]');
  const syncType = () => {
    const spg = typeSel.value === 'selling_price_group';
    document.getElementById('pct-wrap').hidden = spg;
    document.getElementById('pg-wrap').hidden = !spg;
  };
  typeSel.onchange = syncType;
  syncType();
  document.getElementById('f').onsubmit = async (e) => {
    e.preventDefault();
    if (!(await confirmAction('Save this group?', 'Writes the group for the selected subsidiary.'))) return;
    const fd = new FormData(e.target);
    const body = {
      ...row,
      id: row.id,
      name: String(fd.get('name') || '').trim(),
      calc_type: fd.get('calc_type'),
      calculation_percentage: Number(fd.get('calculation_percentage') || 0),
      price_group: fd.get('price_group') || null,
      notes: fd.get('notes') || '',
      kind,
    };
    try { stampScope(body, e.target); } catch (ex) { ackResult(false, ex.message); return; }
    await saveRow(cfg.table, cfg.key, body);
    ackResult(true, cfg.noun + ' saved.');
    location.href = cfg.list;
  };
}
