/**
 * WooCommerce hub — dashboard, sync log, API settings (UPOS layout).
 */
import { getActiveSubsidiary } from './supabaseClient.js';
import { BUSINESS_LOCATIONS, SCOPE_EVENT } from './scope.js';
import { bindTable } from './home-tables.js';
import { tableBar, tableFoot } from './accounting.js';
import { modalShell } from './pay-accounts.js';
import { readLs, writeLs, esc } from './ls-rows.js';
import { bindOverflowTabs, onHubNavigate, floorNav, tryPaintFloor, bindHubTabs } from './hub-kit.js';

const SET_KEY = 'df_woo_settings';
const LOG_KEY = 'df_woo_sync_log';
const FLAG = 'df_woo_v3';

const TABS = [
  { key: 'sync', label: 'WooCommerce' },
  { key: 'log', label: 'Sync Log' },
  { key: 'api', label: 'API Settings' },
];
const PANES = [
  { key: 'instructions', label: 'Instructions' },
  { key: 'api', label: 'API Settings' },
  { key: 'product', label: 'Product Sync Settings' },
  { key: 'order', label: 'Order Sync Settings' },
  { key: 'webhook', label: 'Webhook Settings' },
];
const WOO_STATUSES = ['pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed', 'shipped'];
const POS_SELL = ['', 'Final', 'Draft', 'Quotation', 'Received'];
const SHIP = ['', 'Ordered', 'Packed', 'Shipped', 'Delivered'];
const CREATE_FIELDS = [
  { id: 'name', label: 'Product Name', locked: true },
  { id: 'price', label: 'Price', locked: true },
  { id: 'category', label: 'Category' },
  { id: 'qty', label: 'Quantity' },
  { id: 'weight', label: 'Weight' },
  { id: 'images', label: 'Images' },
  { id: 'desc', label: 'Description' },
];
const POS_TAX = ['VAT@15%', 'NHIL@2.5%', 'GETFund@2.5%', 'COVID-19 Levy@1%'];
const WOO_TAX = ['Standard rate (VAT 15%)', 'Reduced rate', 'Zero rated', 'Exempt'];

function subShort() { return getActiveSubsidiary()?.short || 'Group'; }

function defaults() {
  const loc = BUSINESS_LOCATIONS.find((l) => l.code === 'FIB-SHOP') || BUSINESS_LOCATIONS[0];
  const orderMap = {};
  WOO_STATUSES.forEach((s) => { orderMap[s] = { sell: '', ship: '' }; });
  orderMap.processing.sell = 'Final';
  orderMap.completed.sell = 'Final';
  orderMap.completed.ship = 'Delivered';
  orderMap.shipped.ship = 'Shipped';
  return {
    store_url: 'https://shop.fiberk.com',
    consumer_key: 'ck_df_live_9f3a2b1c4d5e',
    consumer_secret: 'cs_df_live_7a8b9c0d1e2f',
    location: loc?.code || '',
    auto_sync: false,
    tax_class: '',
    sync_price: 'including',
    price_group: 'Default',
    desc_as: 'long',
    create: { name: true, price: true, category: true, qty: true, weight: false, images: false, desc: false },
    update: { name: true, price: true, category: true, qty: true, weight: false, images: false, desc: false },
    tax_map: Object.fromEntries(POS_TAX.map((t) => [t, ''])),
    order_map: orderMap,
    webhooks: {
      created: '',
      updated: '',
      deleted: '',
      restored: '',
    },
    unsynced_cats: 19,
    unsynced_products: 32,
  };
}

function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(SET_KEY) || 'null');
    if (raw && typeof raw === 'object') {
      const d = defaults();
      return {
        ...d, ...raw,
        create: { ...d.create, ...(raw.create || {}) },
        update: { ...d.update, ...(raw.update || {}) },
        tax_map: { ...d.tax_map, ...(raw.tax_map || {}) },
        order_map: { ...d.order_map, ...(raw.order_map || {}) },
        webhooks: { ...d.webhooks, ...(raw.webhooks || {}) },
      };
    }
  } catch { /* ignore */ }
  return defaults();
}

function saveSettings(patch) {
  const next = { ...loadSettings(), ...patch };
  try { localStorage.setItem(SET_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  return next;
}

function loadLog() { return readLs(LOG_KEY, []); }

function pushLog(entry) {
  const rows = [entry, ...loadLog()].slice(0, 80);
  writeLs(LOG_KEY, rows);
  return rows;
}

function fmtWhen(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd}/${yy} ${hh}:${mi}`;
}

function ago(iso) {
  const d = new Date(iso);
  const now = new Date('2026-09-04T08:00:00');
  const days = Math.max(0, Math.round((now - d) / 86400000));
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const mo = Math.round(days / 30);
  return mo === 1 ? '1 month ago' : `${mo} months ago`;
}

function ensureWoo() {
  try {
    if (localStorage.getItem(FLAG) === '1') return;
  } catch { /* ignore */ }
  saveSettings(defaults());
  writeLs(LOG_KEY, []);
  try { localStorage.setItem(FLAG, '1'); } catch { /* ignore */ }
}

function tabFromUrl() {
  const t = new URLSearchParams(location.search).get('tab') || 'sync';
  if (['sync', 'log', 'api', 'topics', 'reports', 'setup'].includes(t)) return t;
  return TABS.some((x) => x.key === t) ? t : 'sync';
}
function paneFromUrl() {
  const p = new URLSearchParams(location.search).get('pane') || 'instructions';
  return PANES.some((x) => x.key === p) ? p : 'instructions';
}
function go(tab, pane) {
  const u = new URL(location.href);
  u.pathname = '/woocommerce.html';
  u.search = '';
  u.searchParams.set('tab', tab);
  if (tab === 'api') u.searchParams.set('pane', pane || 'instructions');
  const path = u.pathname + u.search;
  history.pushState({ spa: path }, '', path);
  paint();
}

function navHtml(tab) {
  return floorNav('WooCommerce', tab, 'sync', '/woocommerce.html');
}

function info(text) {
  return `<span class="woo-i" title="${esc(text)}">i</span>`;
}

function locOptions(selected) {
  return BUSINESS_LOCATIONS.map((l) =>
    `<option value="${esc(l.code)}" ${l.code === selected ? 'selected' : ''}>${esc(l.name)}</option>`
  ).join('');
}

function toast(app, msg, ok = true) {
  let el = app.querySelector('#woo-msg');
  if (!el) {
    el = document.createElement('div');
    el.id = 'woo-msg';
    app.appendChild(el);
  }
  el.innerHTML = `<div class="${ok ? 'ult-banner-ok' : 'ult-banner-warn'}">${esc(msg)}</div>`;
}

function confirmReset(title, body, onYes) {
  const host = document.createElement('div');
  host.innerHTML = modalShell(title, `
    <p>${esc(body)}</p>
    <label class="woo-check"><input type="checkbox" id="yes-reset" /> Yes, I want to reset</label>
  `, `<button type="button" class="ult-btn ult-btn-outline" data-close>Cancel</button>
     <button type="button" class="ult-btn ult-btn-danger" id="do-reset">Reset</button>`);
  document.body.appendChild(host);
  host.querySelector('[data-close]').onclick = () => host.remove();
  host.querySelector('.pay-modal-x')?.addEventListener('click', () => host.remove());
  host.querySelector('#pay-modal').onclick = (e) => { if (e.target.id === 'pay-modal') host.remove(); };
  host.querySelector('#do-reset').onclick = () => {
    if (!host.querySelector('#yes-reset').checked) {
      alert('Tick “Yes, I want to reset” to continue.');
      return;
    }
    host.remove();
    onYes();
  };
}

function bindHead(app) {
  bindHubTabs(app, (k) => go(k || 'sync'));
}

function paintSync(app) {
  const s = loadSettings();
  const catBanner = s.unsynced_cats > 0
    ? `<div class="woo-banner" data-dismiss="cat"><span>${s.unsynced_cats} Categories not synced</span><button type="button" aria-label="Dismiss">×</button></div>`
    : `<p class="chq-ok">All categories are synced.</p>`;
  const prodBanner = s.unsynced_products > 0
    ? `<div class="woo-banner" data-dismiss="prod"><span>${s.unsynced_products} Products not synced</span><button type="button" aria-label="Dismiss">×</button></div>`
    : `<p class="chq-ok">All products are synced.</p>`;

  app.innerHTML = `
    ${navHtml('sync')}
    <div class="acc-top"><div><h1>WooCommerce</h1><p class="sub">Store sync · ${esc(subShort())}</p></div></div>
    <div class="woo-grid">
      <div class="ult-card">
        <h3 class="woo-h">Sync Product Categories:</h3>
        ${catBanner}
        <button type="button" class="ult-btn ult-btn-primary woo-wide" id="sync-cats">Sync</button>
        <div class="woo-reset-wrap">
          <button type="button" class="woo-reset" id="reset-cats">↺ Reset synced categories</button>
        </div>
      </div>
      <div class="ult-card">
        <h3 class="woo-h">Sync Products:</h3>
        ${prodBanner}
        <div class="woo-prod-btns">
          <button type="button" class="ult-btn woo-new" id="sync-new">Sync only new</button>${info('Creates products that do not yet exist in WooCommerce.')}
          <button type="button" class="ult-btn ult-btn-primary" id="sync-all">Sync all</button>${info('Creates new products and updates already synced products.')}
        </div>
        <div class="woo-reset-wrap">
          <button type="button" class="woo-reset" id="reset-prods">↺ Reset synced products</button>
        </div>
      </div>
      <div class="ult-card">
        <h3 class="woo-h">Map Tax Rates:</h3>
        <div class="ult-table-wrap"><table class="ult-table">
          <thead><tr><th>POS Tax Rate</th><th>Equivalent WooCommerce Tax Rate</th></tr></thead>
          <tbody>
            ${POS_TAX.map((t) => `<tr>
              <td>${esc(t)}:</td>
              <td><select class="tax-map" data-pos="${esc(t)}">
                <option value="">Please Select</option>
                ${WOO_TAX.map((w) => `<option ${s.tax_map[t] === w ? 'selected' : ''}>${esc(w)}</option>`).join('')}
              </select></td>
            </tr>`).join('')}
          </tbody>
        </table></div>
        <div class="woo-tax-save"><button type="button" class="ult-btn ult-btn-danger" id="save-tax">Save</button></div>
      </div>
      <div class="ult-card">
        <h3 class="woo-h">Sync Orders:</h3>
        <button type="button" class="ult-btn ult-btn-success woo-wide" id="sync-orders">Sync</button>
      </div>
    </div>
    <div id="woo-msg"></div>`;

  app.querySelectorAll('[data-dismiss]').forEach((b) => {
    b.querySelector('button').onclick = () => b.remove();
  });

  const busy = (btn) => {
    btn.disabled = true;
    const prev = btn.innerHTML;
    btn.textContent = 'Syncing…';
    return () => { btn.disabled = false; btn.innerHTML = prev; };
  };

  app.querySelector('#sync-cats').onclick = () => {
    const btn = app.querySelector('#sync-cats');
    const done = busy(btn);
    window.onbeforeunload = () => true;
    setTimeout(() => {
      const n = loadSettings().unsynced_cats;
      saveSettings({ unsynced_cats: 0 });
      pushLog({
        id: 'wl-' + Date.now(), at: new Date().toISOString(), type: 'Categories', op: 'Created',
        by: 'HQ Finance', records: n ? `${n} Ghana categories` : '', n,
        details: n ? `Synced ${n} categories to shop.fiberk.com` : 'Nothing pending',
      });
      window.onbeforeunload = null;
      done();
      paint();
    }, 400);
  };
  app.querySelector('#reset-cats').onclick = () => confirmReset(
    'Are you sure?',
    'All synced categories will be reset',
    () => { saveSettings({ unsynced_cats: 19 }); paint(); },
  );
  app.querySelector('#sync-new').onclick = () => {
    const n = loadSettings().unsynced_products;
    const created = Math.min(8, n);
    saveSettings({ unsynced_products: n - created });
    pushLog({
      id: 'wl-' + Date.now(), at: new Date().toISOString(), type: 'Products', op: 'Created',
      by: 'Ama Serwaa', records: created ? `FIB-${440 + created}, AXI-${1900 + created}` : '', n: created,
      details: created ? `Created ${created} new products on shop.fiberk.com` : 'No new products',
    });
    paint();
  };
  app.querySelector('#sync-all').onclick = () => {
    const btn = app.querySelector('#sync-all');
    const done = busy(btn);
    window.onbeforeunload = () => true;
    setTimeout(() => {
      const n = loadSettings().unsynced_products;
      saveSettings({ unsynced_products: 0 });
      pushLog({
        id: 'wl-' + Date.now(), at: new Date().toISOString(), type: 'Products', op: 'Updated',
        by: 'Ama Serwaa', records: n ? `${n} catalogue SKUs` : 'catalogue', n,
        details: `Synced all products for ${subShort()}`,
      });
      window.onbeforeunload = null;
      done();
      paint();
    }, 500);
  };
  app.querySelector('#reset-prods').onclick = () => confirmReset(
    'Are you sure?',
    'All synced products will be reset',
    () => { saveSettings({ unsynced_products: 32 }); paint(); },
  );
  app.querySelector('#sync-orders').onclick = () => {
    toast(app, 'No WooCommerce orders to pull yet.');
  };
  app.querySelector('#save-tax').onclick = () => {
    const map = { ...loadSettings().tax_map };
    app.querySelectorAll('.tax-map').forEach((sel) => { map[sel.dataset.pos] = sel.value; });
    saveSettings({ tax_map: map });
    toast(app, 'Tax mapping saved.');
  };
  bindHead(app);
}

function paintLog(app) {
  const rows = loadLog();
  app.innerHTML = `
    ${navHtml('log')}
    <div class="acc-top"><div><h1>Sync Log</h1><p class="sub">WooCommerce activity · ${esc(subShort())}</p></div></div>
    <div class="ult-card" data-tbl="woo-log">
      ${tableBar()}
      <div class="ult-table-wrap"><table class="ult-table">
        <thead><tr>
          <th data-nosort="1"></th>
          <th>Date</th>
          <th>Sync Type</th>
          <th>Operation</th>
          <th>Synced By</th>
          <th data-nosort="1">Records</th>
        </tr></thead>
        <tbody>
          ${rows.map((r) => `<tr data-id="${esc(r.id)}" class="${r.details ? 'woo-has-detail' : ''}">
            <td>${r.details ? `<button type="button" class="woo-plus" data-detail="${esc(r.id)}" aria-label="Details">+</button>` : ''}</td>
            <td>${esc(fmtWhen(r.at))}<div class="ult-muted" style="font-size:11px">${esc(ago(r.at))}</div></td>
            <td>${esc(r.type)}</td>
            <td>${esc(r.op)}</td>
            <td>${esc(r.by)}</td>
            <td>${esc(r.records || '')}${r.n ? `<div class="ult-muted" style="font-size:11px">${r.n} Record${r.n === 1 ? '' : 's'}</div>` : ''}</td>
          </tr>`).join('') || '<tr data-dummy="1"><td colspan="6" style="text-align:center">No data available in table</td></tr>'}
        </tbody>
      </table></div>
      ${tableFoot()}
    </div>`;
  bindTable(app.querySelector('[data-tbl="woo-log"]'), { title: 'Sync Log', storageKey: 'woo-log' });
  app.querySelectorAll('[data-detail]').forEach((b) => {
    b.onclick = () => {
      const tr = b.closest('tr');
      const id = b.dataset.detail;
      const next = tr.nextElementSibling;
      if (next?.dataset.child === id) {
        next.remove();
        b.textContent = '+';
        tr.classList.remove('open');
        return;
      }
      const row = rows.find((r) => String(r.id) === id);
      const child = document.createElement('tr');
      child.dataset.child = id;
      child.innerHTML = `<td colspan="6"><pre class="woo-detail">${esc(row?.details || 'No extra detail')}</pre></td>`;
      tr.after(child);
      b.textContent = '−';
      tr.classList.add('open');
    };
  });
  bindHead(app);
}

function fieldChecks(group, state) {
  return `<div class="woo-fields">${CREATE_FIELDS.map((f) => {
    const locked = group === 'create' && f.locked;
    const on = locked || !!state[f.id];
    return `<label class="woo-check"><input type="checkbox" data-f="${group}.${f.id}" ${on ? 'checked' : ''} ${locked ? 'disabled' : ''} /> ${esc(f.label)}</label>`;
  }).join('')}</div>`;
}

function webhookUrl(kind) {
  return `${location.origin}/woocommerce/webhook/order-${kind}/1`;
}

function paintApi(app) {
  const s = loadSettings();
  const pane = paneFromUrl();
  const body = {
    instructions: `
      <ul class="woo-instr">
        <li>Do not refresh or leave the page while synchronizing</li>
        <li>Timezone of POS should be same as timezone of the WooCommerce App</li>
        <li>Get API keys from <em>WooCommerce → Settings → Advanced → REST API</em>. Choose <strong>Add Key</strong> / <strong>Create an API key</strong>, enter a Description, select a User, set permission to <strong>Read/Write</strong>, then <strong>Generate API Key</strong>. Copy the Consumer Key and Consumer Secret (the secret is shown only once). <a href="https://woocommerce.com/document/woocommerce-rest-api/#section-3" target="_blank" rel="noreferrer">Click here</a> for more info</li>
        <li>In WordPress go to <em>Settings → Permalinks</em> and use <strong>Post name</strong> (any option other than <strong>Plain</strong>). If it still does not connect, save permalinks again to reset them.</li>
        <li>Paste the store URL, Consumer Key and Consumer Secret on the <strong>API Settings</strong> tab. The store URL is the WooCommerce site address (no trailing path).</li>
      </ul>`,
    api: `
      <div class="woo-form-3">
        <div class="ult-field"><label>WooCommerce App URL:</label>
          <input id="w-url" value="${esc(s.store_url)}" placeholder="WooCommerce App URL" /></div>
        <div class="ult-field"><label>WooCommerce Consumer Key:</label>
          <input id="w-ck" value="${esc(s.consumer_key)}" /></div>
        <div class="ult-field"><label>WooCommerce Consumer Secret:</label>
          <input id="w-cs" type="password" value="${esc(s.consumer_secret)}" /></div>
      </div>
      <div class="woo-form-3" style="margin-top:16px">
        <div class="ult-field"><label>Business Locations: ${info('Products will be created from this location.')}</label>
          <select id="w-loc">${locOptions(s.location)}</select></div>
        <div class="ult-field" style="justify-content:flex-end">
          <label class="woo-check" style="margin-top:22px"><input type="checkbox" id="w-auto" ${s.auto_sync ? 'checked' : ''} /> Enable Auto Sync ${info('When enabled, new products created in POS are pushed to WooCommerce.')}</label>
        </div>
      </div>
      <div style="margin-top:18px"><button type="button" class="ult-btn ult-btn-primary" id="w-save-api">Save</button></div>`,
    product: `
      <div class="woo-form-3">
        <div class="ult-field"><label>Default Tax Class: ${info('WooCommerce tax class assigned to new products.')}</label>
          <input id="w-taxclass" value="${esc(s.tax_class)}" /></div>
        <div class="ult-field"><label>Sync Product Price:</label>
          <select id="w-price"><option value="including" ${s.sync_price === 'including' ? 'selected' : ''}>Including Tax</option><option value="excluding" ${s.sync_price === 'excluding' ? 'selected' : ''}>Excluding Tax</option></select></div>
        <div class="ult-field"><label>Default Selling Price Group:</label>
          <select id="w-pg"><option ${s.price_group === 'Default' ? 'selected' : ''}>Default</option><option ${s.price_group === 'Retail' ? 'selected' : ''}>Retail</option><option ${s.price_group === 'Wholesale' ? 'selected' : ''}>Wholesale</option></select></div>
      </div>
      <div class="ult-field" style="max-width:280px;margin-top:12px"><label>Sync product description as:</label>
        <select id="w-desc"><option value="long" ${s.desc_as === 'long' ? 'selected' : ''}>Long description</option><option value="short" ${s.desc_as === 'short' ? 'selected' : ''}>Short description</option></select></div>
      <hr class="woo-hr" />
      <p class="woo-legend">Product fields to be synced with woocommerce while creating products:</p>
      ${fieldChecks('create', s.create)}
      <hr class="woo-hr" />
      <p class="woo-legend">Product fields to be synced with woocommerce while updating products:</p>
      ${fieldChecks('update', s.update)}
      <div style="margin-top:18px"><button type="button" class="ult-btn ult-btn-primary" id="w-save-prod">Save</button></div>`,
    order: `
      <div class="ult-table-wrap"><table class="ult-table woo-map">
        <thead><tr>
          <th>WooCommerce order status</th>
          <th>Equivalent POS sell status</th>
          <th>Equivalent shipping status</th>
        </tr></thead>
        <tbody>
          ${WOO_STATUSES.map((st) => {
            const m = s.order_map[st] || { sell: '', ship: '' };
            const opt = (list, cur) => list.map((v) =>
              `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${v ? esc(v) : 'Please Select'}</option>`).join('');
            return `<tr>
              <td style="text-transform:capitalize">${esc(st.replace('-', ' '))}</td>
              <td><select data-sell="${esc(st)}">${opt(POS_SELL, m.sell)}</select></td>
              <td><select data-ship="${esc(st)}">${opt(SHIP, m.ship)}</select></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>
      <div style="margin-top:18px"><button type="button" class="ult-btn ult-btn-primary" id="w-save-ord">Save</button></div>`,
    webhook: `
      ${[['created', 'Order Created'], ['updated', 'Order Updated'], ['deleted', 'Order Deleted'], ['restored', 'Order Restored']].map(([k, label]) => `
        <div class="woo-hook">
          <h4>${esc(label)}</h4>
          <div class="woo-form-2">
            <div class="ult-field"><label>Webhook Secret:</label>
              <input data-wh="${esc(k)}" value="${esc(s.webhooks[k] || '')}" placeholder="Webhook Secret" /></div>
            <div class="ult-field"><label>Webhook Delivery URL:</label>
              <input readonly value="${esc(webhookUrl(k))}" /></div>
          </div>
        </div>`).join('')}
      <div style="margin-top:8px"><button type="button" class="ult-btn ult-btn-primary" id="w-save-wh">Save</button></div>`,
  }[pane];

  app.innerHTML = `
    ${navHtml('api')}
    <div class="acc-top"><div><h1>API Settings</h1><p class="sub">WooCommerce connection · ${esc(subShort())}</p></div></div>
    <div class="ult-card woo-api">
      <nav class="woo-side">
        ${PANES.map((p) => `<button type="button" class="${p.key === pane ? 'on' : ''}" data-woo-pane="${p.key}">${esc(p.label)}</button>`).join('')}
      </nav>
      <div class="woo-api-body">${body}</div>
    </div>
    <div id="woo-msg"></div>`;

  app.querySelectorAll('[data-woo-pane]').forEach((b) => {
    b.onclick = () => go('api', b.dataset.wooPane);
  });

  const readChecks = (group) => {
    const out = { ...loadSettings()[group] };
    app.querySelectorAll(`[data-f^="${group}."]`).forEach((c) => {
      out[c.dataset.f.split('.')[1]] = c.checked;
    });
    return out;
  };

  app.querySelector('#w-save-api')?.addEventListener('click', () => {
    saveSettings({
      store_url: app.querySelector('#w-url').value.trim(),
      consumer_key: app.querySelector('#w-ck').value.trim(),
      consumer_secret: app.querySelector('#w-cs').value.trim(),
      location: app.querySelector('#w-loc').value,
      auto_sync: app.querySelector('#w-auto').checked,
    });
    toast(app, 'API settings saved.');
  });
  app.querySelector('#w-save-prod')?.addEventListener('click', () => {
    saveSettings({
      tax_class: app.querySelector('#w-taxclass').value.trim(),
      sync_price: app.querySelector('#w-price').value,
      price_group: app.querySelector('#w-pg').value,
      desc_as: app.querySelector('#w-desc').value,
      create: readChecks('create'),
      update: readChecks('update'),
    });
    toast(app, 'Product sync settings saved.');
  });
  app.querySelector('#w-save-ord')?.addEventListener('click', () => {
    const order_map = { ...loadSettings().order_map };
    WOO_STATUSES.forEach((st) => {
      order_map[st] = {
        sell: app.querySelector(`[data-sell="${st}"]`)?.value || '',
        ship: app.querySelector(`[data-ship="${st}"]`)?.value || '',
      };
    });
    saveSettings({ order_map });
    toast(app, 'Order sync mapping saved.');
  });
  app.querySelector('#w-save-wh')?.addEventListener('click', () => {
    const webhooks = { ...loadSettings().webhooks };
    app.querySelectorAll('[data-wh]').forEach((i) => { webhooks[i.dataset.wh] = i.value.trim(); });
    saveSettings({ webhooks });
    toast(app, 'Webhook settings saved.');
  });
  bindHead(app);
}

export function paint() {
  const app = document.getElementById('app');
  if (!app) return;
  ensureWoo();
  const tab = tabFromUrl();
  if (tryPaintFloor(app, tab, { brand: 'WooCommerce', file: '/woocommerce.html', go })) return;
  if (tab === 'log') return paintLog(app);
  if (tab === 'api') return paintApi(app);
  return paintSync(app);
}

export async function bootWooCommerce() {
  onHubNavigate(paint);
  await paint();
  const load = () => paint();
  window.addEventListener(SCOPE_EVENT, load);
  window.addEventListener('df-spa-leave', () => window.removeEventListener(SCOPE_EVENT, load), { once: true });
  if (!window.__dfWooPop) {
    window.__dfWooPop = true;
    window.addEventListener('popstate', () => paint());
  }
}
