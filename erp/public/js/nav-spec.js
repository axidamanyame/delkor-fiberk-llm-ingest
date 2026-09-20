/**
 * NOT the live menu.
 *
 * The sidebar is built from the MENU array in ultimate-shell.js. The href and
 * label trees below are left over from the template and have drifted: they
 * listed "Import Data" and "Import Products" under Contacts for entries the
 * live menu never carried, which is how those importers stayed unreachable.
 * They read as authoritative and are not.
 *
 * What this module is still used for is the page → module classification near
 * the bottom (the regex table), which the shell loads lazily. Keep that.
 *
 * Adding a screen: put it in MENU in ultimate-shell.js, then run
 * tools/menu-coverage.mjs to confirm nothing is stranded.
 */
/**
 * Unified nav spec — right-pane tools for core modules.
 * Every href here is an existing public page. No invented routes.
 */
const TOOLS = {
  home: {
    title: 'Dashboard Tools',
    items: [
      { href: '/dashboard.html', label: 'Quick Stats' },
      { href: '/notifications.html', label: 'Notifications' },
      { href: '/custom-dashboards.html', label: 'Shortcuts' },
    ],
  },
  comm: {
    title: 'Communications Tools',
    items: [
      { href: '/communications.html?tab=announce', label: 'New Announcement' },
      { href: '/communications.html?tab=msg', label: 'New Message' },
      { href: '/communications.html?tab=calls', label: 'Start Call' },
      { href: '/communications.html?tab=meet', label: 'Schedule Meeting' },
      { href: '/communications.html?tab=groups', label: 'Manage Groups' },
    ],
  },
  records: {
    title: 'Master Data Tools',
    items: [
      { href: '/customer-form.html', label: 'Add Contact' },
      { href: '/product-form.html', label: 'Add Product' },
      { href: '/import-contacts.html', label: 'Import Data' },
      { href: '/import-products.html', label: 'Import Products' },
    ],
  },
  purchases: {
    title: 'Procurement Tools',
    items: [
      { href: '/purchase-form.html', label: 'Add Purchase' },
      { href: '/purchase-invoice-form.html', label: 'Add Invoice' },
      { href: '/purchase-return-form.html', label: 'Add Return' },
      { href: '/suppliers.html', label: 'Suppliers' },
    ],
  },
  hub: {
    title: 'Warehouse Tools',
    items: [
      { href: '/wms.html?tab=scan', label: 'Scan Item' },
      { href: '/receive-stock.html', label: 'Receive Stock' },
      { href: '/stock-transfer-form.html', label: 'Transfer Stock' },
      { href: '/stock-adjustment-form.html', label: 'Adjust Stock' },
      { href: '/stock-count.html', label: 'Audit Tools' },
    ],
  },
  sales: {
    title: 'Sales Tools',
    items: [
      { href: '/sales-form.html', label: 'Add Sale' },
      { href: '/quotation-form.html', label: 'Add Quotation' },
      { href: '/pos-sessions.html', label: 'POS Actions' },
      { href: '/customers.html', label: 'Customers' },
    ],
  },
  finance: {
    title: 'Finance Tools',
    items: [
      { href: '/accounting-budget.html', label: 'Add Budget' },
      { href: '/expense-form.html', label: 'Add Expense' },
      { href: '/accounting-transfer.html', label: 'Add Payment' },
      { href: '/reports.html#rpt-g-finance', label: 'Financial Reports' },
    ],
  },
  collections: {
    title: 'Collections Desk',
    items: [
      { href: '/collections-desk.html', label: 'Accounts' },
      { href: '/collections-desk.html?pane=ptp', label: 'PTP Desk' },
      { href: '/collections-desk.html?pane=queues', label: 'Queues' },
      { href: '/collections-desk.html?pane=scores', label: 'Credit Grade' },
      { href: '/collections-desk.html?pane=diary', label: 'Call Diary' },
      { href: '/collections-desk.html?pane=regulars', label: 'Regular Payers' },
      { href: '/collections-desk.html?pane=exceptions', label: 'Exceptions' },
    ],
  },
  reports: {
    title: 'Report Tools',
    items: [
      { href: '/reports.html', label: 'All Reports' },
      { href: '/report-purchase-sell.html', label: 'Purchase' },
      { href: '/report-stock.html', label: 'Inventory' },
      { href: '/pos-sales.html', label: 'Sales' },
      { href: '/report-profit-loss.html', label: 'Finance' },
      { href: '/reports.html?t=col-age', label: 'Collections' },
    ],
  },
  system: {
    title: 'System Tools',
    items: [
      { href: '/users.html', label: 'Add User' },
      { href: '/roles.html', label: 'Add Role' },
      { href: '/backup.html', label: 'Backup Tools' },
      { href: '/audit-log.html', label: 'System Logs' },
    ],
  },
};

const PATHS = [
  [/dashboard/, 'home'],
  [/communications|announce|messages|calls\.html|meetings|comm-groups/, 'comm'],
  [/supplier|customer|client-group|investor|partner|consultant|loyalty|product|brand|categor|variation|unit|warrant|price-group|media-sync|franko|missing-image|import-contact|import-product/, 'records'],
  [/purchase|paper-purchase/, 'purchases'],
  [/virtual-warehouse|receive-stock|put-away|stock-transfer|stock-adjust|stock-count/, 'hub'],
  [/sales-|sales-form|pos-|draft|quotation|sell-return|shipment|import-sales|discount/, 'sales'],
  [/finance|payment-account|banking|uba-fiberk|accounting-transfer|accounting-budget|budgets|expense/, 'finance'],
  [/collection/, 'collections'],
  [/report/, 'reports'],
  [/settings|manual|business-location|invoice-|barcode|printer|tax-rate|payment-setting|notification|sms-setting|backup|users|roles|commission|audit-log/, 'system'],
];

export function specKeyFromPath(path) {
  const p = String(path || location.pathname || '');
  const hit = PATHS.find(([re]) => re.test(p));
  return hit ? hit[1] : '';
}

export function mountNavSpec() {
  if (/color-report|color-setup|login|pos\.html|repair-till/.test(location.pathname || '')) return;
  const key = specKeyFromPath();
  const spec = TOOLS[key];
  if (!spec) return;
  if (document.getElementById('nav-spec-bar')) return;
  const bar = document.createElement('div');
  bar.id = 'nav-spec-bar';
  bar.innerHTML = `<div class="nav-spec">
    <span class="nav-spec-t">${spec.title}</span>
    ${spec.items.map((it) => `<a class="nav-spec-a" href="${it.href}">${it.label}</a>`).join('')}
  </div>`;
  const main = document.querySelector('.ult-main') || document.body;
  const after = document.getElementById('mod-book-bar');
  if (after && after.nextSibling) main.insertBefore(bar, after.nextSibling);
  else main.insertBefore(bar, main.firstChild);
  if (!document.getElementById('nav-spec-css')) {
    const s = document.createElement('style');
    s.id = 'nav-spec-css';
    s.textContent = `#nav-spec-bar{padding:4px 0 10px}
      .nav-spec{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
      .nav-spec-t{font-size:11px;font-weight:800;color:#64748b;margin-right:4px;text-transform:uppercase;letter-spacing:.04em}
      .nav-spec-a{display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;background:#fff;border:1px solid #dbe4ee;color:#0f172a;font-size:12px;font-weight:700;text-decoration:none}
      .nav-spec-a:hover{border-color:#0f766e;color:#0f766e}`;
    document.head.appendChild(s);
  }
}
