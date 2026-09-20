/** Shared product filter panel — List Products and Product Catalog. */
import { esc } from './ls-rows.js';
import { locationsFor } from './scope.js';
import { getActiveSubsidiary } from './supabaseClient.js';
import { DEPARTMENTS, operationalSubsidiaryOptions, chainOf, departmentOfLocation } from './org-chain.js';
import { isHqRole, isGroupOperatorRole } from './access-rules.js';
import { getAccess } from './rbac.js';

export const PRODUCT_FILT_KEY = 'df_product_filter_bar';
export const PRODUCT_FILT_OPTS = [
  ['sub', 'Subsidiary'], ['loc', 'Business Location'], ['branch', 'Branch'],
  ['type', 'Product Type'], ['dept', 'Department'], ['category', 'Category'], ['subcat', 'Subcategory'],
  ['brand', 'Brand'], ['model', 'Model'], ['size', 'Size'], ['color', 'Color'],
  ['unit', 'Unit'], ['tax', 'Tax'], ['from', 'From Date'], ['to', 'To Date'],
  ['woo', 'WooCommerce'], ['nosell', 'Not for selling'],
];

export function emptyProductFilters() {
  return {
    type: '', category: '', subcat: '', brand: '', unit: '', tax: '', loc: '',
    sub: '', dept: '', branch: '', model: '', size: '', color: '',
    nosell: false, woo: false, from: '', to: '', q: '', listings: false,
  };
}

export function loadFiltBar() {
  const base = Object.fromEntries(PRODUCT_FILT_OPTS.map(([k]) => [k, true]));
  try { return { ...base, ...JSON.parse(localStorage.getItem(PRODUCT_FILT_KEY) || '{}') }; } catch { return base; }
}

export function saveFiltBar(m) {
  try { localStorage.setItem(PRODUCT_FILT_KEY, JSON.stringify(m)); } catch { /* ignore */ }
}

export function showFilt(bar, k) {
  return bar[k] !== false;
}

export function hqFiltersOn() {
  const name = getAccess()?.roleName || getAccess()?.role;
  return isHqRole(name) || isGroupOperatorRole(name);
}

function uniq(vals) {
  return [...new Set((vals || []).filter(Boolean))];
}

function opt(arr, cur) {
  return arr.map((v) => `<option ${cur === v ? 'selected' : ''}>${esc(v)}</option>`).join('');
}

function inferSub(p) {
  const raw = String(p.subsidiary_code || '').toLowerCase();
  if (raw && raw !== 'group') return raw;
  return '';
}

export function applyProductFilters(rows, F) {
  let out = (rows || []).slice();
  if (F.q) {
    const q = String(F.q).toLowerCase();
    out = out.filter((p) => `${p.name || ''} ${p.sku || ''} ${p.brand || ''} ${p.category || ''} ${p.subcategory || ''}`.toLowerCase().includes(q));
  }
  if (F.sub) out = out.filter((p) => inferSub(p) === F.sub);
  if (F.type) out = out.filter((p) => String(p.product_type || p.type || 'simple') === F.type);
  if (F.category) out = out.filter((p) => p.category === F.category);
  if (F.subcat) out = out.filter((p) => p.subcategory === F.subcat);
  if (F.brand) out = out.filter((p) => p.brand === F.brand);
  if (F.unit) out = out.filter((p) => (p.unit || 'pcs') === F.unit);
  if (F.tax) out = out.filter((p) => String(p.tax || p.tax_name || '') === F.tax);
  if (F.loc) out = out.filter((p) => (p.location_code || '') === F.loc || (p.location_code === 'DEL-FURN' && F.loc === 'DEL-ONLINE'));
  if (F.dept) out = out.filter((p) => (departmentOfLocation(p.location_code)?.code || chainOf(p).department || '') === F.dept);
  if (F.branch) out = out.filter((p) => String(p.branch || p.branch_name || chainOf(p).department || '') === F.branch);
  if (F.model) out = out.filter((p) => String(p.model || p.device_model || '') === F.model);
  if (F.size) out = out.filter((p) => String(p.size || '') === F.size);
  if (F.color) out = out.filter((p) => String(p.color || p.colour || '') === F.color);
  if (F.nosell) out = out.filter((p) => p.not_for_selling === true || p.is_active === false);
  if (F.woo) out = out.filter((p) => p.woocommerce_enabled === true);
  const rowDay = (p) => String(p.updated_at || p.created_at || p.date || p.added_on || '').slice(0, 10);
  if (F.from) out = out.filter((p) => !rowDay(p) || rowDay(p) >= F.from);
  if (F.to) out = out.filter((p) => !rowDay(p) || rowDay(p) <= F.to);
  return out;
}

export function readProductFilterDom(F) {
  const val = (id) => document.getElementById(id)?.value || '';
  const chk = (id) => !!document.getElementById(id)?.checked;
  F.type = val('f-type');
  F.category = val('f-cat');
  F.subcat = val('f-subcat');
  F.unit = val('f-unit');
  F.tax = val('f-tax');
  F.brand = val('f-brand');
  F.loc = val('f-loc');
  F.sub = val('f-sub');
  F.dept = val('f-dept');
  F.branch = val('f-branch');
  F.model = val('f-model');
  F.size = val('f-size');
  F.color = val('f-color');
  F.nosell = chk('f-nosell');
  F.woo = chk('f-woo');
  F.from = val('f-from');
  F.to = val('f-to');
  F.listings = chk('f-listings');
  F.q = document.getElementById('q')?.value || F.q;
  return F;
}

export function bindProductFilterDom(onChange) {
  const ids = ['f-type','f-cat','f-subcat','f-unit','f-tax','f-brand','f-loc','f-sub','f-dept','f-branch','f-model','f-size','f-color','f-nosell','f-woo','f-from','f-to','f-listings','q'];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.onchange = onChange;
  });
  document.getElementById('q')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') onChange();
  });
}

export function productFilterPanelHtml({ F, scoped, filtBar, extraChecks = '', open = false }) {
  const showF = (k) => filtBar[k] !== false;
  const shops = locationsFor(getActiveSubsidiary()?.code || 'group', { forSale: true });
  const locOpts = shops.map((l) => `<option value="${l.code}" ${F.loc === l.code ? 'selected' : ''}>${esc(l.name)}</option>`).join('');
  const hq = hqFiltersOn();
  return `
    <details class="filter-panel filt-drop" id="filt-box" ${open ? 'open' : ''}>
      <summary id="filt-tog">Filters</summary>
      <div class="filt-drop-body">
        <div class="fp-row fp-row-3">
          ${showF('sub') ? `<div class="fp-field"><label>Subsidiary</label><select id="f-sub"><option value="">All</option>
            ${operationalSubsidiaryOptions().filter((s) => s.code !== 'ops').map((s) => `<option value="${s.code}" ${F.sub === s.code ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
          </select></div>` : ''}
          ${showF('loc') ? `<div class="fp-field"><label>Business Location</label><select id="f-loc"><option value="">All</option>${locOpts}</select></div>` : ''}
          ${showF('branch') ? `<div class="fp-field"><label>Branch</label><select id="f-branch"><option value="">All</option>${opt(uniq(scoped.map((p) => p.branch || p.branch_name || chainOf(p).department)), F.branch)}</select></div>` : ''}
        </div>
        <div class="fp-row fp-row-4">
          ${showF('type') ? `<div class="fp-field"><label>Product Type</label><select id="f-type"><option value="">All</option>
            <option value="simple" ${F.type === 'simple' ? 'selected' : ''}>Single</option>
            <option value="variable" ${F.type === 'variable' ? 'selected' : ''}>Variable</option>
            <option value="combo" ${F.type === 'combo' ? 'selected' : ''}>Combo</option></select></div>` : ''}
          ${showF('dept') ? `<div class="fp-field"><label>Department</label><select id="f-dept"><option value="">All</option>
            ${DEPARTMENTS.filter((d) => !F.sub || d.subsidiary === F.sub).map((d) => `<option value="${d.code}" ${F.dept === d.code ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}
          </select></div>` : ''}
          ${showF('category') ? `<div class="fp-field"><label>Category</label><select id="f-cat"><option value="">All</option>${opt(uniq(scoped.map((p) => p.category)).sort(), F.category)}</select></div>` : ''}
          ${showF('subcat') ? `<div class="fp-field"><label>Subcategory</label><select id="f-subcat"><option value="">All</option>${opt(uniq(scoped.filter((p) => !F.category || p.category === F.category).map((p) => p.subcategory)).sort(), F.subcat)}</select></div>` : ''}
        </div>
        <div class="fp-row fp-row-8">
          ${showF('brand') ? `<div class="fp-field"><label>Brand</label><select id="f-brand"><option value="">All</option>${opt(uniq(scoped.map((p) => p.brand)), F.brand)}</select></div>` : ''}
          ${showF('model') ? `<div class="fp-field"><label>Model</label><select id="f-model"><option value="">All</option>${opt(uniq(scoped.map((p) => p.model || p.device_model)), F.model)}</select></div>` : ''}
          ${showF('size') ? `<div class="fp-field"><label>Size</label><select id="f-size"><option value="">All</option>${opt(uniq(scoped.map((p) => p.size)), F.size)}</select></div>` : ''}
          ${showF('color') ? `<div class="fp-field"><label>Color</label><select id="f-color"><option value="">All</option>${opt(uniq(scoped.map((p) => p.color || p.colour)), F.color)}</select></div>` : ''}
          ${showF('unit') ? `<div class="fp-field"><label>Unit</label><select id="f-unit"><option value="">All</option>${opt(uniq(scoped.map((p) => p.unit || 'pcs')), F.unit)}</select></div>` : ''}
          ${showF('tax') ? `<div class="fp-field"><label>Tax</label><select id="f-tax"><option value="">All</option>${opt(uniq(scoped.map((p) => p.tax || p.tax_name)), F.tax)}</select></div>` : ''}
          ${showF('from') ? `<div class="fp-field"><label>From Date</label><input type="date" id="f-from" value="${esc(F.from || '')}" /></div>` : ''}
          ${showF('to') ? `<div class="fp-field"><label>To Date</label><input type="date" id="f-to" value="${esc(F.to || '')}" /></div>` : ''}
        </div>
        <div class="fp-row-end">
          <div class="fp-checks">
            ${showF('woo') ? `<label class="filt-check"><input type="checkbox" id="f-woo" ${F.woo ? 'checked' : ''}/> WooCommerce</label>` : ''}
            ${showF('nosell') ? `<label class="filt-check"><input type="checkbox" id="f-nosell" ${F.nosell ? 'checked' : ''}/> Not for selling</label>` : ''}
            ${extraChecks}
          </div>
          <div class="fp-actions">
            <button type="button" id="filt-clear">Clear Filters</button>
            ${hq ? `<details class="filt-hq"><summary>Filter List</summary>
              <div class="filt-hq-list">${PRODUCT_FILT_OPTS.map(([k, l]) => `<label class="filt-check"><input type="checkbox" data-filt-key="${k}" ${showF(k) ? 'checked' : ''}/> ${l}</label>`).join('')}</div>
            </details>` : ''}
          </div>
        </div>
      </div>
    </details>`;
}
