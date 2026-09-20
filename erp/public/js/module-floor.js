/**
 * Color-coded module floor: Summary → other headings → Reports → Setup.
 * Child screens stay on the same hubs; they are not left-nav items.
 * Module reports do not appear under ERP Reports.
 */
import { MODULE_BOOKS } from './module-books.js';

const T = (key, label, extra = {}) => ({ key, label, ...extra });

/** Named floors. Default is Summary / Topics / Reports / Setup. */
export const MODULE_FLOORS = {
  accounting: {
    mod: 'accounting',
    file: '/accounting.html',
    brandKey: 'dash',
    brand: 'Accounting',
    tabs: [
      T('dash', 'Summary'),
      T('coa', 'Chart of accounts', { href: '/accounting-coa.html' }),
      T('books', 'Books'),
      T('planning', 'Planning'),
      T('reports', 'Reports'),
      T('setup', 'Setup'),
    ],
    groups: {
      books: [
        T('je', 'Journal Entry', { href: '/accounting-journal.html' }),
        T('xfer', 'Transfer', { href: '/accounting-transfer.html' }),
        T('tx', 'Transactions', { href: '/accounting-transactions.html' }),
        T('ledger', 'Ledger', { href: '/accounting-ledger.html' }),
        T('recon', 'Reconciliation', { href: '/accounting-reconciliation.html' }),
      ],
      planning: [
        T('budget', 'Budget', { href: '/accounting-budget.html' }),
      ],
    },
    aliases: {
      summary: 'dash', nest: 'dash', 'nest-books': 'books', 'nest-plan': 'planning',
    },
    under: { je: 'books', xfer: 'books', tx: 'books', ledger: 'books', recon: 'books', budget: 'planning', settings: 'setup' },
  },
  communications: {
    mod: 'communications',
    file: '/communications.html',
    brandKey: 'floor',
    brand: 'Communications',
    tabs: [
      T('floor', 'Summary'),
      T('talk', 'Talk'),
      T('groups', 'Groups'),
      T('work', 'Work'),
      T('reports', 'Reports'),
      T('setup', 'Setup'),
    ],
    groups: {
      talk: [
        T('announce', 'Announcements'),
        T('msg', 'Messages'),
        T('calls', 'Calls'),
        T('meet', 'Meetings'),
      ],
      work: [
        T('todo', 'To Do'),
        T('docs', 'Documents'),
        T('memos', 'Memos'),
        T('remind', 'Reminders'),
      ],
    },
    aliases: {
      summary: 'floor', 'nest-talk': 'talk', 'nest-work': 'work',
      settings: 'setup', setting: 'setup',
    },
    under: {
      announce: 'talk', msg: 'talk', calls: 'talk', meet: 'talk',
      todo: 'work', docs: 'work', memos: 'work', remind: 'work',
    },
  },
  academy: {
    mod: 'academy', file: '/academy.html', brandKey: 'home', brand: 'Academy',
    tabs: [T('home', 'Summary'), T('topics', 'Topics'), T('reports', 'Reports'), T('setup', 'Setup')],
    groups: {
      topics: [
        T('manuals', 'User Manual'),
        T('kb', 'Knowledge Base'),
        T('policies', 'Policies'),
      ],
    },
    aliases: { summary: 'home', settings: 'setup', setting: 'setup' },
    under: { manuals: 'topics', kb: 'topics', policies: 'topics' },
  },
  ai: {
    mod: 'ai', file: '/ai-assistance.html', brandKey: 'home', brand: 'AI Assistance',
    tabs: [T('home', 'Summary'), T('topics', 'Topics'), T('reports', 'Reports'), T('setup', 'Setup')],
    groups: { topics: [T('history', 'History')] },
    aliases: { summary: 'home', settings: 'setup', setting: 'setup' },
    under: { history: 'topics' },
  },
  assets: {
    mod: 'assets', file: '/assets.html', brandKey: 'dash', brand: 'Asset Management',
    tabs: [T('dash', 'Summary'), T('topics', 'Topics'), T('reports', 'Reports'), T('setup', 'Setup')],
    groups: {
      topics: [
        T('allocated', 'Asset allocated'),
        T('revoked', 'Asset revoked'),
        T('maint', 'Asset maintenance'),
      ],
    },
    aliases: { summary: 'dash', 'nest-alloc': 'topics', settings: 'setup', setting: 'setup' },
    under: { allocated: 'topics', revoked: 'topics', maint: 'topics', cats: 'setup' },
  },
  callcentre: {
    mod: 'callcentre', file: '/call-centre.html', brandKey: 'inbox', brand: 'Call Centre',
    tabs: [
      T('inbox', 'Summary', { href: '/call-centre.html' }),
      T('topics', 'Topics'),
      T('reports', 'Reports'),
      T('setup', 'Setup'),
    ],
    groups: {
      topics: [
        T('missed', 'Missed / callback', { href: '/call-centre.html?pane=missed' }),
        T('campaigns', 'Campaigns', { href: '/call-centre.html?pane=campaigns' }),
        T('complaints', 'Complaints', { href: '/call-centre.html?pane=complaints' }),
        T('field', 'Field handoff', { href: '/call-centre.html?pane=field' }),
        T('hp', 'HP promotions', { href: '/call-centre.html?pane=hp' }),
      ],
    },
    aliases: { summary: 'inbox', settings: 'setup', setting: 'setup' },
    under: {
      missed: 'topics', campaigns: 'topics', complaints: 'topics',
      field: 'topics', hp: 'topics', queues: 'setup', agents: 'setup',
    },
  },
  crm: {
    mod: 'crm', file: '/crm.html', brandKey: 'dash', brand: 'CRM',
    tabs: [T('dash', 'Summary'), T('topics', 'Topics'), T('reports', 'Reports'), T('setup', 'Setup')],
    groups: {
      topics: [
        T('followups', 'Follow ups'),
        T('leads', 'Leads'),
        T('campaigns', 'Campaigns'),
        T('login', 'Contacts Login'),
        T('ptpl', 'Proposal template'),
        T('proposals', 'Proposals'),
      ],
    },
    aliases: {
      summary: 'dash', 'nest-follow': 'topics', 'nest-contacts': 'topics', 'nest-proposals': 'topics',
      settings: 'setup', setting: 'setup',
    },
    under: {
      followups: 'topics', leads: 'topics', campaigns: 'topics', login: 'topics',
      ptpl: 'topics', proposals: 'topics', sources: 'setup', life: 'setup', fcat: 'setup',
    },
  },
  dashboard: {
    mod: 'dashboard', file: '/custom-dashboards.html', brandKey: 'list', brand: 'Custom Dashboards',
    tabs: [T('list', 'Summary'), T('topics', 'Topics'), T('reports', 'Reports'), T('setup', 'Setup')],
    groups: { topics: [T('create', 'Create')] },
    aliases: { summary: 'list', manage: 'list', settings: 'setup', setting: 'setup' },
    under: { create: 'topics' },
  },
  fieldops: {
    mod: 'fieldops', file: '/field-ops.html', brandKey: 'floor', brand: 'Field Ops',
    tabs: [T('floor', 'Summary'), T('topics', 'Topics'), T('reports', 'Reports'), T('setup', 'Setup')],
    groups: {
      topics: [
        T('orders', 'Order List'),
        T('payments', 'Payment Record'),
        T('master', 'HP Book'),
        T('books', 'Workbooks'),
        T('visits', 'Visits'),
        T('collect', 'Collections'),
      ],
    },
    aliases: { summary: 'floor', 'nest-people': 'topics', 'nest-work': 'topics', settings: 'setup', setting: 'setup' },
    under: {
      orders: 'topics', payments: 'topics', master: 'topics', books: 'topics',
      visits: 'topics', collect: 'topics', stock: 'topics',
      agents: 'setup', join: 'setup', sync: 'setup',
    },
  },
  hrm: {
    mod: 'hrm', file: '/hrm.html', brandKey: 'dash', brand: 'HRM',
    tabs: [T('dash', 'Summary'), T('topics', 'Topics'), T('reports', 'Reports'), T('setup', 'Setup')],
    groups: {
      topics: [
        T('people', 'People'),
        T('leave', 'Leave'),
        T('att', 'Attendance'),
        T('payroll', 'Payroll'),
        T('bankpay', 'Bank Salary'),
        T('induction', 'Staff induction'),
        T('targets', 'Sales Targets'),
      ],
    },
    aliases: {
      summary: 'dash', 'nest-leave': 'topics', 'nest-time': 'topics', 'nest-org': 'topics',
      settings: 'setup', setting: 'setup',
    },
    under: {
      people: 'topics', leave: 'topics', att: 'topics', payroll: 'topics',
      bankpay: 'topics', induction: 'topics', targets: 'topics', holiday: 'topics',
      types: 'setup', dept: 'setup', desig: 'setup',
    },
  },
  mfg: {
    mod: 'mfg', file: '/manufacturing.html', brandKey: 'home', brand: 'Manufacturing',
    tabs: [T('home', 'Summary'), T('reports', 'Reports', { href: '/color-report.html?m=mfg' }), T('setup', 'Setup', { href: '/color-setup.html?m=mfg' })],
    groups: {},
    aliases: { summary: 'home', settings: 'setup' },
  },
  project: {
    mod: 'project', file: '/projects.html', brandKey: 'list', brand: 'Project',
    tabs: [T('list', 'Summary'), T('topics', 'Topics'), T('reports', 'Reports'), T('setup', 'Setup')],
    groups: { topics: [T('tasks', 'My Tasks')] },
    aliases: { summary: 'list', 'nest-work': 'topics', 'nest-setup': 'setup', settings: 'setup', setting: 'setup' },
    under: { tasks: 'topics', cats: 'setup' },
  },
  repair: {
    mod: 'repair', file: '/repair.html', brandKey: 'dash', brand: 'Repair',
    tabs: [T('dash', 'Summary'), T('topics', 'Topics'), T('reports', 'Reports'), T('setup', 'Setup')],
    groups: {
      topics: [
        T('jobs', 'Job Sheets'),
        T('add', 'Add job sheet'),
        T('inv', 'List Invoices'),
        T('addinv', 'Add Invoice'),
      ],
    },
    aliases: { summary: 'dash', settings: 'setup', setting: 'setup' },
    under: { jobs: 'topics', add: 'topics', inv: 'topics', addinv: 'topics', brands: 'setup' },
  },
  sheet: {
    mod: 'sheet', file: '/spreadsheet.html', brandKey: 'tree', brand: 'Spreadsheet',
    tabs: [T('tree', 'Summary'), T('topics', 'Topics'), T('reports', 'Reports'), T('setup', 'Setup')],
    groups: {
      topics: [
        T('sheets', 'Sheets'),
        T('s-hp-orders', 'BNPL Field Ops', { href: '/spreadsheet.html?sheet=s-hp-orders' }),
      ],
    },
    aliases: { summary: 'tree', settings: 'setup', setting: 'setup' },
    under: { sheets: 'topics', edit: 'topics', 's-hp-orders': 'topics' },
  },
  wms: {
    mod: 'wms', file: '/wms.html', brandKey: 'floor', brand: 'WMS',
    tabs: [T('floor', 'Summary'), T('topics', 'Topics'), T('reports', 'Reports'), T('setup', 'Setup')],
    groups: {
      topics: [
        T('recv', 'Receiving'),
        T('putaway', 'Put Away'),
        T('pick', 'Picking'),
        T('pack', 'Packing'),
        T('dispatch', 'Dispatch'),
        T('stock', 'Stock'),
        T('xfer', 'Transfers'),
        T('adj', 'Adjustments'),
        T('count', 'Count'),
        T('bank', 'Bank Activity'),
      ],
    },
    aliases: {
      summary: 'floor', 'nest-in': 'topics', 'nest-out': 'topics', 'nest-stock': 'topics',
      settings: 'setup', setting: 'setup',
    },
    under: {
      recv: 'topics', putaway: 'topics', pick: 'topics', pack: 'topics', dispatch: 'topics',
      stock: 'topics', xfer: 'topics', adj: 'topics', count: 'topics', bank: 'topics',
      scan: 'setup',
    },
  },
  woo: {
    mod: 'woo', file: '/woocommerce.html', brandKey: 'sync', brand: 'WooCommerce',
    tabs: [T('sync', 'Summary'), T('topics', 'Topics'), T('reports', 'Reports'), T('setup', 'Setup')],
    groups: { topics: [T('log', 'Sync Log')] },
    aliases: { summary: 'sync', settings: 'setup', setting: 'setup' },
    under: { log: 'topics', api: 'setup' },
  },
  qr: {
    mod: 'qr', file: '/catalogue-qr.html', brandKey: 'home', brand: 'Catalogue QR',
    tabs: [T('home', 'Summary'), T('reports', 'Reports', { href: '/color-report.html?m=qr' }), T('setup', 'Setup', { href: '/color-setup.html?m=qr' })],
    groups: {},
    aliases: { summary: 'home', settings: 'setup' },
  },
  connector: {
    mod: 'connector', file: '/connector.html', brandKey: 'home', brand: 'Connector',
    tabs: [T('home', 'Summary'), T('reports', 'Reports', { href: '/color-report.html?m=connector' }), T('setup', 'Setup', { href: '/color-setup.html?m=connector' })],
    groups: {},
    aliases: { summary: 'home', settings: 'setup' },
  },
};

const FILE_TO_MOD = Object.fromEntries(
  Object.values(MODULE_FLOORS).map((f) => [f.file, f.mod]),
);

export function floorModFromPath(path) {
  const q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '').get('m');
  if (q && MODULE_FLOORS[q]) return q;
  const file = '/' + String(path || (typeof location !== 'undefined' ? location.pathname : '')).split('/').pop();
  if (FILE_TO_MOD[file]) return FILE_TO_MOD[file];
  if (/accounting/.test(file)) return 'accounting';
  if (/communications|essentials|messages|announcements|meetings|comm-groups/.test(file)) return 'communications';
  if (/custom-dashboard/.test(file)) return 'dashboard';
  if (/call-centre/.test(file)) return 'callcentre';
  if (/field-ops/.test(file)) return 'fieldops';
  if (/ai-assistance/.test(file)) return 'ai';
  if (/catalogue-qr/.test(file)) return 'qr';
  if (/woocommerce/.test(file)) return 'woo';
  if (/spreadsheet/.test(file)) return 'sheet';
  if (/manufacturing/.test(file)) return 'mfg';
  if (/projects/.test(file)) return 'project';
  const hit = Object.keys(MODULE_FLOORS).find((k) => file.includes(k));
  return hit || '';
}

export function floorFor(path) {
  const mod = floorModFromPath(path);
  return (mod && MODULE_FLOORS[mod]) || null;
}

function childToHeading(floor, key) {
  if (!floor || !key) return floor?.brandKey || '';
  if ((floor.tabs || []).some((t) => t.key === key)) return key;
  if (floor.under?.[key]) return floor.under[key];
  for (const [gk, kids] of Object.entries(floor.groups || {})) {
    if ((kids || []).some((c) => c.key === key)) return gk;
  }
  return key;
}

export function resolveFloorOn(path, raw) {
  const floor = floorFor(path);
  if (!floor) return raw || '';
  const v = String(raw || '').trim();
  if (!v) return floor.brandKey;
  const mapped = floor.aliases?.[v] || v;
  if ((floor.tabs || []).some((t) => t.key === mapped)) return mapped;
  if (floor.groups?.[mapped]) return mapped;
  if (childToHeading(floor, mapped) !== mapped) return mapped;
  return mapped;
}

/** Heading key to highlight for the current screen (child → parent). */
export function headingOf(path, raw) {
  const floor = floorFor(path);
  if (!floor) return raw || '';
  const on = resolveFloorOn(path, raw);
  return childToHeading(floor, on);
}

export function isFloorGroup(path, raw) {
  const floor = floorFor(path);
  const on = resolveFloorOn(path, raw);
  return !!(floor && floor.groups && floor.groups[on]);
}

export function isFloorBook(path, raw) {
  const on = resolveFloorOn(path, raw);
  return on === 'reports' || on === 'setup';
}

export function floorPages(mod) {
  const floor = MODULE_FLOORS[mod];
  if (!floor) return [];
  return (floor.tabs || []).map((t) => ({
    href: t.href || (t.key === floor.brandKey ? floor.file : `${floor.file}?tab=${encodeURIComponent(t.key)}`),
    label: t.label,
  }));
}

export function floorLeaves(mod) {
  const floor = MODULE_FLOORS[mod];
  if (!floor) return [];
  const out = [];
  Object.values(floor.groups || {}).forEach((kids) => {
    (kids || []).forEach((c) => {
      out.push({
        href: c.href || `${floor.file}?tab=${encodeURIComponent(c.key)}`,
        label: c.label,
      });
    });
  });
  return out;
}

export function groupCards(floor, groupKey) {
  const kids = floor?.groups?.[groupKey] || [];
  return kids.map((c) => ({
    key: c.key,
    label: c.label,
    href: c.href || (c.key === floor.brandKey ? floor.file : `${floor.file}?tab=${encodeURIComponent(c.key)}`),
  }));
}

export function bookItems(mod, which) {
  const book = MODULE_BOOKS[mod] || MODULE_BOOKS[floorFor(mod)?.mod] || {};
  return which === 'setup' ? (book.setup || []) : (book.reports || []);
}
