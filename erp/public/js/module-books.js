/** Color-coded modules each own two hardcoded pages: Report and Setup. */
export const MODULE_BOOKS = {
  accounting: {
    label: 'Accounting',
    home: '/accounting.html',
    reports: [
      { href: '/accounting.html?tab=reports', label: 'Trial / Balance / Cash flow' },
      { href: '/account-trial-balance.html', label: 'Trial Balance' },
      { href: '/account-balance-sheet.html', label: 'Balance Sheet' },
      { href: '/account-cash-flow.html', label: 'Cash Flow' },
      { href: '/report-tax.html', label: 'Tax Report' },
    ],
    setup: [
      { href: '/accounting.html?tab=settings', label: 'Map transactions' },
      { href: '/accounting.html?tab=coa', label: 'Chart of accounts' },
    ],
  },
  wms: {
    label: 'WMS',
    home: '/wms.html',
    reports: [
      { href: '/report-stock.html', label: 'Stock report' },
      { href: '/report-stock-value.html', label: 'Stock value' },
      { href: '/product-stock-history.html', label: 'Stock history' },
      { href: '/stock-transfers.html', label: 'Transfers' },
    ],
    setup: [
      { href: '/wms.html?tab=scan', label: 'Scan stations' },
      { href: '/business-locations.html', label: 'Locations' },
    ],
  },
  fieldops: {
    label: 'Field Ops',
    home: '/field-ops.html',
    reports: [
      { href: '/reports.html?t=col-pay', label: 'HP collections' },
      { href: '/field-ops.html?tab=payments', label: 'Payment record totals' },
      { href: '/field-ops.html?tab=orders', label: 'Order list' },
    ],
    setup: [
      { href: '/field-ops.html?tab=sync', label: 'Sync' },
      { href: '/field-ops.html?tab=agents', label: 'Agents' },
    ],
  },
  crm: {
    label: 'CRM',
    home: '/crm.html',
    reports: [
      { href: '/crm.html?tab=reports', label: 'CRM reports' },
      { href: '/report-contacts.html', label: 'Customers & suppliers' },
    ],
    setup: [
      { href: '/crm.html?tab=sources', label: 'Sources' },
      { href: '/crm.html?tab=life', label: 'Life stage' },
      { href: '/crm.html?tab=fcat', label: 'Follow-up category' },
    ],
  },
  hrm: {
    label: 'HRM',
    home: '/hrm.html',
    reports: [
      { href: '/hrm.html?tab=payroll', label: 'Payroll' },
      { href: '/hrm.html?tab=att', label: 'Attendance' },
      { href: '/hrm.html?tab=leave', label: 'Leave' },
    ],
    setup: [
      { href: '/hrm.html?tab=types', label: 'Leave type' },
      { href: '/hrm.html?tab=dept', label: 'Departments' },
      { href: '/hrm.html?tab=desig', label: 'Designations' },
    ],
  },
  assets: {
    label: 'Asset Management',
    home: '/assets.html',
    reports: [
      { href: '/assets.html?tab=allocated', label: 'Allocated' },
      { href: '/assets.html?tab=revoked', label: 'Revoked' },
    ],
    setup: [
      { href: '/assets.html?tab=cats', label: 'Asset categories' },
    ],
  },
  repair: {
    label: 'Repair',
    home: '/repair.html',
    reports: [
      { href: '/repair.html?tab=jobs', label: 'Job sheets' },
      { href: '/repair.html?tab=inv', label: 'Invoices' },
    ],
    setup: [
      { href: '/repair.html?tab=brands', label: 'Repair brands' },
    ],
  },
  project: {
    label: 'Project',
    home: '/projects.html',
    reports: [
      { href: '/projects.html?tab=reports', label: 'Project reports' },
    ],
    setup: [
      { href: '/projects.html?tab=cats', label: 'Project categories' },
    ],
  },
  essentials: {
    label: 'Communications',
    home: '/communications.html',
    reports: [
      { href: '/communications.html?tab=announce', label: 'Announcements' },
      { href: '/communications.html?tab=todo', label: 'Open to-dos' },
      { href: '/communications.html?tab=docs', label: 'Documents' },
    ],
    setup: [
      { href: '/communications.html?tab=groups', label: 'Groups' },
      { href: '/communications.html?tab=settings', label: 'To Do prefix' },
      { href: '/settings.html?tab=system', label: 'Meet code' },
    ],
  },
  communications: {
    label: 'Communications',
    home: '/communications.html',
    reports: [
      { href: '/communications.html?tab=announce', label: 'Announcements' },
      { href: '/communications.html?tab=todo', label: 'Open to-dos' },
      { href: '/communications.html?tab=docs', label: 'Documents' },
      { href: '/communications.html?tab=calls', label: 'Call log' },
    ],
    setup: [
      { href: '/communications.html?tab=groups', label: 'Groups' },
      { href: '/communications.html?tab=settings', label: 'To Do prefix' },
      { href: '/settings.html?tab=system', label: 'Meet code' },
    ],
  },
  woo: {
    label: 'WooCommerce',
    home: '/woocommerce.html',
    reports: [
      { href: '/woocommerce.html?tab=log', label: 'Sync log' },
    ],
    setup: [
      { href: '/woocommerce.html?tab=api', label: 'API settings' },
    ],
  },
  callcentre: {
    label: 'Call Centre',
    home: '/call-centre.html',
    reports: [
      { href: '/call-centre.html?pane=missed', label: 'Missed / callback' },
      { href: '/reports.html?t=col-diary', label: 'Call diary' },
    ],
    setup: [
      { href: '/call-centre.html?pane=queues', label: 'Queues' },
      { href: '/call-centre.html?pane=agents', label: 'Agents' },
    ],
  },
  dashboard: {
    label: 'Custom Dashboards',
    home: '/custom-dashboards.html',
    reports: [
      { href: '/custom-dashboards.html', label: 'Dashboards' },
    ],
    setup: [
      { href: '/custom-dashboards.html?tab=create', label: 'Create dashboard' },
    ],
  },
  ai: {
    label: 'AI Assistance',
    home: '/ai-assistance.html',
    reports: [
      { href: '/ai-assistance.html?tab=history', label: 'History' },
    ],
    setup: [
      { href: '/ai-assistance.html', label: 'Assistant' },
    ],
  },
  sheet: {
    label: 'Spreadsheet',
    home: '/spreadsheet.html',
    reports: [
      { href: '/spreadsheet.html?tab=sheets', label: 'Sheets' },
    ],
    setup: [
      { href: '/spreadsheet.html', label: 'Workbook' },
    ],
  },
  mfg: {
    label: 'Manufacturing',
    home: '/manufacturing.html',
    reports: [
      { href: '/report-stock.html', label: 'Component stock' },
    ],
    setup: [
      { href: '/manufacturing.html', label: 'Recipes' },
    ],
  },
  qr: {
    label: 'Catalogue QR',
    home: '/catalogue-qr.html',
    reports: [{ href: '/catalogue-qr.html', label: 'QR catalogue' }],
    setup: [{ href: '/catalogue-qr.html', label: 'QR setup' }],
  },
  academy: {
    label: 'Academy',
    home: '/academy.html',
    reports: [
      { href: '/academy.html?tab=manuals', label: 'User manuals' },
      { href: '/academy.html?tab=kb', label: 'Knowledge base' },
    ],
    setup: [
      { href: '/academy.html?tab=policies', label: 'Policies' },
    ],
  },
  connector: {
    label: 'Connector',
    home: '/connector.html',
    reports: [{ href: '/connector.html', label: 'Connector log' }],
    setup: [{ href: '/connector.html', label: 'Connector setup' }],
  },
};

const PATH_MOD = [
  [/academy/, 'academy'],
  [/accounting/, 'accounting'],
  [/wms/, 'wms'],
  [/field-ops/, 'fieldops'],
  [/crm/, 'crm'],
  [/hrm/, 'hrm'],
  [/assets/, 'assets'],
  [/repair/, 'repair'],
  [/project/, 'project'],
  [/communications|essentials|messages|announcements|calls\.html|meetings|comm-groups/, 'communications'],
  [/woocommerce/, 'woo'],
  [/call-centre/, 'callcentre'],
  [/custom-dashboard/, 'dashboard'],
  [/ai-assistance/, 'ai'],
  [/spreadsheet/, 'sheet'],
  [/manufacturing/, 'mfg'],
  [/catalogue-qr/, 'qr'],
  [/connector/, 'connector'],
];

export function moduleKeyFromPath(path) {
  const q = new URLSearchParams(location.search).get('m');
  if (q && MODULE_BOOKS[q]) return q;
  const p = String(path || location.pathname || '');
  const hit = PATH_MOD.find(([re]) => re.test(p));
  return hit ? hit[1] : '';
}

export function bookNav(mod, page) {
  const m = MODULE_BOOKS[mod];
  if (!m) return '';
  return `<nav class="mod-book" aria-label="Module books">
    <a class="mod-book-a" href="${m.home}">Summary</a>
    <span class="mod-book-div">·</span>
    <a class="mod-book-a ${page === 'report' ? 'on' : ''}" href="/color-report.html?m=${encodeURIComponent(mod)}">Reports</a>
    <span class="mod-book-div">·</span>
    <a class="mod-book-a ${page === 'setup' ? 'on' : ''}" href="/color-setup.html?m=${encodeURIComponent(mod)}">Setup</a>
  </nav>`;
}

export function mountModuleBooks() {
  /* Floor headings (Summary → topics → Reports → Setup) replaced the extra Report || Setup bar. */
}
