/**
 * Boot the finished sandbox reports inside the live ERP shell.
 * Header / sidebar stay ultimate-pos. Failed reports-hub painters are unused.
 * Same-file SPA clicks (Reports → Product Purchase) must re-paint via df-tab.
 */
const YEAR = String(new Date().getFullYear());

export const REPORT_CODES = {
  index: 'all',
  all: 'all',
  'purchase-sell': 'pur.sale',
  pp: 'pur.product',
  ppay: 'pur.payments',
  psp: 'pur.sale_product',
  stock: 'inv.stock',
  adj: 'inv.adjust',
  items: 'inv.items',
  sell: 'sales.product_sell',
  'sell-group': 'sales.grouped',
  spay: 'sales.sell_payment',
  register: 'sales.pos_register',
  'sales-rep': 'sales.rep',
  'profit-loss': 'fin.pl',
  tax: 'fin.tax',
  age: 'fin.age',
  expense: 'fin.expense',
  contacts: 'sys.contacts',
  groups: 'sys.groups',
  activity: 'sys.activity',
  z: 'sys.z',
  trending: 'sales.trending',
  'stock-value': 'inv.stock',
  'col-age': 'col.ageing',
  'col-ptp': 'col.ptp',
  'col-diary': 'col.calls',
  'col-reg': 'col.regular',
  'col-ex': 'col.exceptions',
  'col-pay': 'col.hp',
};

function ensureCss() {
  if (!document.querySelector('link[href="/css/sandbox.css"]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = '/css/sandbox.css';
    document.head.appendChild(l);
  }
}

function loadSandbox() {
  if (window.readyReports || window.generateReport) return Promise.resolve();
  return new Promise((resolve, reject) => {
    window.__DF_SANDBOX_DEFER = true;
    const s = document.createElement('script');
    s.src = '/js/sandbox.js';
    s.onload = resolve;
    s.onerror = reject;
    document.body.appendChild(s);
  });
}

function mountHtml() {
  return `
    <div class="df-sandbox">
      <header class="top hidden-print">
        <p id="crumb">Reports · All Reports</p>
        <div class="filters">
          <label>From <input type="date" id="date-from" value="${YEAR}-01-01" /></label>
          <label>To <input type="date" id="date-to" value="${new Date().toISOString().slice(0, 10)}" /></label>
          <label>Subsidiary
            <select id="branch-sub">
              <option>All Subsidiaries</option>
              <option>Operations Hub</option>
              <option>Axidigetek (E-comm HQ)</option>
              <option>BNPL (Hire Purchase)</option>
              <option>Delkor Logistics</option>
              <option>Fiberk (Electronics)</option>
            </select>
          </label>
          <label>Location
            <select id="branch">
              <option>All Locations</option>
              <option>Axidigetek Online Store</option>
              <option>BNPL Market (Field)</option>
              <option>BNPL Online Shop</option>
              <option>Delkor Online</option>
              <option>Delkor Furniture Market</option>
              <option>Fiberk Shop</option>
              <option>Field Stock Hub</option>
            </select>
          </label>
          <button type="button" id="run-btn">Run</button>
          <button type="button" id="print-btn" class="ghost">Print</button>
        </div>
      </header>
      <div id="report" class="report"></div>
    </div>`;
}

function mappedCode(code) {
  const raw = code || new URLSearchParams(location.search).get('t') || 'all';
  const mapped = REPORT_CODES[raw] || raw || 'all';
  return mapped === 'index' ? 'all' : mapped;
}

function bindReportNav() {
  if (document.documentElement.dataset.rptBoot === '1') return;
  document.documentElement.dataset.rptBoot = '1';
  const rerun = () => {
    const next = mappedCode();
    window.__DF_REPORT_CODE = next;
    const box = document.getElementById('report');
    if (box && typeof window.generateReport === 'function') {
      try { window.generateReport(next); } catch (err) { console.warn('report', err); }
      return;
    }
    bootReport(next).catch((err) => console.warn('report', err));
  };
  window.addEventListener('df-tab', rerun);
  window.addEventListener('popstate', rerun);
}

export async function bootReport(code = 'all') {
  ensureCss();
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = mountHtml();
  const mapped = mappedCode(code);
  window.__DF_REPORT_CODE = mapped;
  try {
    await loadSandbox();
    if (typeof window.readyReports === 'function') window.readyReports(mapped);
    else if (typeof window.generateReport === 'function') window.generateReport(mapped);
  } catch (err) {
    console.warn('report boot', err);
    const box = document.getElementById('report');
    if (box) {
      box.innerHTML = `<section class="items-card"><h3>Reports</h3><p class="subhead">Could not open this document. ${String(err.message || err)}</p></section>`;
    }
  }
  bindReportNav();
}

export async function bootReportsHub(code = 'all') {
  return bootReport(code);
}
