import { registerClickGuard, PRIORITY } from './click-router.js';
/**
 * Desk chrome: preview-first hops, green Home/Back, filter grouping helpers.
 * In-page links that leave the current file open a read-only preview.
 * Go To Page is required to actually enter that desk.
 */
const STACK_KEY = 'df_desk_back';

function sameDeskUrl(a, b) {
  const n = (h) => String(h || '').split('#')[0];
  return n(a) === n(b);
}

function readStack() {
  try {
    const stack = JSON.parse(sessionStorage.getItem(STACK_KEY) || '[]');
    return Array.isArray(stack) ? stack : [];
  } catch { return []; }
}

function writeStack(stack) {
  try { sessionStorage.setItem(STACK_KEY, JSON.stringify((stack || []).slice(-24))); } catch { /* ignore */ }
}

export function pushDeskBack(explicit) {
  try {
    const here = typeof explicit === 'string'
      ? explicit
      : (explicit?.href || (location.pathname + location.search + location.hash));
    if (!here) return;
    if (/login\.html|till-login|index\.html/i.test(here.split('?')[0])) return;
    const stack = readStack();
    if (stack.length && sameDeskUrl(stack[stack.length - 1].href, here)) return;
    stack.push({ href: here, title: document.title || here, at: Date.now() });
    writeStack(stack);
  } catch { /* ignore */ }
}

export function peekDeskBack() {
  try {
    const stack = JSON.parse(sessionStorage.getItem(STACK_KEY) || '[]');
    return stack[stack.length - 1] || null;
  } catch { return null; }
}

export function popDeskBack() {
  try {
    const stack = JSON.parse(sessionStorage.getItem(STACK_KEY) || '[]');
    const prev = stack.pop();
    sessionStorage.setItem(STACK_KEY, JSON.stringify(stack));
    return prev;
  } catch { return null; }
}

const FORM_PARENT = {
  'user-edit.html': '/users.html',
  'user-view.html': '/users.html',
  'roles-edit.html': '/roles.html',
  'commission-agent-edit.html': '/commission-agents.html',
  'product-form.html': '/products.html',
  'product-view.html': '/products.html',
  'customer-form.html': '/customers.html',
  'customer-view.html': '/customers.html',
  'customer-group-edit.html': '/customer-groups.html',
  'supplier-form.html': '/suppliers.html',
  'supplier-edit.html': '/suppliers.html',
  'purchase-form.html': '/purchase-orders.html',
  'purchase-invoice-form.html': '/purchase-invoices.html',
  'purchase-return-form.html': '/purchase-returns.html',
  'purchase-catchup.html': '/purchase-orders.html',
  'sales-form.html': '/sales-orders.html',
  'quotation-form.html': '/quotations.html',
  'draft-form.html': '/drafts.html',
  'sell-return-form.html': '/sell-returns.html',
  'discount-form.html': '/discounts.html',
  'expense-form.html': '/expenses.html',
  'expense-category-form.html': '/expense-categories.html',
  'stock-transfer-form.html': '/stock-transfers.html',
  'stock-adjustment-form.html': '/stock-adjustments.html',
  'category-edit.html': '/categories.html',
  'brand-edit.html': '/brands.html',
  'unit-edit.html': '/units.html',
  'warranty-edit.html': '/warranties.html',
  'group-edit.html': '/customer-groups.html',
  'client-form.html': '/clients.html',
  'accounting-account-form.html': '/accounting.html',
  'accounting-journal-form.html': '/accounting.html',
  'accounting-transfer-form.html': '/accounting.html',
  'visit-form.html': '/field-ops.html',
};

function parentOfHere() {
  const file = fileOf(location.pathname);
  return FORM_PARENT[file] || '';
}

export function goBackDesk() {
  const here = location.pathname + location.search + location.hash;
  const stack = readStack();
  while (stack.length && sameDeskUrl(stack[stack.length - 1].href, here)) stack.pop();
  const prev = stack.pop();
  writeStack(stack);
  let href = prev?.href && !sameDeskUrl(prev.href, here) ? prev.href : '';
  if (!href) {
    const parent = parentOfHere();
    if (parent && !sameDeskUrl(parent, here)) href = parent;
  }
  if (href) {
    if (typeof window.__dfOpenSpa === 'function') {
      window.__dfOpenSpa(href, { fromPop: true, force: true });
      return;
    }
    location.assign(href);
    return;
  }
  if (history.length > 1) {
    history.back();
    return;
  }
  goHomeDesk();
}

export function goHomeDesk() {
  location.assign('/dashboard.html');
}

function fileOf(href) {
  try {
    const u = new URL(href, location.origin);
    return (u.pathname.split('/').pop() || '').toLowerCase();
  } catch { return ''; }
}

function titleOfHref(href) {
  const file = fileOf(href).replace(/\.html$/, '').replace(/[-_]/g, ' ');
  return file ? file.replace(/\b\w/g, (c) => c.toUpperCase()) : 'Desk';
}

export function deskJumpBar() {
  return '';
}

export function syncJumpBar() {
  const junk = document.getElementById('ult-jump');
  if (junk) { junk.innerHTML = ''; junk.hidden = true; }
  const here = location.pathname + location.search + location.hash;
  const onHome = /(?:^|\/)dashboard\.html$/i.test(String(location.pathname || '')) && !location.search;
  let btn = document.getElementById('desk-panel-back');
  if (!btn) {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'desk-panel-back';
    btn.className = 'desk-panel-back';
    btn.setAttribute('data-desk-back', '');
    btn.setAttribute('aria-label', 'Back to previous page');
    btn.innerHTML = '<span aria-hidden="true">←</span> Back';
    document.body.appendChild(btn);
  }
  const prev = peekDeskBack();
  const dest = prev && !sameDeskUrl(prev.href, here) ? prev.href : parentOfHere();
  btn.hidden = !!onHome;
  btn.title = dest && !sameDeskUrl(dest, here) ? 'Back to previous page' : 'Back';
}

export function installDeskBack(root = document) {
  if (root.__dfDeskBack) return;
  root.__dfDeskBack = true;
  registerClickGuard({
    name: 'desk-back',
    priority: PRIORITY.lock,
    match: (origin) => origin?.closest?.('[data-desk-back], #desk-panel-back'),
    claim: () => { goBackDesk(); return 'claim'; },
  });
  registerClickGuard({
    name: 'desk-home',
    priority: PRIORITY.lock,
    match: (origin) => origin?.closest?.('[data-desk-home], #hdr-home'),
    claim: () => { goHomeDesk(); return 'claim'; },
  });
  root.addEventListener('click', (e) => {
    const back = e.target.closest?.('[data-desk-back], #desk-panel-back');
    if (back) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      goBackDesk();
      return;
    }
    const home = e.target.closest?.('[data-desk-home], #hdr-home');
    if (home) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      goHomeDesk();
    }
  }, true);
}

function lsRows(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
}

function escTxt(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function previewSnapshot(href) {
  let dest = {};
  try { dest = new URL(href, location.origin); } catch { dest = { pathname: href, searchParams: new URLSearchParams() }; }
  const file = String(dest.pathname || '').toLowerCase();
  const view = dest.searchParams?.get('view') || dest.searchParams?.get('tab') || '';
  const products = lsRows('df_products');
  const live = products.filter((p) => p && p.source !== 'fiberkapp');
  const rows = (list) => list.slice(0, 8).map((p) => `<tr>
    <td>${escTxt(p.sku || p.id || '')}</td>
    <td>${escTxt(p.name || '')}</td>
    <td>${escTxt(p.location_name || p.location_code || '')}</td>
    <td>${escTxt(p.qty ?? p.current_stock ?? p.stock ?? 0)}</td>
  </tr>`).join('') || '<tr><td colspan="4">No rows in this book yet.</td></tr>';
  const table = (list) => `<table class="df-prev-table"><thead><tr><th>SKU</th><th>Name</th><th>Location</th><th>Qty</th></tr></thead><tbody>${rows(list)}</tbody></table>
    <p class="df-prev-note">${list.length} row(s) in the live book. This view is read-only.</p>`;

  if (file.includes('product-catalog')) {
    return `<p>Product Catalog — listings the group can sell.</p>${table(live)}`;
  }
  if (file.includes('wms') || view === 'stock') {
    const stock = live.filter((p) => Number(p.qty ?? p.current_stock ?? p.stock ?? 0) > 0);
    return `<p>WMS Stock — on-hand units by location.</p>${table(stock.length ? stock : live.filter((p) => /pinaro|BNP-0475/i.test(`${p.sku} ${p.purchase_ref} ${p.source}`)))}`;
  }
  if (view === 'inventory' || file.includes('inventory')) {
    const inv = live.filter((p) => p.open_stock || p.sku_locked || Number(p.qty ?? p.stock ?? 0) > 0 || p.source === 'paper-invoice');
    return `<p>Product Inventory — ordered and on-hand units.</p>${table(inv.length ? inv : live.slice(0, 8))}`;
  }
  return `<p>${escTxt(titleOfHref(href))} — read-only dashboard snapshot.</p>${table(live.slice(0, 8))}`;
}

export function openDeskPreview(href, title) {
  const destMod = moduleOf(href);
  const hereMod = moduleOf(location.pathname);
  if (destMod === hereMod) return;
  closeDeskPreview();
  const name = title || titleOfHref(href);
  const wrap = document.createElement('div');
  wrap.id = 'df-desk-preview';
  wrap.innerHTML = `
    <div class="df-ref-card">
      <header>
        <strong>Ref · ${escTxt(destMod)}</strong>
        <button type="button" data-prev-close aria-label="Close">×</button>
      </header>
      <div class="df-ref-body">
        <p class="df-ref-title">${escTxt(name)}</p>
        <p>This sits under <b>${escTxt(destMod)}</b>, not ${escTxt(hereMod)}.</p>
        <p class="df-prev-note">Stay here unless you need to work that desk.</p>
      </div>
      <footer>
        <button type="button" class="desk-jump-btn back" data-prev-close>Stay here</button>
        <button type="button" class="desk-jump-btn home" data-go-page>Go to ${escTxt(destMod)}</button>
      </footer>
    </div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('[data-go-page]').onclick = () => {
    pushDeskBack();
    closeDeskPreview();
    location.href = href;
  };
  wrap.querySelectorAll('[data-prev-close]').forEach((b) => { b.onclick = closeDeskPreview; });
  wrap.addEventListener('click', (e) => { if (e.target === wrap) closeDeskPreview(); });
}

export function closeDeskPreview() {
  document.getElementById('df-desk-preview')?.remove();
}

function destHrefFrom(el) {
  if (!el) return '';
  return el.getAttribute('data-preview')
    || el.getAttribute('href')
    || (el.dataset?.tab ? `/products.html?view=${el.dataset.tab}` : '')
    || (el.dataset?.htab ? `/wms.html?tab=${el.dataset.htab}` : '');
}

function sameDesk(href) {
  try {
    const dest = new URL(href, location.origin);
    return dest.pathname === location.pathname && dest.search === location.search;
  } catch { return false; }
}

const MODULE_RULES = [
  [/manual\.html/, 'Manual'],
  [/product|categor|brand|unit|warranty|franko|media-sync|print-label|variation|price-group/, 'Products'],
  [/purchase|paper-purchase|catchup/, 'Procurement'],
  [/wms|virtual-warehouse|receive-stock|put-away|stock-/, 'Operations Hub'],
  [/sales-|pos-|draft|quotation|shipment|discount|sell-return/, 'Sales'],
  [/payment-account|banking|uba|fiberk-bank|expense|customer-receipt|accounting/, 'Finance'],
  [/collection/, 'Collections'],
  [/report/, 'Reports'],
  [/hrm|payroll|employee|leave|snnit/, 'HRM'],
  [/setting|user|role|audit|notif|backup|printer|tax-rate|sms-/, 'System'],
  [/supplier|customer|investor|partner|consultant|loyalty|contact/, 'Records'],
  [/dashboard|home\.html|index\.html/, 'Home'],
];

export function moduleOf(href) {
  const file = String(href || '').split('?')[0].toLowerCase();
  const hit = MODULE_RULES.find((r) => r[0].test(file));
  return hit ? hit[1] : 'Desk';
}

function isForeignHref(href) {
  const from = moduleOf(location.pathname + location.search);
  const to = moduleOf(href);
  return from !== to && to !== 'Desk';
}

function shouldPreview(el) {
  if (!el || el.target === '_blank' || el.hasAttribute('download')) return false;
  if (el.closest('#df-desk-preview, .desk-jump, .ult-side, .ult-top, #ult-nav, #df-bot-root')) return false;
  if (el.hasAttribute('data-go-page') || el.hasAttribute('data-desk-back') || el.hasAttribute('data-desk-home') || el.id === 'df-desk-back') return false;
  if (el.hasAttribute('data-tab') || el.hasAttribute('data-htab')) return false;
  if (el.classList.contains('ult-tab') || el.classList.contains('addon-head-tabs')) return false;
  if (el.closest('.addon-head-tabs, .bank-head-tabs, .ult-tabs')) return false;
  if (el.classList.contains('wms-card') && !el.getAttribute('href')) return false;
  const href = destHrefFrom(el);
  if (!href || !href.startsWith('/') || href.startsWith('//')) return false;
  if (/login|index\.html|logout/.test(href)) return false;
  try {
    const dest = new URL(href, location.origin);
    if (dest.pathname === location.pathname) return false;
  } catch { return false; }
  return true;
}

function shouldAssignNavigate(href) {
  const s = String(href || '');
  if (!s || /^(mailto:|tel:|javascript:)/i.test(s)) return true;
  if (/(?:^|\/)(login|logout|till-login|pos-open|pos|repair-till|customer-display)\.html/i.test(s)) return true;
  try {
    const dest = new URL(s, location.origin);
    if (dest.origin !== location.origin) return true;
  } catch { return true; }
  return false;
}

function spaOrNative(url, replace) {
  const s = String(url || '');
  const native = replace ? window.__dfNativeReplace : window.__dfNativeAssign;
  if (shouldAssignNavigate(s) || typeof native !== 'function') {
    if (typeof native === 'function') return native(s);
    return;
  }
  if (typeof window.__dfOpenSpa === 'function') {
    window.__dfOpenSpa(s, { fromPop: !!replace });
    return;
  }
  if (typeof native === 'function') native(s);
}

function guardLocationWrites() {
  if (window.__dfPullGuard) return;
  window.__dfPullGuard = true;
  try {
    window.__dfNativeAssign = location.assign.bind(location);
    window.__dfNativeReplace = location.replace.bind(location);
    window.__dfNativeReload = location.reload.bind(location);
  } catch { /* ignore */ }
  const patchLoc = (name, fn) => {
    try {
      const desc = Object.getOwnPropertyDescriptor(location, name)
        || Object.getOwnPropertyDescriptor(Location.prototype, name);
      if (desc && desc.configurable === false && desc.writable === false) return false;
      location[name] = fn;
      return true;
    } catch {
      return false;
    }
  };
  patchLoc('assign', function (url) { spaOrNative(url, false); });
  patchLoc('replace', function (url) { spaOrNative(url, true); });
  patchLoc('reload', function () {
    if (shouldAssignNavigate(location.pathname) && typeof window.__dfNativeReload === 'function') {
      return window.__dfNativeReload();
    }
    if (typeof window.__dfOpenSpa === 'function') {
      window.__dfOpenSpa(location.pathname + location.search + location.hash, { force: true, fromPop: true });
      return;
    }
    if (typeof window.__dfNativeReload === 'function') window.__dfNativeReload();
  });
  try {
    const desc = Object.getOwnPropertyDescriptor(Location.prototype, 'href')
      || Object.getOwnPropertyDescriptor(location, 'href');
    if (desc && desc.set && desc.get && desc.configurable !== false) {
      Object.defineProperty(location, 'href', {
        configurable: true,
        enumerable: true,
        get() { return desc.get.call(this); },
        set(v) { spaOrNative(v, false); },
      });
    }
  } catch { /* Chrome blocks Location href override */ }
}

export function installDeskPreview(root = document) {
  if (typeof window !== 'undefined') window.openDeskPreview = openDeskPreview;
  guardLocationWrites();
  if (root.__dfDeskPreview) return;
  root.__dfDeskPreview = true;
  root.addEventListener('click', (e) => {
    const el = e.target.closest?.('a[href], [data-preview], [data-ref], .df-ref');
    if (!shouldPreview(el)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation?.();
    const href = destHrefFrom(el);
    const label = (el.getAttribute('data-preview-title') || el.textContent || '').trim().slice(0, 80);
    openDeskPreview(href, label);
  }, true);
}

export function installDeskNavGuard() {
  installDeskPreview(document);
  installDeskBack(document);
  syncJumpBar();
}

export function deskChromeCss() {
  return `
.hub-tabs .hub-back{
  margin-right:10px;flex:0 0 auto;text-decoration:none;
}
.hub-tabs .hub-back:hover{ filter:brightness(.96); }
.df-desk-back,.desk-jump-btn{
  display:inline-flex;align-items:center;justify-content:center;height:44px;
  padding:0 18px;border:0;border-radius:14px;font-weight:800;cursor:pointer;
  color:#fff;text-decoration:none;white-space:nowrap;font-size:13px;
  text-shadow:0 1px 0 rgba(15,23,42,.25);
  transition:transform .12s ease,filter .12s ease;
}
.desk-jump{display:none !important}
.desk-panel-back{
  position:fixed;right:80px;bottom:18px;z-index:11990;
  display:inline-flex;align-items:center;justify-content:center;gap:6px;
  height:52px;padding:0 16px;min-width:52px;
  border:0;border-radius:16px;font-weight:800;cursor:pointer;font-size:13px;
  color:#ecfdf5;text-shadow:0 1px 0 rgba(15,23,42,.25);
  background:linear-gradient(180deg,#86efac 0%,#22c55e 48%,#15803d 100%);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.4),inset 0 -2px 3px rgba(21,128,61,.28),0 10px 24px rgba(21,128,61,.28);
}
.desk-panel-back:hover{filter:brightness(1.06);transform:translateY(-1px)}
.desk-panel-back[hidden]{display:none !important}
@media (max-width:720px){
  .desk-panel-back{ right:74px; bottom:72px; }
}
html[data-embed="1"] .desk-panel-back,html[data-embed="1"] #hdr-home{display:none !important}
.desk-jump-btn.home{
  background:linear-gradient(180deg,#6b8ef8 0%,#3b6ef0 46%,#2554e0 100%);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.4),inset 0 -2px 3px rgba(30,64,175,.3),0 3px 0 rgba(30,64,175,.35),0 6px 10px rgba(30,64,175,.28);
}
.desk-jump-btn.home:hover{filter:brightness(1.06);transform:translateY(-1px)}
.desk-jump-btn.back{
  background:linear-gradient(180deg,#86efac 0%,#22c55e 48%,#15803d 100%);
  color:#ecfdf5;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.4),inset 0 -2px 3px rgba(21,128,61,.28),0 3px 0 rgba(21,128,61,.32),0 6px 10px rgba(21,128,61,.25);
}
.desk-jump-btn.back:hover{filter:brightness(1.06);transform:translateY(-1px)}
body.ult-spa-pending .ult-main{position:relative}
body.ult-spa-pending .ult-main::before{
  content:'';position:absolute;left:0;right:0;top:0;height:3px;z-index:40;
  background:linear-gradient(90deg,#4f46e5,#10b981,#4f46e5);background-size:200% 100%;
  animation:df-spa-bar .9s linear infinite;
}
@keyframes df-spa-bar{from{background-position:100% 0}to{background-position:-100% 0}}
.desk-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 10px}
.desk-head h1{margin:0;font-size:22px;line-height:32px}
.desk-tabs{display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin:0 0 10px;border-bottom:1px solid #e5e7eb}
.desk-tabs a,.desk-tabs button{
  height:40px;display:inline-flex;align-items:center;padding:0 14px;
  border:0;background:transparent;color:#334155;font:inherit;font-weight:700;cursor:pointer;
  text-decoration:none;border-bottom:2px solid transparent;margin-bottom:-1px;
}
.desk-tabs a.on,.desk-tabs button.on{color:#1d4ed8;border-bottom-color:#1d4ed8}
#df-desk-preview{
  position:fixed;inset:0;z-index:14000;background:rgba(15,23,42,.45);
  display:flex;align-items:center;justify-content:center;padding:18px;
}
.df-ref-card{
  width:min(420px,100%);background:#fff;border-radius:16px;
  display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 60px rgba(15,23,42,.28);
}
.df-ref-card header{
  display:flex;align-items:center;gap:10px;padding:12px 14px;background:#ecfdf5;
}
.df-ref-card header strong{font-size:14px}
.df-ref-card header button{margin-left:auto;border:0;background:transparent;font-size:22px;cursor:pointer}
.df-ref-body{padding:16px 18px}
.df-ref-title{font-weight:800;margin:0 0 8px;font-size:16px}
.df-ref-card footer{display:flex;justify-content:flex-end;gap:8px;padding:10px 14px;border-top:1px solid #e2e8f0}
.df-prev-card{
  width:min(1100px,100%);height:min(780px,92vh);background:#fff;border-radius:16px;
  display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 60px rgba(15,23,42,.28);
}
.df-prev-card header{
  display:flex;align-items:center;gap:10px;padding:10px 14px;background:#ecfdf5;flex:0 0 auto;
}
.df-prev-card header strong{font-size:15px}
.df-prev-card header span{color:#047857;font-size:12px;font-weight:700}
.df-prev-card header button{
  margin-left:auto;border:0;background:transparent;font-size:24px;cursor:pointer;line-height:1;
}
.df-prev-frame{position:relative;flex:1;min-height:0;background:#f8fafc}
.df-prev-frame iframe{width:100%;height:100%;border:0}
.df-prev-glass{position:absolute;inset:0;background:transparent;cursor:default}
.df-prev-body{flex:1;overflow:auto;padding:16px 18px;background:#f8fafc}
.df-prev-table{width:100%;border-collapse:collapse;background:#fff}
.df-prev-table th,.df-prev-table td{border-bottom:1px solid #e2e8f0;padding:8px 10px;text-align:left;font-size:13px}
.df-prev-note{color:#047857;font-weight:700;margin:10px 0 0}
.df-prev-card footer{
  display:flex;justify-content:flex-end;gap:8px;padding:10px 14px;border-top:1px solid #e2e8f0;
}
.filt-groups{display:flex;flex-direction:column;gap:18px}
.filt-group-title{margin:0 0 8px;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#64748b}
.ult-table-wrap,.home-card .ult-table-wrap{overflow-x:auto;border:1px solid #9db4d8;background:#fff}
.ult-table,.ult-main table,.home-card table,.df-prev-table{
  width:100%;border-collapse:collapse;table-layout:auto;background:#fff;font-size:13px;
}
.ult-table th,.ult-table td,.ult-main table th,.ult-main table td,.df-prev-table th,.df-prev-table td,.home-card table th,.home-card table td{
  border:1px solid #9db4d8 !important;
  padding:8px 10px !important;
  vertical-align:middle !important;
  white-space:nowrap !important;
  max-width:none !important;
  text-overflow:clip !important;
  overflow:visible !important;
}
.ult-table td.wrap-cell,.ult-main table td.wrap-cell,.home-card table td.wrap-cell,.df-prev-table td.wrap-cell{
  white-space:normal !important;overflow-wrap:anywhere;word-break:break-word;line-height:1.35;vertical-align:top !important;
}
.ult-table-wrap,.home-card .ult-table-wrap{overflow:auto;max-height:min(72vh,820px)}
.ult-table thead th,.ult-main table thead th,.home-card table thead th,.df-prev-table thead th{
  background:#1d4ed8 !important;color:#fff !important;font-weight:700;letter-spacing:.01em;
  position:sticky;top:0;z-index:4;white-space:nowrap !important;
}
.df-note-link{background:none;border:0;padding:0;color:#1d4ed8;text-decoration:underline;cursor:pointer;font:700 13px Inter,sans-serif;white-space:nowrap}
.df-note-shade{position:fixed;inset:0;background:rgba(15,23,42,.35);z-index:14000}
.df-note-card{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:14001;width:min(420px,92vw);background:#fff;border-radius:16px;padding:22px 24px 20px;box-shadow:0 24px 50px rgba(15,23,42,.25)}
.df-note-card h3{margin:0 0 10px;font-size:16px;color:#0f172a}
.df-note-card p{margin:0;white-space:pre-wrap;color:#334155;font-size:14px;line-height:1.45}
.df-note-x{position:absolute;right:12px;top:10px;border:0;background:none;font-size:22px;cursor:pointer;color:#64748b}
.ult-table tbody tr:nth-child(even) td,.ult-main table tbody tr:nth-child(even) td{background:#eef4ff}
.ult-table tbody tr:hover td,.ult-main table tbody tr:hover td{background:#dbeafe}
.ult-table td.act,.ult-table td:has(.act),.ult-table th:first-child,.ult-main table td.act{
  white-space:nowrap !important;width:1%;overflow:visible !important;
}
.ult-table td.num,.ult-table td[data-num]{white-space:nowrap !important;text-align:right;font-variant-numeric:tabular-nums}
/* Fiberkapp / Britsoft chrome — layout only */
:root{
  --fk-ink:#1e2a3a;
  --fk-primary:#5b6cff;
  --fk-primary-2:#4c6fff;
  --fk-bg:#e8edf3;
  --fk-card:#fff;
  --fk-line:#d5dde8;
  --fk-muted:#64748b;
}
.ult-main,.ult-page,main.ult-main{background:var(--fk-bg)}
.home-card,.fo-ol .home-card,.ops-toolbar{
  background:var(--fk-card);border:1px solid var(--fk-line);border-radius:12px;
  box-shadow:0 8px 24px rgba(30,42,58,.06);
}
.ult-btn-primary,.desk-jump-btn.home,button.ult-btn-primary,#fo-ol-form button[type=submit],.fo-ol-actions .ult-btn-primary{
  background:linear-gradient(180deg,var(--fk-primary),var(--fk-primary-2)) !important;
  border:0 !important;color:#fff !important;border-radius:10px !important;
  min-height:40px;padding:0 18px;font-weight:700;box-shadow:0 6px 14px rgba(91,108,255,.28);
}
.ult-btn-outline,.fo-ol-actions .ult-btn-outline{
  background:#fff !important;border:1px solid var(--fk-line) !important;color:var(--fk-ink) !important;
  border-radius:10px !important;min-height:40px;
}
.fo-ol-filters,.filters{
  background:#fff;border:1px solid var(--fk-line);border-radius:12px;padding:14px 16px;
  display:flex;flex-wrap:wrap;gap:12px 16px;align-items:end;margin:0 0 14px;
}
#filt-box[hidden],.filt-drop:not([open]) .filt-drop-body{display:none !important}
.filt-drop{background:#fff;border:1px solid var(--fk-line);border-radius:12px;margin:0 0 14px}
.filt-drop>summary{
  list-style:none;cursor:pointer;font-weight:800;padding:10px 14px;color:#0f172a;
}
.filt-drop>summary::-webkit-details-marker{display:none}
.filt-drop>summary:before{content:'▸ '; }
.filt-drop[open]>summary:before{content:'▾ '; }
.filt-drop-body{padding:4px 14px 14px}
.fo-ol-filters label,.filters label{
  display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:700;color:var(--fk-ink);
}
.fo-ol-filters input:not([type=checkbox]):not([type=radio]),.fo-ol-filters select,.filters input:not([type=checkbox]):not([type=radio]),.filters select,
.ult-main input[type=text],.ult-main input[type=date],.ult-main input[type=search],.ult-main select{
  min-height:40px;border:1px solid #cfd8e6;border-radius:10px;padding:0 12px;background:#fff;color:var(--fk-ink);
}
.filters input[type=checkbox],.fo-ol-filters input[type=checkbox],.filter-body input[type=checkbox],.fld input[type=checkbox]{
  -webkit-appearance:checkbox !important;appearance:checkbox !important;
  width:16px !important;height:16px !important;min-width:16px !important;min-height:16px !important;
  max-width:16px !important;max-height:16px !important;padding:0 !important;margin:0 8px 0 0 !important;
  border:1px solid #475569 !important;border-radius:3px !important;background:#fff !important;
  box-shadow:none !important;accent-color:#004EEB !important;flex:none !important;
  display:inline-block !important;vertical-align:middle !important;
}
.filters label.filt-check,.filters label:has(> input[type=checkbox]),
.fo-ol-filters label:has(> input[type=checkbox]),.filter-body label:has(> input[type=checkbox]){
  flex-direction:row !important;align-items:center !important;justify-content:flex-start !important;
  gap:8px !important;min-height:24px !important;height:auto !important;padding:0 !important;
  white-space:nowrap;
}
.filt-checks{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));align-items:center;gap:8px 16px}
.fo-ol-chips{display:flex;flex-wrap:wrap;gap:8px;width:100%}
.fo-chip{
  border:1px solid var(--fk-line);background:#fff;color:var(--fk-ink);border-radius:999px;
  height:34px;padding:0 14px;font-weight:700;cursor:pointer;
}
.fo-chip.on{background:var(--fk-primary);color:#fff;border-color:var(--fk-primary)}
.fo-ol-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:0 0 14px}
.fo-ol-kpis article{
  background:#fff;border:1px solid var(--fk-line);border-radius:12px;padding:12px 14px;
}
.fo-ol-kpis article span{display:block;font-size:11px;font-weight:700;color:var(--fk-muted);text-transform:uppercase;letter-spacing:.04em}
.fo-ol-kpis article b{display:block;margin-top:4px;font-size:22px;color:var(--fk-ink)}
.ss-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 10px}
.bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 8px}
.bar button,[data-exp]{
  height:34px;border:1px solid var(--fk-line);background:#fff;border-radius:8px;padding:0 10px;font-size:12px;font-weight:700;
}
.pager button{min-width:36px;height:34px;border:1px solid var(--fk-line);background:#fff;border-radius:8px}
.pager button.on{background:var(--fk-primary);color:#fff;border-color:var(--fk-primary)}
.act>button,.act summary,.act-btn{
  background:#fff !important;color:#0284c7 !important;border:1px solid #7dd3fc !important;
  border-radius:999px !important;height:28px;padding:0 12px;font-weight:700;font-size:12px;
}
.df-ref-card,.df-prev-card{border-radius:12px}
.ult-table thead th{
  background:var(--fk-primary) !important;color:#fff !important;
}
#fk-modal{position:fixed;inset:0;z-index:16000;background:rgba(15,23,42,.45);display:flex;align-items:flex-start;justify-content:center;padding:24px 12px;overflow:auto}
#fk-modal .fk-dialog{width:min(1180px,100%);background:#fff;border-radius:8px;box-shadow:0 24px 60px rgba(15,23,42,.28);margin:24px auto}
#fk-modal .po-view-head,#fk-modal .fk-head{
  display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #e5e7eb;background:#f8fafc
}
#fk-modal .po-view-head h1,#fk-modal .fk-head h1{margin:0;font-size:18px;font-weight:700}
#fk-modal .po-x{margin-left:auto;border:0;background:transparent;font-size:28px;cursor:pointer;line-height:1}
.po-meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;padding:16px;position:relative}
.po-date-top{position:absolute;right:16px;top:8px;font-weight:700}
.po-lines thead th{background:#16a34a !important;color:#fff !important;border-color:#15803d !important}
.po-table-wrap{overflow:auto;padding:0 16px 16px}
#collapseFilter,.filters[data-fk]{background:#fff;border:1px solid var(--fk-line);border-radius:12px;padding:14px}
.ult-side-tools{background:#d8efe9 !important}
#ult-nav,.ult-side nav{
  background:#eaf7f4 !important;color:#0f172a !important;
}
#ult-nav a,#ult-nav button,#ult-nav .ult-link,#ult-nav .ult-group-btn,
#ult-nav .ult-sub a,#ult-nav .lbl,#ult-nav .chev,#ult-nav span{
  color:#0f172a !important;-webkit-text-fill-color:#0f172a;
}
#ult-nav a:hover,#ult-nav .ult-group-btn:hover,#ult-nav .ult-link:hover,#ult-nav .ult-sub a:hover{
  background:#cfeae3 !important;color:#0f172a !important;border-radius:8px;
}
#ult-nav a:hover .lbl,#ult-nav a:hover .chev,#ult-nav .ult-group-btn:hover .lbl,#ult-nav .ult-group-btn:hover .chev{
  color:#0f172a !important;
}
#ult-nav a.active,#ult-nav .ult-link.active,
#ult-nav a.theme-sidebar-child-active,#ult-nav .theme-sidebar-active,
#ult-nav .ult-group.open>.ult-group-btn,#ult-nav .ult-group-btn.theme-sidebar-active,
#ult-nav .ult-sub a.active,#ult-nav .ult-sub a.theme-sidebar-child-active{
  background:#b8def3 !important;color:#0f172a !important;border-radius:8px;
}
#ult-nav .theme-sidebar-active .lbl,#ult-nav .theme-sidebar-active .chev,
#ult-nav .ult-group.open>.ult-group-btn .lbl,#ult-nav .ult-group.open>.ult-group-btn .chev,
#ult-nav .ult-sub a.active span{
  color:#0f172a !important;
}
#ult-nav .ult-link.pill,#ult-nav .ult-group-btn.pill,
#ult-nav .ult-link.pill .lbl,#ult-nav .ult-group-btn.pill .lbl{
  color:inherit !important;-webkit-text-fill-color:currentColor;
}


body.df-archive .ult-add,body.df-archive a.add,body.df-archive [data-del],body.df-archive [data-off],
body.df-archive [data-st],body.df-archive button[data-pay]{display:none !important}
body.df-archive .act-menu a[href*="form.html"]:not([href*="view=1"]){display:none !important}
body.df-archive #ult-sub,body.df-archive #ult-loc,body.df-archive #ult-agent,
body.df-archive [data-scope-sub],body.df-archive [data-scope-loc],body.df-archive [data-scope-agent],
body.df-archive [data-scope-agent-wrap],body.df-archive .desk-jump,body.df-archive .desk-jump-btn,
body.df-archive a[href*="view=inventory"],body.df-archive a[href*="view=stock"],
body.df-archive a[href*="publish"],body.df-archive .scope-caption,body.df-archive #sell_list_selected_range{
  display:none !important;
}
body.df-archive .ult-brand{font-size:14px}


.ult-user-chip{display:inline-flex;align-items:center;gap:6px}
.usr-ico{font-size:14px;line-height:1}
.ws-drop{position:relative;display:inline-flex;align-items:center}
.ws-toggle{display:inline-flex;align-items:center;gap:8px;background:transparent;border:0;color:#0f172a;font:800 15px/1 Inter,sans-serif;cursor:pointer;padding:0}
.ws-toggle .chev{font-size:11px}
.ws-menu{position:absolute;left:0;top:calc(100% + 8px);z-index:90;min-width:240px;background:#0f172a;border-radius:12px;padding:8px;box-shadow:0 16px 40px rgba(15,23,42,.28)}
.ws-menu a{display:block;background:transparent !important;color:#e2e8f0 !important;padding:10px 12px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px}
.ws-menu a:hover{background:#334155 !important;color:#fff !important}
.ws-menu a.on{background:#1d4ed8 !important;color:#fff !important}

.ult-top,.ult-bar{
  background:linear-gradient(90deg,#7dd3fc 0%,#67e8f9 42%,#6ee7b7 100%) !important;
  color:#0f172a !important;
  border-bottom:0 !important;
}
.ult-top a,.ult-top button,.ult-top .mig-btn{color:#0f172a}
.df-info{position:relative;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;margin-left:6px;border:0;border-radius:50%;background:#0ea5e9;color:#fff;font:700 12px/1 Inter,sans-serif;cursor:help;vertical-align:middle;padding:0}
.df-info-dot{pointer-events:none}
.df-info-pop{position:absolute;left:28px;top:50%;transform:translateY(-50%);z-index:80;width:280px;background:#0f172a;color:#e2e8f0;border-radius:12px;padding:12px 14px;box-shadow:0 12px 30px rgba(15,23,42,.25);text-align:left;font-weight:400}
.df-info-pop strong{display:block;margin-bottom:6px;color:#fff;font-size:13px}
.df-info-pop p{margin:0 0 8px;font-size:12px;line-height:1.45;white-space:normal}
.df-info-pop a{color:#7dd3fc;font-size:12px;font-weight:700}
.df-info-long .df-info-pop{width:min(420px,70vw)}
p.manual-ref,.mig-stamp,p.ult-lead{display:none}
.mig-short{display:none}
#hdr-bell{position:relative;overflow:visible}
#hdr-bell .bell-count{
  position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;padding:0 4px;
  border-radius:8px;background:#dc2626;color:#fff;font-size:10px;font-weight:800;
  line-height:16px;text-align:center;box-shadow:0 0 0 2px #fff;pointer-events:none;
}
.ult-modal.note-drawer-host{align-items:flex-start;justify-content:flex-end;padding:56px 12px 12px;background:rgba(15,23,42,.18)}
.note-drawer{
  width:340px !important;max-width:92vw;height:auto !important;max-height:min(420px,62vh) !important;
  border-radius:12px !important;margin:0;padding:12px !important;overflow:hidden;display:flex;flex-direction:column;
}
.note-empty{overflow:auto;max-height:min(300px,46vh);text-align:left;border:0 !important;padding:0 !important}
.note-row,.note-row.note-row{
  display:block !important;width:100%;text-align:left;background:transparent !important;
  border:0 !important;border-bottom:1px solid #e2e8f0 !important;border-radius:0 !important;
  padding:10px 2px !important;margin:0 !important;box-shadow:none !important;cursor:pointer;
}
.note-row b{display:block;font-size:13px;color:#0f172a}
.note-row p{margin:2px 0 0 !important;color:#475569;font-size:12px}
.note-row small{display:block;margin-top:2px;color:#64748b;font-size:11px}
.note-row.is-read{opacity:.55}
@media(max-width:720px){.mig-full{display:none}.mig-short{display:inline}}
.ult-main{background:#eef1f6 !important}
.pill.paid{background:#dcfce7;color:#166534;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:700}
.pf{background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.pf-ico{background:#dbeafe;color:#2563eb}
.add{background:#5b6cff !important;border-radius:999px !important}
`;
}

export function openFkModal(html) {
  closeFkModal();
  const wrap = document.createElement('div');
  wrap.id = 'fk-modal';
  wrap.innerHTML = `<div class="fk-dialog">${html}</div>`;
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap || e.target.closest('[data-close],.po-x')) closeFkModal();
  });
  document.body.appendChild(wrap);
}

export function closeFkModal() {
  document.getElementById('fk-modal')?.remove();
}

function bindFkViewModals() {
  if (document.documentElement.dataset.fkView === '1') return;
  document.documentElement.dataset.fkView = '1';
  /* Was one listener doing two unrelated jobs, with the record-view branch
     reachable only if the tab branch did not return first. Two guards now, at
     their own priorities. */
  registerClickGuard({
    name: 'desk-tab-nav',
    priority: PRIORITY.tab,
    match: (origin) => origin?.closest?.('.acc-nav a, .desk-tabs a, [data-hub-file] a, nav.acc-nav a, a[data-htab]'),
    claim: (tab) => {
      const href = tab.getAttribute('href');
      if (!href) return 'pass';
      tab.removeAttribute('target');
      try {
        const u = new URL(href, location.origin);
        if (u.pathname !== location.pathname && !href.startsWith('?')) return 'pass';
        import('./tab-loader.js').then((m) => m.openTab(href)).catch(() => {});
        return 'claim';
      } catch { return 'pass'; }
    },
  });

  /**
   * Informational clicks open a card; action controls do not.
   *
   * The point of intercepting in-table links is that asking for more detail
   * about something referenced on the page should not throw you onto another
   * page. So a link on a *value* in a cell — a customer name, a SKU, an invoice
   * reference — opens a read-only card over the page you are on. A *control* —
   * Edit, Delete, an action menu item, anything marked data-write — is left to
   * navigate to its form as normal.
   */
  const ACTION_SEL = [
    '[data-act]:not([data-act="view"]):not([data-act="View"])',
    '.btn-edit', '.btn-del', '.crud-btn', '[data-write]', '[data-del]', '[data-pay]', '[data-st]',
  ].join(', ');
  const ACTION_LABEL = /^(edit|delete|remove|add|new|save|pay|post|map accounts|mark paid|duplicate|deactivate)$/i;

  function isActionControl(el) {
    if (el.closest(ACTION_SEL)) return true;
    return ACTION_LABEL.test(String(el.textContent || '').replace(/\s+/g, ' ').trim());
  }

  function informationalRecordLink(origin) {
    const a = origin?.closest?.('table a[href], .ult-table a[href]');
    if (!a || isActionControl(a)) return null;
    const href = a.getAttribute('href') || '';
    if (!href || href === '#' || href.startsWith('javascript:')) return null;
    try {
      const u = new URL(href, location.origin);
      if (u.pathname === location.pathname && !u.searchParams.get('id')) return null;
      const hasId = !!u.searchParams.get('id');
      const isRecordPage = /-view\.html$|-form\.html$|-ledger\.html$/.test(u.pathname);
      if (/\/(customer-view|product-view|contact-view|catalogue-view)\.html$/i.test(u.pathname)) return null;
      /* No record identity means it points at a collection — table-context's job. */
      return (hasId || isRecordPage) ? a : null;
    } catch { return null; }
  }

  /**
   * A View action is a View action wherever it is rendered.
   *
   * actMenu() in ls-rows.js emits link items as a bare
   * `<a href="/customer-form.html?id=42">View</a>` with no data-act, and the
   * shell portals those menus out to <body>, so the item is neither tagged as a
   * view nor inside the table any more. Nothing identified it, spa-nav took it,
   * and clicking View opened the editable form — the standard read-only mode
   * (?view=1) was never reached.
   *
   * Recognised now by label or href, in a menu or a cell, and always routed
   * through the read-only card. One rule for every desk.
   */
  const MENU_CONTEXT = 'menu.act-portal, .act-portal, .act-menu, .act-flyout, details.act, td.act, .act, .act-stack, .act-row';

  function isViewControl(el) {
    if (!el) return false;
    if (el.matches?.('[data-act="view"], [data-act="View"], a.view-product, a.btn-modal, [data-info]')) return true;
    const href = el.getAttribute?.('href') || el.getAttribute?.('data-href') || '';
    if (/[?&]view=1/.test(href) || /-view\.html$/.test(href.split('?')[0])) return true;
    const label = String(el.textContent || '').replace(/\s+/g, ' ').trim();
    /* "View" and "View details" yes; "View ledger" or "Overview" no. */
    return /^view( details| record)?$/i.test(label);
  }

  function viewControl(origin) {
    const el = origin?.closest?.('a[href], button');
    if (!el || !isViewControl(el)) return null;
    const href = el.getAttribute('href') || '';
    if (/\/(customer-view|product-view|contact-view|catalogue-view)\.html/i.test(href)) return null;
    /* Either in an action menu or anywhere in a table — not a nav link that
       happens to say View. */
    if (el.closest(MENU_CONTEXT) || el.closest('table, .ult-table')) return el;
    return el.matches('[data-act="view"], [data-act="View"], [data-info]') ? el : null;
  }

  /** Force the read-only mode the forms already support. */
  function readOnlyHref(href) {
    try {
      const u = new URL(href, location.origin);
      if (/-form\.html$|-edit\.html$/.test(u.pathname) || u.searchParams.get('id')) {
        u.searchParams.set('view', '1');
        return u.pathname + u.search;
      }
    } catch { /* keep href */ }
    return href;
  }

  /**
   * Small edit forms open over the list; long ones get their own page.
   *
   * The "forms are full pages" rule was set because some forms are long enough
   * to scroll — purchases, sales, products — and it then applied to everything,
   * so editing a unit name or a category took a whole page navigation and a
   * trip back.
   *
   * This is the explicit list of forms that fit in a dialog. Anything not
   * listed keeps the old behaviour, so adding a screen never changes silently.
   * If staff say one of these is too cramped, take it out of the list; if a
   * page-sized form turns out to be short, add it.
   */
  const MODAL_FORMS = new Set([
    'brand-edit.html',
    'category-edit.html',
    'unit-edit.html',
    'variation-edit.html',
    'warranty-edit.html',
    'group-edit.html',
    'customer-group-edit.html',
    'price-group-edit.html',
    'expense-category-form.html',
    'accounting-type-form.html',
    'accounting-account-form.html',
    'module-form.html',
    'discount-form.html',
    'loyalty-card-edit.html',
  ]);

  /* Long forms, listed only so the intent is written down: purchase-form,
     sales-form, product-form, customer-form, supplier-form, expense-form,
     quotation-form, stock-transfer-form, stock-adjustment-form,
     purchase-invoice-form, sell-return-form, purchase-return-form,
     accounting-journal-form, draft-form, visit-form, client-form. */

  function modalFormLink(origin) {
    const a = origin?.closest?.('a[href]');
    if (!a) return null;
    const href = a.getAttribute('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return null;
    if (/[?&]view=1/.test(href)) return null; /* record-view owns read-only */
    if (/^view$/i.test(String(a.textContent || '').replace(/\s+/g, ' ').trim())) return null;
    if (a.target === '_blank' || a.hasAttribute('download')) return null;
    if (a.hasAttribute('data-full-page') || a.closest('[data-full-page]')) return null;
    try {
      const u = new URL(href, location.origin);
      const file = u.pathname.split('/').pop() || '';
      return MODAL_FORMS.has(file) ? a : null;
    } catch { return null; }
  }

  /**
   * Opens the form in the same dialog the record card uses. The form pages
   * navigate to their list after saving, so the second load inside the frame
   * means "saved" — close the dialog and refresh the list underneath rather
   * than leaving a list rendered inside a modal.
   */
  function openFormModal(href) {
    const title = (href.split('/').pop() || 'Form').replace(/-/g, ' ').replace(/\.html.*$/, '');
    openFkModal(`<div class="fk-head"><h1 style="text-transform:capitalize">${title}</h1>
        <button type="button" class="po-x" data-close aria-label="Close">×</button></div>
      <iframe id="fk-form-frame" src="${href}" title="${title}"
        style="width:100%;min-height:60vh;border:0;background:var(--ult-card)"></iframe>`);
    const frame = document.getElementById('fk-form-frame');
    if (!frame) return;
    let loads = 0;
    const formFile = (() => { try { return new URL(href, location.origin).pathname; } catch { return href; } })();
    frame.addEventListener('load', () => {
      loads += 1;
      if (loads === 1) return;
      let stillOnForm = true;
      try { stillOnForm = frame.contentWindow.location.pathname === formFile; } catch { stillOnForm = false; }
      if (stillOnForm) return;
      closeFkModal();
      if (typeof window.__dfOpenSpa === 'function') {
        window.__dfOpenSpa(location.pathname + location.search + location.hash, { force: true, fromPop: true });
      } else {
        const app = document.getElementById('app');
        if (app) window.dispatchEvent(new CustomEvent('df-tab', { detail: location.pathname + location.search }));
      }
    });
  }

  registerClickGuard({
    name: 'form-modal',
    priority: PRIORITY.record - 5,
    match: (origin) => modalFormLink(origin),
    claim: (a) => {
      openFormModal(a.getAttribute('href'));
      return 'claim';
    },
  });

  registerClickGuard({
    name: 'record-view',
    priority: PRIORITY.record,
    match: (origin) => viewControl(origin) || informationalRecordLink(origin),
    claim: (btn) => {
      const href = btn.getAttribute('href') || btn.getAttribute('data-href') || '';
      const tr = btn.closest('tr');
      const hrefId = (href.match(/[?&]id=([^&]+)/) || [])[1];
      const id = decodeURIComponent(hrefId || '')
        || btn.dataset.id || btn.dataset.act || btn.dataset.view || btn.dataset.recordView
        || tr?.dataset?.id || tr?.querySelector('[data-pick]')?.dataset.pick || '';
      const blob = (href + ' ' + (btn.textContent || '') + ' ' + location.pathname).toLowerCase();
      const kind = /stock-transfer/.test(blob) ? 'transfer'
        : /expense/.test(blob) ? 'expense'
        : /suppl/.test(blob) ? 'supplier'
        : /product-view|product-form|opening-stock|\/products/.test(blob) ? 'product'
        : /user-view|\/users/.test(blob) ? 'user'
        : /customer|contact-view/.test(blob) ? 'customer'
        : /warrant/.test(blob) ? 'warranty'
        : /brand/.test(blob) ? 'brand'
        : '';
      import('./record-view.js').then(async (m) => {
        let row = m.rowFromContext(id, tr) || m.rowFromContext(id) || { id };
        if ((kind === 'user' || kind === 'supplier' || kind === 'customer') && !row.email && !row.full_name && !row.name) {
          try {
            const { loadRows } = await import('./ls-rows.js');
            const { KEYS } = await import('./catalog-seed.js');
            const table = kind === 'user' ? 'profiles' : kind === 'supplier' ? 'suppliers' : 'customers';
            const key = kind === 'user' ? KEYS.users : kind === 'supplier' ? KEYS.suppliers : KEYS.customers;
            const list = await loadRows(table, key, []);
            row = (list || []).find((r) => String(r.id) === String(id) || String(r.email) === String(id) || String(r.username) === String(id)) || row;
            if (kind === 'user' && (!row.email && !row.full_name)) {
              const { supabase, isRemoteKey } = await import('./supabaseClient.js');
              if (isRemoteKey(id)) {
                const q = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
                if (q.data) row = { ...row, ...q.data };
              }
            }
          } catch { /* keep stub */ }
        }
        m.openRecordView(row, { kind: kind || undefined, href });
      }).catch(() => {
        openFkModal(`<div class="fk-head"><h1>View</h1><button type="button" class="po-x" data-close>×</button></div>
          <p style="padding:24px">Could not open the record card.</p>`);
      });
      try { document.querySelectorAll('.act-flyout').forEach((n) => n.remove()); } catch { /* ignore */ }
      return 'claim';
    },
  });
}

export function injectDeskChromeCss() {
  if (document.getElementById('df-desk-chrome-css-v19')) return;
  const old = document.getElementById('df-desk-chrome-css') || document.getElementById('df-desk-chrome-css-v18');
  if (old) old.remove();
  const s = document.createElement('style');
  s.id = 'df-desk-chrome-css-v19';
  s.textContent = deskChromeCss();
  document.head.appendChild(s);
  bindFkViewModals();
  import('./record-view.js').then((m) => m.bindRecordViews(document)).catch(() => {});
  import('./link-guard.js').then((m) => m.bindLinkGuard()).catch(() => {});
  import('./acc-sync-live.js').then((m) => m.syncLiveAccounting()).catch(() => {});
  import('./info-tip.js').then((m) => {
    m.tightenBlurbs();
    m.bindInfoTips();
    const obs = new MutationObserver(() => { m.tightenBlurbs(); m.bindInfoTips(); });
    obs.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
  }).catch(() => {});
  import('./org-chain.js').then((m) => {
    m.applyOrgChain();
    const host = document.getElementById('app') || document.body;
    const obs = new MutationObserver(() => m.applyOrgChain());
    obs.observe(host, { childList: true, subtree: true });
  }).catch(() => {});
}
