/** HP phones back to Franko. Partner price = benchmark. Fiberk sell = reimbursement. Cost blank. */
import { esc } from './ls-rows.js';
import { supabase } from './supabaseClient.js';
import { bindTable } from './home-tables.js';
import { workbookBtn } from './hp-workbooks.js';
import { deskHowLink } from './desk-manual.js';
import { costFor, profitOf } from './hp-cost-book.js';

const JSON_URL = '/js/bnpl-field-phones.json';
const LS_KEY = 'df_bnpl_field_phones';

export const FRANKO = { id: 's-franko', name: 'Franko Trading' };
export const HP_PATH = ['Franko Trading', 'Operations Hub', 'BNPL Field Sales', 'Field Stock Hub', 'Customer'];

export const SKU_COLS = [
  { key: 'brand', label: 'Brand' },
  { key: 'brand_type', label: 'Model' },
  { key: 'supplier_name', label: 'Supplier' },
  { key: 'sold', label: 'Sold' },
  { key: 'on_hand', label: 'On hand' },
  { key: 'partner_price', label: 'Partner price (benchmark)' },
  { key: 'fiberk_sell', label: 'Fiberk sell' },
  { key: 'cost_price', label: 'Cost (Franko)' },
  { key: 'profit', label: 'Profit' },
];

export const UNIT_COLS = [
  { key: 'imei', label: 'IMEI' },
  { key: 'brand_type', label: 'Model' },
  { key: 'customer_name', label: 'Customer' },
  { key: 'sa_name', label: 'SA' },
  { key: 'partner_price', label: 'Partner price' },
  { key: 'fiberk_sell', label: 'Fiberk sell' },
  { key: 'cost_price', label: 'Cost (Franko)' },
  { key: 'profit', label: 'Profit' },
  { key: 'delivered_at', label: 'Delivered' },
  { key: 'path', label: 'Path' },
];

let _book = null;

function money(n) {
  if (n == null || n === '') return '—';
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('en-GH');
}

function band(min, max) {
  if (min == null && max == null) return '—';
  if (min === max) return money(min);
  return `${money(min)}–${money(max)}`;
}

export async function loadPhoneBook() {
  if (_book) return _book;
  try {
    const r = await Promise.race([
      supabase.from('bnpl_field_units').select('*').limit(8000),
      new Promise((resolve) => setTimeout(() => resolve({ data: null }), 2500)),
    ]);
    if (r?.data?.length) {
      _book = { skus: [], units: r.data, supplier: FRANKO };
      return _book;
    }
  } catch { /* local */ }
  try {
    const res = await fetch(JSON_URL, { cache: 'no-cache' });
    if (res.ok) {
      _book = await res.json();
      try { localStorage.setItem(LS_KEY, JSON.stringify(_book)); } catch { /* ignore */ }
      return _book;
    }
  } catch { /* ignore */ }
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) _book = JSON.parse(raw);
  } catch { /* ignore */ }
  return _book || { skus: [], units: [], supplier: FRANKO };
}

export async function loadUnits() {
  const b = await loadPhoneBook();
  return b.units || [];
}

export async function unitByImei(imei) {
  const id = String(imei || '').trim();
  if (!id) return null;
  return (await loadUnits()).find((u) => String(u.imei) === id) || null;
}

function pathLabel(u) {
  const p = u.path || HP_PATH;
  return p.join(' → ');
}

export function paintHpStock(app, { navHtml = '', liveStock = [] } = {}) {
  const wantImei = new URLSearchParams(location.search).get('imei') || '';
  const state = { brand: '', sku: '', q: wantImei };

  async function draw() {
    const book = await loadPhoneBook();
    const skus = book.skus || [];
    const units = book.units || [];
    const brands = [...new Set(skus.map((s) => s.brand).filter(Boolean))].sort();
    const brand = state.brand;
    const skuId = state.sku;
    const q = String(state.q || '').trim().toLowerCase();
    const shownSkus = skus.filter((s) => !brand || s.brand === brand);
    const shownUnits = units.filter((u) => {
      if (brand && u.brand !== brand) return false;
      if (skuId && u.sku_id !== skuId) return false;
      if (q) {
        const blob = [u.imei, u.brand_type, u.customer_name, u.phone, u.sa_name, u.order_id].join(' ').toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
    const sold = shownUnits.length;
    const fiberk = shownUnits.reduce((s, u) => s + (Number(u.fiberk_sell) || 0), 0);
    const partner = shownUnits.reduce((s, u) => s + (Number(u.partner_price) || 0), 0);
    const skuBody = shownSkus.map((s) => `<tr data-id="${esc(s.id)}">
      <td>${esc(s.brand)}</td>
      <td><a href="#" data-sku="${esc(s.id)}">${esc(s.brand_type)}</a></td>
      <td>${esc(s.supplier_name || FRANKO.name)}</td>
      <td class="fo-num">${s.sold}</td>
      <td class="fo-num">${s.on_hand || 0}</td>
      <td class="fo-num">${band(s.partner_price_min, s.partner_price_max)}</td>
      <td class="fo-num">${band(s.fiberk_sell_min, s.fiberk_sell_max)}</td>
      <td class="fo-num">${money(costFor(s.brand_type))}</td>
      <td class="fo-num">${money(profitOf(s.fiberk_sell_min, s.brand_type))}</td>
    </tr>`).join('');
    const unitBody = shownUnits.map((u) => `<tr data-id="${esc(u.imei)}" ${wantImei && u.imei === wantImei ? 'style="outline:2px solid #0f766e"' : ''}>
      <td class="fo-mono" title="${esc(u.imei)}"><a href="#" data-trail="${esc(u.phone)}">${esc(u.imei)}</a></td>
      <td title="${esc(u.brand_type)}">${esc(u.brand_type)}</td>
      <td><a href="#" data-trail="${esc(u.phone)}">${esc(u.customer_name || '—')}</a></td>
      <td>${esc(u.sa_name || '—')}</td>
      <td class="fo-num">${money(u.partner_price)}</td>
      <td class="fo-num">${money(u.fiberk_sell)}</td>
      <td class="fo-num">${money(costFor(u.brand_type))}</td>
      <td class="fo-num">${money(profitOf(u.fiberk_sell, u.brand_type))}</td>
      <td>${esc(String(u.delivered_at || '').slice(0, 16))}</td>
      <td title="${esc(pathLabel(u))}">Franko → … → customer</td>
    </tr>`).join('');
    const liveN = (liveStock || []).length;

    app.innerHTML = `
      ${navHtml}
      <div class="fo-ol">
        <div class="ops-toolbar">
          <p class="ops-sub">${deskHowLink('hp-01')}</p>
        </div>
        <form class="fo-ol-filters" id="fo-ph-form">
          <label>Brand
            <select name="brand">
              <option value="">All</option>
              ${brands.map((b) => `<option value="${esc(b)}" ${brand === b ? 'selected' : ''}>${esc(b)}</option>`).join('')}
            </select>
          </label>
          <label>Model
            <select name="sku">
              <option value="">All models</option>
              ${shownSkus.map((s) => `<option value="${esc(s.id)}" ${skuId === s.id ? 'selected' : ''}>${esc(s.brand_type)} (${s.sold})</option>`).join('')}
            </select>
          </label>
          <label>IMEI / customer
            <input name="q" value="${esc(state.q)}" placeholder="IMEI, name, SA…" />
          </label>
          <div class="fo-ol-actions">
            <button type="submit" class="ult-btn ult-btn-primary">Query</button>
            <button type="button" class="ult-btn ult-btn-outline" id="fo-ph-reset">Reset</button>
          </div>
        </form>
        <div class="fo-ol-kpis">
          <article><span>SKUs</span><b>${shownSkus.length}</b></article>
          <article><span>IMEIs sold</span><b>${sold}</b></article>
          <article><span>On hand</span><b>0</b></article>
          <article><span>Partner price</span><b>${money(partner)}</b></article>
          <article><span>Fiberk sell</span><b>${money(fiberk)}</b></article>
        </div>
        <div class="home-card" data-tbl="fo-skus">
          <div class="ss-head"><strong>HP SKUs · supplier Franko Trading</strong>${workbookBtn('s-hp-skus')}</div>
          <div class="bar">
            <label>Show <select data-tbl-size><option>10</option><option selected>25</option><option>50</option><option>All</option></select> entries</label>
            <div class="grow"></div>
            <button type="button" data-exp="csv">Export CSV</button>
            <input data-tbl-search placeholder="Search model…" />
          </div>
          <div class="ult-table-wrap"><table class="ult-table">
            <thead><tr>${SKU_COLS.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr></thead>
            <tbody>${skuBody || `<tr data-dummy="1"><td colspan="${SKU_COLS.length}">No SKUs.</td></tr>`}</tbody>
          </table></div>
          <div style="display:flex;justify-content:space-between;margin-top:8px"><div data-tbl-info></div><div class="pager" data-tbl-pager></div></div>
        </div>
        <div class="home-card" data-tbl="fo-units" style="margin-top:16px">
          <div class="ss-head"><strong>IMEI register · sold through Field Stock Hub</strong>${workbookBtn('s-hp-imeis')}</div>
          <div class="bar">
            <label>Show <select data-tbl-size><option>10</option><option selected>25</option><option>50</option><option>100</option><option>All</option></select> entries</label>
            <div class="grow"></div>
            <button type="button" data-exp="csv">Export CSV</button>
            <button type="button" data-exp="xls">Export Excel</button>
            <input data-tbl-search placeholder="Search IMEI, customer…" />
          </div>
          <div class="ult-table-wrap"><table class="ult-table">
            <thead><tr>${UNIT_COLS.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr></thead>
            <tbody>${unitBody || `<tr data-dummy="1"><td colspan="${UNIT_COLS.length}">No IMEIs in this filter.</td></tr>`}</tbody>
          </table></div>
          <div style="display:flex;justify-content:space-between;margin-top:8px"><div data-tbl-info></div><div class="pager" data-tbl-pager></div></div>
        </div>
        ${liveN ? `<p class="ops-sub">${deskHowLink('hp-01')}</p>` : ''}
      </div>`;

    bindTable(app.querySelector('[data-tbl="fo-skus"]'), { title: 'HP SKUs', storageKey: 'fo-hp-skus' });
    bindTable(app.querySelector('[data-tbl="fo-units"]'), { title: 'HP IMEIs', storageKey: 'fo-hp-units' });
    const form = app.querySelector('#fo-ph-form');
    form.onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      state.brand = String(fd.get('brand') || '');
      state.sku = String(fd.get('sku') || '');
      state.q = String(fd.get('q') || '');
      draw();
    };
    app.querySelector('#fo-ph-reset').onclick = () => {
      state.brand = '';
      state.sku = '';
      state.q = '';
      draw();
    };
    app.querySelectorAll('[data-sku]').forEach((el) => {
      el.onclick = (e) => {
        e.preventDefault();
        state.sku = el.dataset.sku;
        draw();
      };
    });
    try { await import('./hp-trail.js').then((m) => m.bindTrailLinks(app)); } catch { /* */ }
    if (wantImei) {
      const row = app.querySelector(`tr[data-id="${CSS.escape(wantImei)}"]`);
      if (row) row.scrollIntoView({ block: 'center' });
    }
  }
  return draw();
}
