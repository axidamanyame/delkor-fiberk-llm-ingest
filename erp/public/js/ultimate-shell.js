/**
 * Delkor-Fiberk ERP–style shell: blue top bar + light expandable sidebar + theme toggle
 * Multi-subsidiary: Delkor-Fiberk group
 */
import {
  supabase,
  requireAuth,
  rememberLastPath,
  clearLocalAuth,
  SUBSIDIARIES,
  OPERATING_SUBSIDIARIES,
  getActiveSubsidiary,
  loadActiveSubsidiary,
  saveActiveSubsidiary,
} from './supabaseClient.js';

export { SUBSIDIARIES, OPERATING_SUBSIDIARIES };
import * as scope from './scope.js';
import { loadMyProfile, filterLocations, subsidiariesFor, isHqRole, isOwnerRole, isGroupOperatorRole, tillLocations } from './access-rules.js';
import { goToRegister, loadTillPin, leaveTillOrStay, installTillExitGuard } from './pos-gate.js';
import { loadAccess, filterNav, enforcePageAccess, can, canOpenPage, applyDomPermissions, installActionGuard, resetAccess, isFrontlineStaff, getAccess, isTillCashier } from './rbac.js';
import { observeLiveSearch } from './live-search.js';
import { showPendingAck } from './confirm-action.js';
import { destinationForSession, hydrateUser, isGated, findUser } from './access-gate.js';
import { listNotices, unreadCount, markNoticeRead, pullNotices, markAllRead, clearNotices } from './inbox.js';
import { bindOverflowTabs } from './hub-kit.js';
import { bindViewEditAudit, ensureDeleteKey } from './delete-guard.js';
import { iconHtml } from './nav-icons.js';
import { installFormFill } from './form-fill.js';
import { watchActionColumns } from './table-actions.js';
import { installDeskNavGuard, installDeskBack, injectDeskChromeCss, deskJumpBar, pushDeskBack, syncJumpBar } from './desk-chrome.js';
import { bindRecordViews } from './record-view.js';
import { registerClickGuard, PRIORITY, listClickGuards } from './click-router.js';
import { applyToMenu } from './menu-perms.js';
import { installArchiveReadonly } from './archive-readonly.js';
import { applyChrome, chevronMark } from './chevron.js';
import './data-scope.js';

/** Stale SPA listeners (Users, Finance, …) must not paint over the page you just opened. */
(function installPageOwnerGuard() {
  if (typeof window === 'undefined' || window.__dfPageOwnerGuard) return;
  window.__dfPageOwnerGuard = true;
  const OWNED = new Set(['df-tab', 'df-scope-change']);
  const orig = window.addEventListener.bind(window);
  window.addEventListener = function (type, fn, opts) {
    if (!OWNED.has(type) || typeof fn !== 'function') return orig(type, fn, opts);
    const owner = (location.pathname.split('/').pop() || '').toLowerCase();
    const wrapped = function (e) {
      const here = (location.pathname.split('/').pop() || '').toLowerCase();
      if (owner && here && owner !== here) return;
      return fn.call(this, e);
    };
    return orig(type, wrapped, opts);
  };
}());
import './form-mode.js';

const BUSINESS_LOCATIONS = scope.BUSINESS_LOCATIONS || [];
const VIRTUAL_WH = scope.OPS_HUB || scope.VIRTUAL_WH || { code: 'OPS-HUB', name: 'Operations Hub' };
const locationsFor = scope.locationsFor || ((sub) =>
  BUSINESS_LOCATIONS.filter((l) => !sub || sub === 'group' || l.subsidiary === sub));
const getActiveLocation = scope.getActiveLocation || (() => {
  try { return sessionStorage.getItem('df_active_location') || ''; } catch { return ''; }
});
const saveActiveLocation = scope.saveActiveLocation || ((code) => {
  try {
    if (code) sessionStorage.setItem('df_active_location', code);
    else sessionStorage.removeItem('df_active_location');
  } catch { /* ignore */ }
});
const isVirtualWh = scope.isHubWarehouse || scope.isVirtualWh || ((c) => /OPS-HUB|VW-GROUP|GRP-HQ/i.test(String(c || '')));
const watchScopeSelects = scope.watchScopeSelects || (() => {});

function ensureMobileMeta() {
  let vp = document.querySelector('meta[name="viewport"]');
  if (!vp) {
    vp = document.createElement('meta');
    vp.setAttribute('name', 'viewport');
    document.head.appendChild(vp);
  }
  vp.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');
  const add = (name, content) => {
    if (document.querySelector(`meta[name="${name}"]`)) return;
    const m = document.createElement('meta');
    m.setAttribute('name', name);
    m.setAttribute('content', content);
    document.head.appendChild(m);
  };
  add('apple-mobile-web-app-capable', 'yes');
  add('apple-mobile-web-app-status-bar-style', 'black-translucent');
  add('mobile-web-app-capable', 'yes');
  add('theme-color', '#1e3a8a');
  const icon = (rel, href, type) => {
    if (document.querySelector(`link[rel="${rel}"][href="${href}"]`)) return;
    const l = document.createElement('link');
    l.rel = rel;
    l.href = href;
    if (type) l.type = type;
    document.head.appendChild(l);
  };
  icon('icon', '/favicon.svg', 'image/svg+xml');
  icon('shortcut icon', '/favicon.ico');
  /* apple-touch-icon removed: /__grok/icon-180.png does not exist in public/ and 404s
     on every page load. Restore this line once a real 180x180 PNG is committed. */
  /* manual-ref.css used to be injected here on every page. It is a
     documentation stylesheet — it is now linked from manual.html and
     manual-fiberkapp.html only. */
  document.documentElement.classList.add('ult-touch');
  markPhoneChrome();
}

export const PHONE_QUERY = '(max-width: 820px)';

/**
 * Phone chrome follows the same breakpoint as the CSS. It used to also
 * consult screen.width (the monitor, not the window) and treat any
 * coarse pointer under 1200px as a phone, which gave touch-screen
 * laptops phone chrome at desk width.
 */
export function isPhoneLayout() {
  try {
    if (window.matchMedia(PHONE_QUERY).matches) return true;
    return /iPhone|iPod|Android.*Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
  } catch {
    return false;
  }
}

export function markPhoneChrome() {
  const on = isPhoneLayout();
  document.documentElement.classList.toggle('ult-phone', on);
  document.body?.classList.toggle('ult-phone', on);
  return on;
}

if (typeof window !== 'undefined') {
  /* Fires when the breakpoint is actually crossed, not on every frame of a drag. */
  try {
    const mq = window.matchMedia(PHONE_QUERY);
    const onChange = () => { try { markPhoneChrome(); } catch { /* ignore */ } };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  } catch { /* ignore */ }
}

export const MIGRATED_NAV = [];

/** Hex colors from Ultimate screenshot — used even if SQL is not run */
export const MODULE_COLORS = {
  accounting: { color: '#D483D9', textColor: '#ffffff' },
  ai:         { color: '#6EA194', textColor: '#0f172a' },
  momo:       { color: '#facc15', textColor: '#0f172a' },
  banking:    { color: '#0891b2', textColor: '#ffffff' },
  crypto:     { color: '#fde047', textColor: '#0f172a' },
  gra:        { color: '#b45309', textColor: '#ffffff' },
  crm:        { color: '#8CAFD4', textColor: '#0f172a' },
  project:    { color: '#e4186d', textColor: '#ffffff' },
  assets:     { color: '#2e97bf', textColor: '#ffffff' },
  hrm:        { color: '#605ca8', textColor: '#ffffff' },
  essentials: { color: '#001f3f', textColor: '#ffffff' },
  communications: { color: '#001f3f', textColor: '#ffffff' },
  cheque:     { color: '#facc15', textColor: '#0f172a' },
  woo:        { color: '#9E458B', textColor: '#ffffff' },
  connector:  { color: '#2dce89', textColor: '#ffffff' },
  sheet:      { color: '#0086f9', textColor: '#ffffff' },
  qr:         { color: '#ff851b', textColor: '#ffffff' },
  mfg:        { color: '#ff851b', textColor: '#ffffff' },
  repair:     { color: '#bc8f8f', textColor: '#ffffff' },
  fieldops:   { color: '#c2410c', textColor: '#ffffff' },
  dashboard:  { color: '#4f46e5', textColor: '#ffffff' },
  wms:        { color: '#0f766e', textColor: '#ffffff' },
  callcentre: { color: '#9f1239', textColor: '#ffffff' },
  academy:    { color: '#7c3aed', textColor: '#ffffff' },
};

/** Menu — colored bars match Ultimate screenshot. Works without DB. */
export const MENU = [
  { href: '/dashboard.html', label: 'Home', icon: 'home' },
  {
    label: 'Records', icon: 'records',
    children: [
      {
        label: 'Contacts',
        children: [
          { href: '/suppliers.html', label: 'Suppliers' },
          { href: '/supplier-groups.html', label: 'Supplier Groups' },
          { href: '/customers.html', label: 'Customers' },
          { href: '/customer-groups.html', label: 'Customer Groups' },
          { href: '/client-groups.html', label: 'Client Groups' },
          { href: '/investors.html', label: 'Investors' },
          { href: '/partners.html', label: 'Partners' },
          { href: '/consultants.html', label: 'Consultants' },
          { href: '/loyalty-cards.html', label: 'Loyalty Cards' },
          /* nav-spec.js listed these two under Contacts, but the live menu is
             this MENU array, so they never appeared. Both importers are real
             pages now (they used to be redirect stubs). */
          { href: '/import-contacts.html', label: 'Import Contacts' },
          { href: '/import-contacts.html?contact_type=supplier', label: 'Import Suppliers' },
        ],
      },
      {
        label: 'Products',
        children: [
          { href: '/product-catalog.html', label: 'Product Catalog' },
          { href: '/products.html?view=inventory', label: 'Product Inventory' },
          { href: '/products.html', label: 'List Products' },
          { href: '/product-form.html', label: 'Add Product' },
          { href: '/update-price.html', label: 'Update Price' },
          { href: '/print-labels.html', label: 'Print Labels' },
          { href: '/variations.html', label: 'Variations' },
          { href: '/price-groups.html', label: 'Selling Price Group' },
          { href: '/units.html', label: 'Units' },
          { href: '/categories.html', label: 'Categories' },
          { href: '/brands.html', label: 'Brands' },
          { href: '/warranties.html', label: 'Warranties', perm: 'warranty.view|product.view' },
          { href: '/media-sync.html', label: 'Media Sync' },
          { href: '/franko-sync.html', label: 'Franko photos' },
          { href: '/missing-images.html', label: 'Missing images' },
          { href: '/import-products.html', label: 'Import Products' },
        ],
      },
    ],
  },
  {
    label: 'Purchases', icon: 'cart',
    children: [
      { href: '/purchase-orders.html', label: 'List Purchases' },
      { href: '/purchase-catchup.html', label: 'Purchases catch-up' },
      { href: '/purchase-form.html', label: 'Add Purchase' },
      { href: '/purchase-returns.html', label: 'List Purchase Return' },
      { href: '/purchase-return-form.html', label: 'Add Purchase Return' },
      { href: '/purchase-invoices.html', label: 'Purchase Invoices' },
      { href: '/purchase-invoice-form.html', label: 'Add Purchase Invoice' },
      { href: '/paper-purchase.html', label: 'Paper invoices' },
    ],
  },
  {
    label: 'Operations', icon: 'hub', perm: 'ops.access',
    children: [
      { href: '/virtual-warehouse.html', label: 'Hub board', perm: 'ops.hub|ops.access' },
      { href: '/receive-stock.html', label: 'Receive Stock', perm: 'ops.receive|ops.access' },
      { href: '/put-away.html', label: 'Put Away', perm: 'ops.putaway|ops.access' },
      {
        label: 'Stock Transfers',
        children: [
          { href: '/stock-transfers.html', label: 'List Transfers' },
          { href: '/stock-transfer-form.html', label: 'Add Transfer' },
        ],
      },
      {
        label: 'Stock Adjustment',
        children: [
          { href: '/stock-adjustments.html', label: 'List Stock Adjustments' },
          { href: '/stock-adjustment-form.html', label: 'Add Stock Adjustment' },
        ],
      },
      { href: '/stock-count.html', label: 'Stock Count / Audit', perm: 'ops.count|ops.access' },
      /* Both were unreachable from the menu: opening-stock.html and
         import-stock.html existed but nothing linked to them. */
      { href: '/opening-stock.html', label: 'Opening Stock', perm: 'ops.opening|ops.access' },
      { href: '/import-stock.html', label: 'Import Opening Stock', perm: 'ops.opening|ops.access' },
      { href: '/product-stock-history.html', label: 'Stock History', perm: 'ops.access|product.view' },
    ],
  },
  {
    label: 'Sales', icon: 'bag',
    children: [
      { href: '/sales-orders.html', label: 'All sales' },
      { href: '/sales-form.html', label: 'Add Sale' },
      {
        label: 'POS',
        children: [
          { href: '/pos-sales.html', label: 'List POS Sales' },
          { href: '/pos-sessions.html', label: 'Opened Registers' },
          { href: '/till-alerts.html', label: 'Till discrepancies', perm: 'cash_register.view|cash_register.close' },
        ],
      },
      {
        label: 'Drafts',
        children: [
          { href: '/draft-form.html', label: 'Add Draft' },
          { href: '/drafts.html', label: 'List Drafts' },
        ],
      },
      {
        label: 'Quotations',
        children: [
          { href: '/quotation-form.html', label: 'Add Quotation' },
          { href: '/quotations.html', label: 'List Quotations' },
        ],
      },
      {
        label: 'Sell Returns',
        children: [
          { href: '/sell-returns.html', label: 'List Sell Return' },
        ],
      },
      { href: '/shipments.html', label: 'Shipments' },
      { href: '/import-sales.html', label: 'Import Sales' },
      { href: '/discounts.html', label: 'Discounts' },
    ],
  },
  {
    label: 'Finance', icon: 'bank', perm: 'finance.access|account.access|account.view',
    children: [
      { href: '/finance.html', label: 'Finance hub', perm: 'finance.hub|finance.access|account.access' },
      {
        label: 'Treasury & Cash', perm: 'finance.treasury|finance.access|account.banking|account.access',
        children: [
          { href: '/finance.html?tab=treasury', label: 'Cash position', perm: 'finance.cash_position|finance.treasury|finance.access' },
          { href: '/payment-accounts.html', label: 'Bank & wallets', perm: 'finance.wallets|finance.treasury|account.banking|account.access' },
          { href: '/banking.html', label: 'Banks', perm: 'finance.banks|finance.treasury|account.banking|account.access' },
          { href: '/uba-fiberk.html', label: 'UBA Fiberk', perm: 'finance.uba|finance.treasury|account.banking|account.access' },
          { href: '/accounting-transfer.html', label: 'Fund transfers', perm: 'finance.transfers|finance.treasury|accounting.transfer.view|account.access' },
        ],
      },
      {
        label: 'Budgeting', perm: 'finance.budgeting|finance.access|accounting.budget',
        children: [
          { href: '/finance.html?tab=budget', label: 'Budget vs actual', perm: 'finance.budget_vs_actual|finance.budgeting|finance.access' },
          { href: '/accounting-budget.html', label: 'Annual budget', perm: 'finance.annual_budget|finance.budgeting|accounting.budget' },
          { href: '/budgets.html', label: 'Department budgets', perm: 'finance.dept_budget|finance.budgeting|accounting.budget' },
        ],
      },
      { href: '/finance.html?tab=controls', label: 'Financial controls', perm: 'finance.controls|finance.access' },
      { href: '/finance.html?tab=capital', label: 'Capital management', perm: 'finance.capital|finance.access' },
      { href: '/finance.html?tab=vendors', label: 'Vendor payments', perm: 'finance.vendors|finance.access' },
      { href: '/finance.html?tab=revenue', label: 'Revenue & collections', perm: 'finance.revenue|finance.access' },
      { href: '/finance.html?tab=kpis', label: 'Finance KPIs', perm: 'finance.kpis|finance.access' },
      {
        label: 'Expenses', perm: 'expense.access_all|expense.view_own|expense.add|finance.access',
        children: [
          { href: '/expenses.html', label: 'List Expenses', perm: 'expense.access_all|expense.view_own|expense.add' },
          { href: '/expense-form.html', label: 'Add Expense', perm: 'expense.add' },
          { href: '/expense-categories.html', label: 'Expense Categories', perm: 'expense.access_all|expense.add' },
          { href: '/expense-import.html', label: 'Import Expenses', perm: 'expense.add' },
        ],
      },
    ],
  },
  {
    label: 'Collections', icon: '☎', perm: 'collections.access',
    children: [
      {
        label: 'Operations', perm: 'collections.operations|collections.access',
        children: [
          { href: '/collections-home.html', label: 'Dashboard', perm: 'collections.operations|collections.access' },
          { href: '/collections-floor.html', label: 'Floor', perm: 'collections.operations|collections.access' },
          { href: '/collections-desk.html?pane=diary', label: 'Call Diary', perm: 'collections.operations|collections.access' },
          { href: '/collections-calls.html', label: 'Call Logs', perm: 'collections.operations|collections.access' },
          { href: '/collections-desk.html?pane=ptp', label: 'Promise to Pay', perm: 'collections.operations|collections.access' },
          { href: '/collections-promises.html', label: 'Promises (Legacy)', perm: 'collections.operations|collections.access' },
          { href: '/collections-plans.html', label: 'Payment Plans', perm: 'collections.operations|collections.access' },
          { href: '/collections-desk.html?pane=regulars', label: 'Regular Payers', perm: 'collections.operations|collections.access' },
        ],
      },
      {
        label: 'Accounts & Analysis', perm: 'collections.accounts|collections.access',
        children: [
          { href: '/collections-desk.html', label: 'Accounts', perm: 'collections.accounts|collections.access' },
          { href: '/collections-aging.html', label: 'Aging', perm: 'collections.accounts|collections.access' },
          { href: '/collections-desk.html?pane=scores', label: 'Credit Grade', perm: 'collections.accounts|collections.access' },
          { href: '/collections-desk.html?pane=exceptions', label: 'Exceptions', perm: 'collections.accounts|collections.access' },
          { href: '/collections.html', label: 'Arrears Hub', perm: 'collections.accounts|collections.access' },
        ],
      },
      {
        label: 'Workflow & Escalation', perm: 'collections.workflow|collections.access',
        children: [
          { href: '/collections-escalations.html', label: 'Escalations', perm: 'collections.workflow|collections.access' },
          { href: '/collections-desk.html?pane=queues', label: 'Queues', perm: 'collections.workflow|collections.access' },
          { href: '/collections-publish.html', label: 'Publish Live Book', perm: 'collections.workflow|collections.access' },
        ],
      },
      {
        label: 'Strategy & Rules', perm: 'collections.strategy|collections.access',
        children: [
          { href: '/collections-desk.html?pane=rules', label: 'Allocation Rules', perm: 'collections.strategy|collections.access' },
          { href: '/collections-desk.html?pane=strategy', label: 'Contact Strategy', perm: 'collections.strategy|collections.access' },
          { href: '/collections-desk.html?pane=policies', label: 'Policies', perm: 'collections.strategy|collections.access' },
        ],
      },
    ],
  },
  {
    label: 'Reports', icon: 'chart',
    children: [
      { href: '/reports.html', label: 'All Reports' },
      {
        label: 'Purchase Reports',
        children: [
          { href: '/report-purchase-sell.html', label: 'Purchase & Sale' },
          { href: '/reports.html?t=pp', label: 'Product Purchase Report' },
          { href: '/reports.html?t=ppay', label: 'Purchase Payment Report' },
          { href: '/reports.html?t=psp', label: 'Purchase & Sale Product' },
        ],
      },
      {
        label: 'Inventory Reports',
        children: [
          { href: '/report-stock.html', label: 'Stock Report' },
          { href: '/reports.html?t=adj', label: 'Stock Adjustment Report' },
          { href: '/trending-products.html', label: 'Trending Products' },
          { href: '/reports.html?t=items', label: 'Items Report' },
        ],
      },
      {
        label: 'Sales Reports',
        children: [
          { href: '/report-register.html', label: 'POS Register Report' },
          { href: '/report-sales-rep.html', label: 'Sales Representative Report' },
          { href: '/reports.html?t=sell', label: 'Product Sell Report' },
          { href: '/reports.html?t=sell-group', label: 'Product Sell (Grouped)' },
          { href: '/sell-payments.html', label: 'Sell Payment Report' },
        ],
      },
      {
        label: 'Finance Reports',
        children: [
          { href: '/report-profit-loss.html', label: 'Profit / Loss Report' },
          { href: '/accounting-reports.html?r=tb', label: 'Trial Balance' },
          { href: '/accounting-reports.html?r=bs', label: 'Balance Sheet' },
          { href: '/accounting-reports.html?r=cf', label: 'Cash Flow' },
          { href: '/report-tax.html', label: 'Tax Report' },
          { href: '/reports.html?t=age', label: 'Payment by Age' },
          { href: '/report-expense.html', label: 'Expense Report' },
        ],
      },
      {
        label: 'Collections Reports',
        perm: 'report.collections|collections.access|crm.leads_all|crm.leads_own|bnpl.collections',
        children: [
          { href: '/reports.html?t=col-age', label: 'Ageing & queues', perm: 'report.collections|collections.access|crm.leads_all|crm.leads_own|bnpl.collections' },
          { href: '/reports.html?t=col-ptp', label: 'Promise to pay', perm: 'report.collections|collections.access|crm.leads_all|crm.leads_own|bnpl.collections' },
          { href: '/reports.html?t=col-diary', label: 'Call diary', perm: 'report.collections|collections.access|crm.leads_all|crm.leads_own|bnpl.collections' },
          { href: '/reports.html?t=col-reg', label: 'Regular payers', perm: 'report.collections|collections.access|crm.leads_all|crm.leads_own|bnpl.collections' },
          { href: '/reports.html?t=col-ex', label: 'Exceptions', perm: 'report.collections|collections.access|crm.leads_all|crm.leads_own|bnpl.collections' },
          { href: '/reports.html?t=col-pay', label: 'Hire purchase collections', perm: 'report.collections|collections.access|crm.leads_all|crm.leads_own|bnpl.collections' },
        ],
      },
      {
        label: 'System Reports',
        children: [
          { href: '/reports.html?t=activity', label: 'Activity Log' },
          { href: '/reports.html?t=z', label: 'Z Report' },
          { href: '/report-contacts.html', label: 'Customers & Suppliers' },
          { href: '/customer-groups-report.html', label: 'Customer Groups Report' },
        ],
      },
    ],
  },
  {
    label: 'System', icon: 'cog',
    children: [
      {
        label: 'Settings',
        children: [
          { href: '/manual.html', label: 'Technical documentation', hqOnly: true, perm: 'settings.business' },
          { href: '/settings.html', label: 'Business Settings' },
          { href: '/settings.html?tab=chevrons', label: 'Chevron styles' },
          { href: '/till-policy.html', label: 'Till & staff hours', hqOnly: true, perm: 'settings.business' },
          { href: '/accounting-settings.html', label: 'Accounting map', perm: 'settings.business' },
          { href: '/business-locations.html', label: 'Business Locations' },
          { href: '/invoice-schemes.html', label: 'Invoice Schemes' },
          { href: '/selling-price-groups.html', label: 'Location Price Groups' },
          { href: '/invoice-settings.html', label: 'Invoice Settings' },
          { href: '/barcode-settings.html', label: 'Barcode Settings' },
          { href: '/printers.html', label: 'Receipt Printers' },
          { href: '/tax-rates.html', label: 'Tax Rates' },
          { href: '/payment-settings.html', label: 'Payment Gateways' },
          { href: '/notifications.html', label: 'Notification Templates' },
          { href: '/sms-settings.html', label: 'SMS gateway' },
          { href: '/backup.html', label: 'Backup' },
        ],
      },
      {
        label: 'User Management',
        children: [
          { href: '/users.html', label: 'Users', perm: 'user.view' },
          { href: '/import-users.html', label: 'Import Users', perm: 'user.edit|user.view' },
          { href: '/roles.html', label: 'Roles', perm: 'role.view' },
          { href: '/commission-agents.html', label: 'Sales Commission Agents', perm: 'commission.view|user.view' },
          { href: '/audit-log.html', label: 'Audit log', perm: 'audit.view|user.view' },
          { href: '/notification-log.html', label: 'Notification log', perm: 'audit.view|user.view' },
          { href: '/audit-log.html?type=error_code', label: 'Error codes', perm: 'audit.error_codes|user.view' },
        ],
      },
    ],
  },
  // Color add-on modules — after core ERP, A–Z.
  // RULE: never a left chevron/child menu. Extra screens live as `pages`
  // (right-pane headings). Set ownTabs: true when the module already paints
  // its own right-pane tabs (Accounting, Repair, Spreadsheet, WooCommerce, Assets).
  // Phone rule: if those headings overflow one line they collapse to a dropdown
  // (hub-kit bindOverflowTabs) — same for every color-coded module.
  { label: 'Academy', icon: '📚', href: '/academy.html', ownTabs: true, perm: 'academy.access|menu.home|home.view', ...MODULE_COLORS.academy,
    pages: [
      { href: '/academy.html', label: 'Summary' },
      { href: '/academy.html?tab=topics', label: 'Topics' },
      { href: '/academy.html?tab=reports', label: 'Reports' },
      { href: '/academy.html?tab=setup', label: 'Setup' },
    ],
    leaves: [
      { href: '/academy.html?tab=manuals', label: 'User Manual' },
      { href: '/academy.html?tab=kb', label: 'Knowledge Base' },
      { href: '/academy.html?tab=policies', label: 'Policies' },
    ] },
  { label: 'AI Assistance', icon: '✦', href: '/ai-assistance.html', ownTabs: true, perm: 'ai.access', ...MODULE_COLORS.ai,
    pages: [
      { href: '/ai-assistance.html', label: 'Summary' },
      { href: '/ai-assistance.html?tab=topics', label: 'Topics' },
      { href: '/ai-assistance.html?tab=reports', label: 'Reports' },
      { href: '/ai-assistance.html?tab=setup', label: 'Setup' },
    ],
    leaves: [
      { href: '/ai-assistance.html?tab=history', label: 'History' },
    ] },
  { label: 'Accounting', icon: '📊', href: '/accounting.html', ownTabs: true, perm: 'accounting.access|account.access', ...MODULE_COLORS.accounting,
    pages: [
      { href: '/accounting.html', label: 'Summary' },
      { href: '/accounting-coa.html', label: 'Chart of accounts' },
      { href: '/accounting.html?tab=books', label: 'Books' },
      { href: '/accounting.html?tab=planning', label: 'Planning' },
      { href: '/accounting.html?tab=reports', label: 'Reports' },
      { href: '/accounting.html?tab=setup', label: 'Setup' },
    ],
    leaves: [
      { href: '/accounting-journal.html', label: 'Journal Entry' },
      { href: '/accounting-transfer.html', label: 'Transfer' },
      { href: '/accounting-transactions.html', label: 'Transactions' },
      { href: '/accounting-ledger.html', label: 'Ledger' },
      { href: '/accounting-reconciliation.html', label: 'Reconciliation' },
      { href: '/accounting-budget.html', label: 'Budget' },
    ] },
  { label: 'Asset Management', icon: '🏢', href: '/assets.html', ownTabs: true, perm: 'asset.view', ...MODULE_COLORS.assets,
    pages: [
      { href: '/assets.html', label: 'Summary' },
      { href: '/assets.html?tab=topics', label: 'Topics' },
      { href: '/assets.html?tab=reports', label: 'Reports' },
      { href: '/assets.html?tab=setup', label: 'Setup' },
    ],
    leaves: [
      { href: '/assets.html?tab=allocated', label: 'Asset allocated' },
      { href: '/assets.html?tab=revoked', label: 'Asset revoked' },
      { href: '/assets.html?tab=maint', label: 'Asset maintenance' },
      { href: '/assets.html?tab=cats', label: 'Asset categories' },
    ] },
  { label: 'Catalogue QR', icon: '▦', href: '/catalogue-qr.html', perm: 'qr.view', ...MODULE_COLORS.qr ,
    pages: [
      { href: '/catalogue-qr.html', label: 'Summary', perm: 'qr.view' },
      { href: '/color-report.html?m=qr', label: 'Reports', perm: 'qr.view' },
      { href: '/color-setup.html?m=qr', label: 'Setup', perm: 'qr.view' },
    ] },
  {
    label: 'Communications', icon: 'messages',
    perm: 'comm.access|essentials.todo_add|essentials.todo_edit|essentials.docs|essentials.memos|essentials.reminders',
    href: '/communications.html', ownTabs: true, ...MODULE_COLORS.communications,
    pages: [
      { href: '/communications.html', label: 'Summary' },
      { href: '/communications.html?tab=talk', label: 'Talk' },
      { href: '/communications.html?tab=groups', label: 'Groups', perm: 'comm.groups|comm.access' },
      { href: '/communications.html?tab=work', label: 'Work' },
      { href: '/communications.html?tab=reports', label: 'Reports' },
      { href: '/communications.html?tab=setup', label: 'Setup' },
    ],
    leaves: [
      { href: '/communications.html?tab=announce', label: 'Announcements', perm: 'comm.announcements|comm.access' },
      { href: '/communications.html?tab=msg', label: 'Messages', perm: 'comm.messages|comm.access' },
      { href: '/communications.html?tab=calls', label: 'Calls', perm: 'comm.calls|comm.access' },
      { href: '/communications.html?tab=meet', label: 'Meetings', perm: 'comm.meetings|comm.access' },
      { href: '/communications.html?tab=todo', label: 'To Do', perm: 'essentials.todo_add|essentials.todo_edit|comm.access' },
      { href: '/communications.html?tab=docs', label: 'Documents', perm: 'essentials.docs|essentials.todo_add|comm.access' },
      { href: '/communications.html?tab=memos', label: 'Memos', perm: 'essentials.memos|essentials.todo_add|comm.access' },
      { href: '/communications.html?tab=remind', label: 'Reminders', perm: 'essentials.reminders|comm.access' },
    ],
  },
  { label: 'Connector', icon: '🔗', href: '/connector.html', perm: 'connector.access', ...MODULE_COLORS.connector ,
    pages: [
      { href: '/connector.html', label: 'Summary' },
      { href: '/color-report.html?m=connector', label: 'Reports' },
      { href: '/color-setup.html?m=connector', label: 'Setup' },
    ] },
  { label: 'Call Centre', icon: '☎', href: '/call-centre.html', ownTabs: true, perm: 'crm.leads_all|crm.leads_own', ...MODULE_COLORS.callcentre,
    pages: [
      { href: '/call-centre.html', label: 'Summary' },
      { href: '/call-centre.html?tab=topics', label: 'Topics' },
      { href: '/call-centre.html?tab=reports', label: 'Reports' },
      { href: '/call-centre.html?tab=setup', label: 'Setup' },
    ],
    leaves: [
      { href: '/call-centre.html?pane=missed', label: 'Missed / callback' },
      { href: '/call-centre.html?pane=queues', label: 'Queues' },
      { href: '/call-centre.html?pane=campaigns', label: 'Campaigns' },
      { href: '/call-centre.html?pane=agents', label: 'Agents' },
      { href: '/call-centre.html?pane=complaints', label: 'Complaints' },
      { href: '/call-centre.html?pane=field', label: 'Field handoff' },
      { href: '/call-centre.html?pane=hp', label: 'HP promotions' },
    ] },
  { label: 'CRM', icon: '💼', href: '/crm.html', ownTabs: true, perm: 'crm.leads_all|crm.leads_own', ...MODULE_COLORS.crm,
    pages: [
      { href: '/crm.html', label: 'Summary' },
      { href: '/crm.html?tab=topics', label: 'Topics' },
      { href: '/crm.html?tab=reports', label: 'Reports' },
      { href: '/crm.html?tab=setup', label: 'Setup' },
    ],
    leaves: [
      { href: '/crm.html?tab=followups', label: 'Follow ups' },
      { href: '/crm.html?tab=leads', label: 'Leads' },
      { href: '/crm.html?tab=campaigns', label: 'Campaigns' },
      { href: '/crm.html?tab=login', label: 'Contacts Login' },
      { href: '/crm.html?tab=ptpl', label: 'Proposal template' },
      { href: '/crm.html?tab=proposals', label: 'Proposals' },
      { href: '/crm.html?tab=sources', label: 'Sources' },
      { href: '/crm.html?tab=life', label: 'Life Stage' },
      { href: '/crm.html?tab=fcat', label: 'Followup Category' },
    ] },
  { label: 'Custom Dashboards', icon: '📊', href: '/custom-dashboards.html', ownTabs: true, perm: 'dashboard.manage|dashboard.view', ...MODULE_COLORS.dashboard,
    pages: [
      { href: '/custom-dashboards.html', label: 'Summary' },
      { href: '/custom-dashboards.html?tab=topics', label: 'Topics' },
      { href: '/custom-dashboards.html?tab=reports', label: 'Reports' },
      { href: '/custom-dashboards.html?tab=setup', label: 'Setup' },
    ],
    leaves: [
      { href: '/custom-dashboards.html?tab=create', label: 'Create' },
    ] },
  { label: 'Field Ops', icon: '🤝', href: '/field-ops.html', ownTabs: true, perm: 'field_ops.view_all|field_ops.view_own|field_ops.floor', ...MODULE_COLORS.fieldops,
    pages: [
      { href: '/field-ops.html', label: 'Summary', perm: 'field_ops.floor|field_ops.view_all|field_ops.view_own' },
      { href: '/field-ops.html?tab=topics', label: 'Topics' },
      { href: '/field-ops.html?tab=reports', label: 'Reports' },
      { href: '/field-ops.html?tab=setup', label: 'Setup' },
    ],
    leaves: [
      { href: '/field-ops.html?tab=orders', label: 'Order List', perm: 'field_ops.orders|field_ops.view_all|field_ops.view_own|field_ops.floor' },
      { href: '/field-ops.html?tab=payments', label: 'Payment Record', perm: 'field_ops.payments|field_ops.orders|field_ops.view_all|field_ops.view_own' },
      { href: '/field-ops.html?tab=master', label: 'HP Book', perm: 'field_ops.payments|field_ops.orders|field_ops.view_all|field_ops.view_own' },
      { href: '/field-ops.html?tab=books', label: 'Workbooks', perm: 'field_ops.orders|field_ops.view_all|field_ops.view_own|field_ops.floor' },
      { href: '/field-ops.html?tab=visits', label: 'Visits', perm: 'field_ops.view_all|field_ops.view_own' },
      { href: '/field-ops.html?tab=agents', label: 'Agents', perm: 'field_ops.agents' },
      { href: '/field-ops.html?tab=join', label: 'Join', perm: 'field_ops.join' },
      { href: '/field-ops.html?tab=stock', label: 'Stock Hub', perm: 'field_ops.stock' },
      { href: '/field-ops.html?tab=collect', label: 'Collections', perm: 'field_ops.view_all|field_ops.view_own|bnpl.collections' },
      { href: '/field-ops.html?tab=sync', label: 'Sync', perm: 'field_ops.sync' },
    ] },
  { label: 'HRM', icon: '👷', href: '/hrm.html', ownTabs: true, perm: 'hrm.view_all|hrm.view_own|essentials.leave_all|essentials.leave_own|essentials.payroll_view', ...MODULE_COLORS.hrm,
    pages: [
      { href: '/hrm.html', label: 'Summary' },
      { href: '/hrm.html?tab=topics', label: 'Topics' },
      { href: '/hrm.html?tab=reports', label: 'Reports' },
      { href: '/hrm.html?tab=setup', label: 'Setup' },
    ],
    leaves: [
      { href: '/hrm.html?tab=people', label: 'People' },
      { href: '/hrm.html?tab=types', label: 'Leave Type' },
      { href: '/hrm.html?tab=leave', label: 'Leave' },
      { href: '/hrm.html?tab=att', label: 'Attendance' },
      { href: '/hrm.html?tab=payroll', label: 'Payroll' },
      { href: '/hrm.html?tab=bankpay', label: 'Bank Salary' },
      { href: '/hrm.html?tab=holiday', label: 'Holiday' },
      { href: '/hrm.html?tab=dept', label: 'Departments' },
      { href: '/hrm.html?tab=desig', label: 'Designations' },
      { href: '/hrm.html?tab=induction', label: 'Staff induction' },
      { href: '/hrm.html?tab=targets', label: 'Sales Targets' },
    ] },
  { label: 'Manufacturing', icon: '🏭', href: '/manufacturing.html', perm: 'manufacturing.access', ...MODULE_COLORS.mfg,
    pages: [
      { href: '/manufacturing.html', label: 'Summary', perm: 'manufacturing.access' },
      { href: '/color-report.html?m=mfg', label: 'Reports', perm: 'manufacturing.access' },
      { href: '/color-setup.html?m=mfg', label: 'Setup', perm: 'manufacturing.access' },
    ] },
  { label: 'Project', icon: '🧩', href: '/projects.html', ownTabs: true, perm: 'project.view|project.create', ...MODULE_COLORS.project,
    pages: [
      { href: '/projects.html', label: 'Summary' },
      { href: '/projects.html?tab=topics', label: 'Topics' },
      { href: '/projects.html?tab=reports', label: 'Reports' },
      { href: '/projects.html?tab=setup', label: 'Setup' },
    ],
    leaves: [
      { href: '/projects.html?tab=tasks', label: 'My Tasks' },
      { href: '/projects.html?tab=cats', label: 'Project Categories' },
    ] },
  { label: 'Repair', icon: '🔧', href: '/repair.html', ownTabs: true, perm: 'repair.invoice_all|repair.invoice_own|repair.job_all|repair.job_assigned', ...MODULE_COLORS.repair,
    pages: [
      { href: '/repair.html', label: 'Summary' },
      { href: '/repair.html?tab=topics', label: 'Topics' },
      { href: '/repair.html?tab=reports', label: 'Reports' },
      { href: '/repair.html?tab=setup', label: 'Setup' },
    ],
    leaves: [
      { href: '/repair.html?tab=jobs', label: 'Job Sheets' },
      { href: '/repair.html?tab=add', label: 'Add job sheet' },
      { href: '/repair.html?tab=inv', label: 'List Invoices' },
      { href: '/repair.html?tab=addinv', label: 'Add Invoice' },
      { href: '/repair.html?tab=brands', label: 'Brands' },
    ] },
  { label: 'Spreadsheet', icon: '📄', href: '/spreadsheet.html', ownTabs: true, perm: 'spreadsheet.access', ...MODULE_COLORS.sheet,
    pages: [
      { href: '/spreadsheet.html', label: 'Summary' },
      { href: '/spreadsheet.html?tab=topics', label: 'Topics' },
      { href: '/spreadsheet.html?tab=reports', label: 'Reports' },
      { href: '/spreadsheet.html?tab=setup', label: 'Setup' },
    ],
    leaves: [
      { href: '/spreadsheet.html?tab=sheets', label: 'Sheets' },
      { href: '/spreadsheet.html?sheet=s-hp-orders', label: 'BNPL Field Ops' },
    ] },
  { label: 'WMS', icon: 'wms', href: '/wms.html', ownTabs: true, perm: 'stock_transfer.view_all|stock_transfer.view_own|ops.access', ...MODULE_COLORS.wms,
    pages: [
      { href: '/wms.html', label: 'Summary' },
      { href: '/wms.html?tab=topics', label: 'Topics' },
      { href: '/wms.html?tab=reports', label: 'Reports' },
      { href: '/wms.html?tab=setup', label: 'Setup' },
    ],
    leaves: [
      { href: '/wms.html?tab=recv', label: 'Receiving' },
      { href: '/wms.html?tab=putaway', label: 'Put Away' },
      { href: '/wms.html?tab=pick', label: 'Picking' },
      { href: '/wms.html?tab=pack', label: 'Packing' },
      { href: '/wms.html?tab=dispatch', label: 'Dispatch' },
      { href: '/wms.html?tab=stock', label: 'Stock' },
      { href: '/wms.html?tab=xfer', label: 'Transfers' },
      { href: '/wms.html?tab=adj', label: 'Adjustments' },
      { href: '/wms.html?tab=count', label: 'Count' },
      { href: '/wms.html?tab=scan', label: 'Scan' },
      { href: '/wms.html?tab=bank', label: 'Bank Activity' },
    ] },
  { label: 'WooCommerce', icon: '🛒', href: '/woocommerce.html', ownTabs: true, perm: 'woo.api|woo.sync_products', ...MODULE_COLORS.woo,
    pages: [
      { href: '/woocommerce.html', label: 'Summary' },
      { href: '/woocommerce.html?tab=topics', label: 'Topics' },
      { href: '/woocommerce.html?tab=reports', label: 'Reports' },
      { href: '/woocommerce.html?tab=setup', label: 'Setup' },
    ],
    leaves: [
      { href: '/woocommerce.html?tab=log', label: 'Sync Log' },
      { href: '/woocommerce.html?tab=api', label: 'API Settings' },
    ] },
];

(function applySupplyChainSidebar() {
  const pull = (lab) => {
    const i = MENU.findIndex((m) => m.label === lab);
    return i >= 0 ? MENU.splice(i, 1)[0] : null;
  };
  const purchases = pull('Procurement') || pull('Purchases');
  if (purchases) purchases.label = 'Purchases';
  const sale = pull('Sale') || pull('Sales');
  if (sale) sale.label = 'Sales';
  const ops = pull('Operations') || pull('Operations Hub');
  if (ops) ops.label = 'Operations';
  const chain = [
    pull('Home'),
    pull('Records'),
    ops,
    purchases,
    sale,
    pull('Finance'),
    pull('Collections'),
    pull('Reports'),
    pull('System'),
  ].filter(Boolean);
  const addons = MENU.slice().sort((a, b) => String(a.label || '').localeCompare(String(b.label || ''), 'en'));
  MENU.splice(0, MENU.length, ...chain, ...addons);
})();
applyToMenu(MENU);

/** Build tree from flat app_menu_items rows */
function treeFromRows(rows) {
  const byParent = new Map();
  rows.forEach((r) => {
    const key = r.parent_id || 'root';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(r);
  });
  const sortFn = (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0);
  function kids(parentId) {
    return (byParent.get(parentId) || []).sort(sortFn).map((r) => {
      const children = kids(r.id);
      const item = {
        id: r.id,
        label: r.label,
        href: r.href || null,
        icon: r.icon || '',
        color: r.color || null,
        textColor: r.text_color || '#ffffff',
        is_module: !!r.is_module || !!r.color,
      };
      if (children.length) item.children = children;
      if ((item.color || COLOR_BY_LABEL[item.label]) && item.children) {
        item.pages = item.children.map((c) => ({ href: c.href, label: c.label }));
        item.href = item.href || item.pages[0]?.href || null;
        delete item.children;
      }
      return item;
    });
  }
  return kids('root');
}

/** Locked MENU is source of truth. Filtered by the signed-in role. */
export async function loadMenu() {
  await loadAccess();
  let items = filterNav(MENU);
  try {
    const { loadBizSettings, ADDON_MODULE_FLAGS, CORE_MENU_FLAGS } = await import('./settings-store.js');
    const { moduleOnFor, hydrateGrantsFromRows } = await import('./module-grants.js');
    const { getAccess } = await import('./rbac.js');
    const biz = await loadBizSettings();
    const access = getAccess();
    try {
      let roles = [];
      let users = [];
      try { roles = JSON.parse(localStorage.getItem('df_roles') || '[]'); } catch { roles = []; }
      try { users = JSON.parse(localStorage.getItem('df_users') || '[]'); } catch { users = []; }
      hydrateGrantsFromRows(roles, users);
    } catch { /* ignore */ }
    const flagOf = (label) => {
      const raw = String(label || '').trim();
      const hit = ADDON_MODULE_FLAGS.find((x) => x.label === raw)
        || ADDON_MODULE_FLAGS.find((x) => x.label.replace(/re/i, 'er') === raw.replace(/re/i, 'er'));
      return hit?.flag || CORE_MENU_FLAGS[raw];
    };
    const prune = (list) => (list || []).map((it) => {
      if (it.hqOnly && !(isHqRole(access?.roleName) || isOwnerRole(access?.roleName))) return null;
      const k = flagOf(it.label);
      const color = !!(it.color || COLOR_BY_LABEL[it.label]);
      if (color) {
        if (!k || !moduleOnFor(biz, k, access)) return null;
      } else if (k && !moduleOnFor(biz, k, access)) {
        return null;
      }
      const children = it.children ? prune(it.children).filter(Boolean) : null;
      const pages = it.pages
        ? it.pages.filter((p) => {
            const fk = flagOf(p.label);
            return !fk || moduleOnFor(biz, fk, access);
          })
        : null;
      if (children) {
        if (!children.length && !it.href) return null;
        return { ...it, children, ...(pages ? { pages } : {}) };
      }
      if (pages) return { ...it, pages };
      return it;
    }).filter(Boolean);
    items = prune(items);
    const flagForFile = (list, file, inherited) => {
      for (const it of list || []) {
        const own = flagOf(it.label) || inherited;
        if (fileName(it.href) === file) return own || null;
        for (const p of it.pages || []) {
          if (fileName(p.href) === file) return flagOf(p.label) || own || null;
        }
        const nested = flagForFile(it.children, file, own);
        if (nested !== undefined) return nested;
      }
      return undefined;
    };
    const here = fileName(typeof location !== 'undefined' ? location.pathname : '');
    const need = flagForFile(MENU, here, null);
    if (here && need && !moduleOnFor(biz, need, access) && here !== 'dashboard.html' && here !== 'login.html') {
      try { location.replace('/dashboard.html'); } catch { /* ignore */ }
    }
  } catch (err) {
    console.warn('menu prune', err);
    const access = getAccess();
    if (!(isHqRole(access?.roleName) || isOwnerRole(access?.roleName))) {
      items = (items || []).filter((it) => !(it.color || COLOR_BY_LABEL[it.label]));
    }
  }
  return items;
}

export async function refreshShellMenu() {
  const nav = document.getElementById('ult-nav');
  if (!nav) return;
  try {
    const menuItems = await loadMenu();
    nav.innerHTML = buildNavHtml(location.pathname, menuForScope(menuItems || []));
    markNavActive();
    try { applyDomPermissions(document); } catch { /* ignore */ }
  } catch (err) {
    console.warn('menu refresh', err);
  }
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const HDR = {
  moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#5b6570" d="M15.2 2.1A10 10 0 1 0 21.9 13 8.2 8.2 0 0 1 15.2 2.1z"/></svg>',
  sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5" fill="#f59e0b"/><path fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" d="M12 2v2.4M12 19.6V22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2 12h2.4M19.6 12H22M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8" fill="none" stroke="#334155" stroke-width="1.8"/><circle cx="12" cy="13" r="1.4" fill="#334155"/><path stroke="#334155" stroke-width="1.8" stroke-linecap="round" d="M12 8.2v5l3.2 1.8M9 3.4h6M12 3.4V5"/></svg>',
  abacus: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3.5" width="18" height="17" rx="2" fill="none" stroke="#7c4a1e" stroke-width="1.6"/><path stroke="#7c4a1e" stroke-width="1.4" d="M5 8.2h14M5 12.5h14M5 16.8h14"/><circle cx="7.2" cy="8.2" r="1.35" fill="#e11d48"/><circle cx="10.2" cy="8.2" r="1.35" fill="#2563eb"/><circle cx="16.6" cy="8.2" r="1.35" fill="#16a34a"/><circle cx="8.4" cy="12.5" r="1.35" fill="#f59e0b"/><circle cx="14.8" cy="12.5" r="1.35" fill="#7c3aed"/><circle cx="7.2" cy="16.8" r="1.35" fill="#0ea5e9"/><circle cx="12" cy="16.8" r="1.35" fill="#e11d48"/><circle cx="16.6" cy="16.8" r="1.35" fill="#16a34a"/></svg>',
  cog: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#334155" d="M19.1 12.9a7.4 7.4 0 0 0 .1-.9 7.4 7.4 0 0 0-.1-.9l2-1.6a.5.5 0 0 0 .1-.6l-1.9-3.3a.5.5 0 0 0-.6-.2l-2.4 1a7 7 0 0 0-1.6-.9l-.4-2.5a.5.5 0 0 0-.5-.4h-3.8a.5.5 0 0 0-.5.4l-.4 2.5a7 7 0 0 0-1.6.9l-2.4-1a.5.5 0 0 0-.6.2L2.7 8.9a.5.5 0 0 0 .1.6l2 1.6a7.4 7.4 0 0 0-.1.9 7.4 7.4 0 0 0 .1.9l-2 1.6a.5.5 0 0 0-.1.6l1.9 3.3a.5.5 0 0 0 .6.2l2.4-1a7 7 0 0 0 1.6.9l.4 2.5a.5.5 0 0 0 .5.4h3.8a.5.5 0 0 0 .5-.4l.4-2.5a7 7 0 0 0 1.6-.9l2.4 1a.5.5 0 0 0 .6-.2l1.9-3.3a.5.5 0 0 0-.1-.6zM12 15.5A3.5 3.5 0 1 1 15.5 12 3.5 3.5 0 0 1 12 15.5z"/></svg>',
  wrench: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#f8fafc" d="M20.4 7.2a4.6 4.6 0 0 1-6.3 4.2l-7.4 7.4a2 2 0 1 1-2.8-2.8l7.4-7.4a4.6 4.6 0 0 1 6.5-3.9l-2.2 2.2 1.9 1.9 2.2-2.2c.5.8.7 1.7.7 2.6z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="#334155" stroke-width="2.4" stroke-linecap="round" d="M12 5v14M5 12h14"/></svg>',
  chart: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="12" width="4.2" height="8" rx="1" fill="#22c55e"/><rect x="10" y="7" width="4.2" height="13" rx="1" fill="#3b82f6"/><rect x="16" y="4.5" width="4.2" height="15.5" rx="1" fill="#f59e0b"/></svg>',
  bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#c9a227" d="M12 3a6 6 0 0 0-6 6v3.2l-1.4 2.6A1 1 0 0 0 5.5 16.5h13a1 1 0 0 0 .9-1.7L18 12.2V9a6 6 0 0 0-6-6z"/><path fill="#c9a227" d="M10 18a2 2 0 1 0 4 0"/></svg>',
  user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.4" fill="#64748b"/><path fill="#64748b" d="M5.2 19.2c.8-3.4 3.4-5.2 6.8-5.2s6 1.8 6.8 5.2a1 1 0 0 1-1 1.3H6.2a1 1 0 0 1-1-1.3z"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.4" cy="10.4" r="6.1" fill="none" stroke="#334155" stroke-width="2"/><path fill="none" stroke="#334155" stroke-width="2.2" stroke-linecap="round" d="M15.1 15.1L21 21"/></svg>',
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#2563eb" d="M4.6 11.2 12 4.6l7.4 6.6v8.2A1.6 1.6 0 0 1 17.8 21h-3.3v-5.2h-5v5.2H6.2A1.6 1.6 0 0 1 4.6 19.4z"/></svg>',
  cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2.2" fill="#fff" stroke="#334155" stroke-width="1.6"/><path fill="#2563eb" d="M3 5h18v5H3z"/><path stroke="#fff" stroke-width="1.8" stroke-linecap="round" d="M8 3.2v4.2M16 3.2v4.2"/><rect x="6.2" y="12.2" width="3" height="2.4" rx=".4" fill="#94a3b8"/><rect x="10.5" y="12.2" width="3" height="2.4" rx=".4" fill="#2563eb"/><rect x="14.8" y="12.2" width="3" height="2.4" rx=".4" fill="#94a3b8"/><rect x="6.2" y="16" width="3" height="2.4" rx=".4" fill="#94a3b8"/><rect x="10.5" y="16" width="3" height="2.4" rx=".4" fill="#94a3b8"/></svg>',
  todo: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="3" fill="#ecfdf5" stroke="#059669" stroke-width="1.6"/><path fill="none" stroke="#059669" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="m7.4 12.2 3.1 3.1 6.2-7"/></svg>',
  tour: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#eff6ff" stroke="#1d4ed8" stroke-width="1.6"/><circle cx="12" cy="12" r="3.4" fill="none" stroke="#1d4ed8" stroke-width="1.5"/><path fill="#1d4ed8" d="M12 2.8 13.1 6 12 7.2 10.9 6zM12 16.8 13.1 18l-1.1 3.2L10.9 18zM2.8 12 6 10.9 7.2 12 6 13.1zM16.8 12 18 10.9 21.2 12 18 13.1z"/></svg>',
};

/** Theme: local UI preference (instant) + optional profiles.ui_theme */
export function getTheme() {
  const t = localStorage.getItem('ax_theme');
  if (t === 'dark' || t === 'light') return t;
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

export function applyTheme(theme) {
  const t = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t);
  document.documentElement.style.colorScheme = t;
  localStorage.setItem('ax_theme', t);
  const btn = document.getElementById('ult-theme');
  if (btn) btn.innerHTML = t === 'dark' ? HDR.sun : HDR.moon;
  return t;
}

export async function persistTheme(userId, theme) {
  applyTheme(theme);
  if (!userId) return;
  try {
    await supabase.from('profiles').update({ ui_theme: theme }).eq('id', userId);
  } catch (_) { /* column may not exist yet */ }
}

const COLOR_BY_LABEL = {
  Accounting: MODULE_COLORS.accounting,
  'AI Assistance': MODULE_COLORS.ai,
  'Mobile Money': MODULE_COLORS.momo,
  Banking: MODULE_COLORS.banking,
  Crypto: MODULE_COLORS.crypto,
  Cheque: MODULE_COLORS.crypto,
  'GRA Tax': MODULE_COLORS.gra,
  HMS: MODULE_COLORS.momo,
  GYM: MODULE_COLORS.banking,
  Zatca: MODULE_COLORS.gra,
  CRM: MODULE_COLORS.crm,
  Communications: MODULE_COLORS.communications,
  Academy: MODULE_COLORS.academy,
  'Custom Dashboards': MODULE_COLORS.dashboard,
  Project: MODULE_COLORS.project,
  'Asset Management': MODULE_COLORS.assets,
  HRM: MODULE_COLORS.hrm,
  Cheque: MODULE_COLORS.cheque,
  WooCommerce: MODULE_COLORS.woo,
  Connector: MODULE_COLORS.connector,
  Spreadsheet: MODULE_COLORS.sheet,
  'Catalogue QR': MODULE_COLORS.qr,
  Manufacturing: MODULE_COLORS.mfg,
  Repair: MODULE_COLORS.repair,
  'Field Ops': MODULE_COLORS.fieldops,
  WMS: MODULE_COLORS.wms,
  'Call Centre': MODULE_COLORS.callcentre,
};

function resolveColor(item) {
  if (item.color) {
    return { color: item.color, textColor: item.textColor || item.text_color || '#ffffff' };
  }
  return COLOR_BY_LABEL[item.label] || null;
}

/** Color-coded add-on: never a left dropdown. */
export function isAddonModule(item) {
  return !!(item && (item.color || COLOR_BY_LABEL[item.label]));
}

function fileName(href) {
  try {
    const u = new URL(href, 'http://x.local');
    return (u.pathname.split('/').pop() || '').toLowerCase();
  } catch {
    return String(href || '').replace(/^\//, '').split('?')[0].toLowerCase();
  }
}

function addonPages(item) {
  return item?.pages || [];
}

function isAddonPageActive(item) {
  const here = fileName(location.pathname);
  const home = fileName(item.href);
  const hereQ = location.search || '';
  if (here === home) return true;
  if (here === 'color-report.html' || here === 'color-setup.html') {
    const m = new URLSearchParams(hereQ).get('m') || '';
    const key = String(item.label || '').replace(/[\s_-]+/g, '').toLowerCase();
    return !!m && (m === key || key.includes(m) || m.includes(key.replace('callcentre', 'call')));
  }
  return addonPages(item).some((p) => {
    const f = fileName(p.href);
    if (f !== here) return false;
    if (f !== home && f !== 'color-report.html' && f !== 'color-setup.html') return false;
    const q = p.href.includes('?') ? p.href.slice(p.href.indexOf('?')) : '';
    if (!q) return true;
    return hereQ === q || hereQ.startsWith(q + '&');
  });
}

/** Right-pane headings for the add-on that owns this URL (empty if ownTabs). */
export function addonHeadHtml() {
  const here = fileName(location.pathname);
  const item = MENU.find((m) => isAddonModule(m) && !m.ownTabs && addonPages(m).length >= 2
    && addonPages(m).some((p) => fileName(p.href) === here));
  if (!item) return '';
  return `<nav class="bank-head-tabs addon-head-tabs">${addonPages(item).map((p) =>
    `<a href="${p.href}" class="${fileName(p.href) === here ? 'on' : ''}">${esc(p.label)}</a>`
  ).join('')}</nav>`;
}

function migratedHere() {
  const path = (location.pathname || '').toLowerCase();
  const q = location.search || '';
  const file = path.split('/').pop() || '';
  const hits = MIGRATED_NAV.filter((p) => {
    try {
      const u = new URL(p.href, location.origin);
      return (u.pathname.split('/').pop() || '').toLowerCase() === file;
    } catch { return false; }
  });
  const exact = hits.find((p) => {
    try { return (new URL(p.href, location.origin).search || '') === q; } catch { return false; }
  });
  if (exact) return exact;
  return hits.find((p) => {
    try { return !(new URL(p.href, location.origin).search); } catch { return false; }
  }) || hits[0] || null;
}

export function migratedHeadHtml() { return ''; }



function bindMigratedHead(bar) {
  const drop = bar.querySelector('.mig-drop');
  const btn = bar.querySelector('#mig-toggle');
  const menu = bar.querySelector('#mig-menu');
  if (!btn || !menu || !drop || bar.dataset.bound === '1') return;
  bar.dataset.bound = '1';
  drop.classList.remove('open');
  menu.hidden = true;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const open = !drop.classList.contains('open');
    drop.classList.toggle('open', open);
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  document.addEventListener('click', (e) => {
    if (drop.contains(e.target)) return;
    drop.classList.remove('open');
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    drop.classList.remove('open');
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  });
}

export function mountMigratedHead() {
  document.getElementById('ult-pane-head')?.remove();
  document.getElementById('ult-mig-bar')?.remove();
  const slot = document.getElementById('hdr-mig-slot');
  if (slot) { slot.hidden = true; slot.innerHTML = ''; }
}

function pillStyle(item) {
  const c = resolveColor(item);
  if (c) {
    return {
      cls: 'pill',
      style: `background:${c.color} !important;color:${c.textColor} !important`,
    };
  }
  if (item.pill) return { cls: `pill ${item.pill}`, style: '' };
  return { cls: '', style: '' };
}

function pillOpen(item) {
  const p = pillStyle(item);
  const st = p.style ? ` style="${p.style}"` : '';
  return { cls: p.cls, st };
}

function hrefKey(href) {
  try {
    const u = new URL(href, 'http://x.local');
    const file = (u.pathname.split('/').pop() || '').toLowerCase();
    return file + (u.search || '') + (u.hash || '');
  } catch {
    return String(href || '').replace(/^\//, '').toLowerCase();
  }
}

function pageKey() {
  const file = (location.pathname.split('/').pop() || '').toLowerCase();
  return file + (location.search || '') + (location.hash || '');
}

function placeActMenu(details) {
  let menu = details._portalMenu || details.querySelector(':scope > menu');
  const sum = details.querySelector(':scope > summary');
  if (!menu || !sum) return;
  if (menu.parentNode !== document.body) {
    details._portalMenu = menu;
    document.body.appendChild(menu);
    menu.classList.add('act-portal');
  }
  menu.hidden = false;
  const r = sum.getBoundingClientRect();
  const pad = 8;
  menu.style.position = 'fixed';
  menu.style.zIndex = '10050';
  menu.style.minWidth = '260px';
  menu.style.width = 'max-content';
  menu.style.maxWidth = 'min(360px, calc(100vw - 16px))';
  menu.style.whiteSpace = 'nowrap';
  menu.style.overflow = 'visible';
  menu.style.display = 'block';
  const mw = Math.max(260, menu.offsetWidth || 260);
  let left = r.left;
  if (left + mw > window.innerWidth - pad) left = Math.max(pad, window.innerWidth - mw - pad);
  menu.style.left = left + 'px';
  menu.style.right = 'auto';
  const mh = menu.offsetHeight || 0;
  let top = r.bottom + 4;
  if (top + mh > window.innerHeight - pad) top = Math.max(pad, r.top - mh - 4);
  menu.style.top = top + 'px';
}

function restoreActMenu(details) {
  const menu = details._portalMenu;
  if (!menu) return;
  menu.hidden = true;
  menu.style.display = 'none';
  if (menu.parentNode === document.body) details.appendChild(menu);
}

function sweepActPortals() {
  document.querySelectorAll('menu.act-portal').forEach((menu) => {
    const owner = [...document.querySelectorAll('details.act')].find((d) => d._portalMenu === menu);
    if (!owner || !owner.isConnected || !owner.open) {
      menu.hidden = true;
      menu.style.display = 'none';
      if (!owner || !owner.isConnected) menu.remove();
    }
  });
}

function closeActMenus(except) {
  document.querySelectorAll('details.act[open]').forEach((o) => {
    if (o !== except) {
      o.removeAttribute('open');
      restoreActMenu(o);
    }
  });
  sweepActPortals();
}

function bindScrollTop() {
  if (document.getElementById('scroll-top')) return;
  const btn = document.createElement('button');
  btn.id = 'scroll-top';
  btn.type = 'button';
  btn.title = 'Back to top';
  btn.textContent = '↑';
  document.body.appendChild(btn);
  const onScroll = () => {
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    btn.classList.toggle('show', y > 160);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('scroll', onScroll, { passive: true, capture: true });
  btn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
}

function bindActMenus() {
  if (document.documentElement.dataset.actMenus === '1') return;
  document.documentElement.dataset.actMenus = '1';
  document.addEventListener('toggle', (e) => {
    const d = e.target;
    if (!(d instanceof HTMLDetailsElement) || !d.classList.contains('act')) return;
    if (d.open) {
      closeActMenus(d);
      requestAnimationFrame(() => placeActMenu(d));
    } else {
      restoreActMenu(d);
    }
  }, true);
  const relocate = () => {
    document.querySelectorAll('details.act[open]').forEach(placeActMenu);
  };
  document.addEventListener('scroll', relocate, true);
  window.addEventListener('resize', relocate);
  document.addEventListener('click', (e) => {
    if (e.target.closest('details.act, menu.act-portal, .act-portal')) return;
    closeActMenus();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeActMenus();
  });
  const app = document.getElementById('app') || document.querySelector('main');
  if (app && typeof MutationObserver !== 'undefined') {
    new MutationObserver(() => sweepActPortals()).observe(app, { childList: true });
  }
}

function isActiveHref(href) {
  if (!href) return false;
  const want = hrefKey(href);
  const here = pageKey();
  if (want === here) return true;
  const wantFile = want.split('?')[0].split('#')[0];
  const hereFile = here.split('?')[0].split('#')[0];
  if (wantFile !== hereFile) {
    if (wantFile === 'custom-dashboards.html' && !want.includes('?') &&
        (hereFile === 'custom-dashboard-edit.html' || hereFile === 'custom-dashboard-view.html' || hereFile === 'custom-dashboard-settings.html')) return true;
    if (wantFile === 'spreadsheet.html' && hereFile === 'spreadsheets.html') return true;
    if (wantFile === 'banking.html' && ['banks.html','ghana-banking.html','cheques.html','debit-notes.html','purchase-payments.html','mobile-money.html','crypto.html','gra-tax.html','uba-fiberk.html'].includes(hereFile)) return true;
    const owner = MENU.find((m) => isAddonModule(m) && (
      fileName(m.href) === wantFile || addonPages(m).some((p) => fileName(p.href) === wantFile)
    ));
    if (owner && isAddonPageActive(owner) && (fileName(owner.href) === wantFile || !want.includes('?'))) return true;
    return false;
  }
  const wantQ = want.includes('?') ? want.slice(want.indexOf('?')).split('#')[0] : '';
  const hereQ = location.search || '';
  const wantH = want.includes('#') ? want.slice(want.indexOf('#')) : '';
  const hereH = location.hash || '';
  if (wantQ || wantH) return wantQ === hereQ && wantH === hereH;
  return true;
}

function savedOpenLabels() {
  try { return JSON.parse(localStorage.getItem('df_nav_open') || '[]'); }
  catch { return []; }
}

function persistOpenGroup(nav) {
  if (!nav) return;
  const open = [...nav.querySelectorAll('.ult-group.open')].map((el) => el.dataset.label).filter(Boolean);
  try { localStorage.setItem('df_nav_open', JSON.stringify(open)); } catch { /* ignore */ }
}

function accordionSiblings(group) {
  if (!group?.parentElement) return;
  [...group.parentElement.children].forEach((el) => {
    if (el !== group && el.classList?.contains('ult-group')) el.classList.remove('open');
  });
}

function applySavedOpen(nav) {
  if (!nav) return;
  const saved = new Set(savedOpenLabels());
  nav.querySelectorAll('.ult-group').forEach((g) => {
    if (saved.has(g.dataset.label)) g.classList.add('open');
  });
  [...nav.children].filter((el) => el.classList?.contains('ult-group') && el.classList.contains('open'))
    .slice(0, -1)
    .forEach((el) => el.classList.remove('open'));
}

function setOpenGroup(nav, labelOrEl) {
  if (!nav || !labelOrEl) return;
  const g = typeof labelOrEl === 'string'
    ? nav.querySelector(`.ult-group[data-label="${CSS.escape(labelOrEl)}"]`)
    : labelOrEl;
  if (!g) return;
  accordionSiblings(g);
  g.classList.add('open');
  persistOpenGroup(nav);
}

function menuForScope(items) {
  return items || MENU;
}

function itemTreeActive(item) {
  if (!item || isAddonModule(item)) return false;
  if (item.href && isActiveHref(item.href)) return true;
  return (item.children || []).some(itemTreeActive);
}

function firstNavHref(item) {
  if (item?.href) return item.href;
  for (const c of item?.children || []) {
    const h = firstNavHref(c);
    if (h) return h;
  }
  return '';
}

function renderNavNode(c) {
  if (c.children && c.children.length) {
    const open = itemTreeActive(c);
    const land = firstNavHref(c);
    return `
      <div class="ult-group nested ${open ? 'open' : ''}" data-label="${esc(c.label)}">
        <div class="ult-group-head">
          <a class="ult-group-btn nested" href="${esc(land || '#')}" data-group-land="1">
            <span class="lbl">${esc(c.label)}</span>
          </a>
          <button type="button" class="ult-group-chev" data-toggle="nested" aria-label="Expand ${esc(c.label)}">${chevronMark(open)}</button>
        </div>
        <div class="ult-sub nested">
          ${c.children.map(renderNavNode).join('')}
        </div>
      </div>`;
  }
  const href = c.href || '#';
  const act = isActiveHref(href) ? 'active theme-sidebar-child-active' : '';
  return `<a class="${act}" href="${href}" data-label="${esc(c.label)}"><span>${esc(c.label)}</span></a>`;
}

function buildNavHtml(_path, menuItems) {
  const items = menuItems || MENU;
  const remembered = savedOpenLabels()[0] || '';
  const activeLabel = items.find((item) => itemTreeActive(item))?.label || '';
  const openLabel = activeLabel || remembered;
  return items.map((item, i) => {
    const { cls: pillCls, st: pillSt } = pillOpen(item);
    const addon = isAddonModule(item);
    if (item.children && item.children.length) {
      const open = item.label === openLabel;
      return `
        <div class="ult-group ${open ? 'open' : ''}" data-g="${i}" data-label="${esc(item.label)}">
          <button type="button" class="ult-group-btn ${pillCls} ${open ? 'theme-sidebar-active' : ''}"${pillSt} data-toggle="${i}" ${item.label === 'Sales' ? 'id="tour_step7"' : ''}>
            ${iconHtml(item.icon)} <span class="lbl">${esc(item.label)}</span>
            ${chevronMark(open)}
          </button>
          <div class="ult-sub chiled">
            <div class="ult-sub-rail" aria-hidden="true"></div>
            <div class="ult-sub-list">
            ${item.children.map(renderNavNode).join('')}
            </div>
          </div>
        </div>`;
    }
    if (addon) {
      const href = item.href || addonPages(item)[0]?.href || '#';
      const on = isAddonPageActive(item) || isActiveHref(href);
      return `<a class="ult-link ${pillCls} ${on ? 'active' : ''}"${pillSt} href="${href}" data-label="${esc(item.label)}">
      ${iconHtml(item.icon)} <span class="lbl">${esc(item.label)}</span></a>`;
    }
    const href = item.href || '#';
    return `<a class="ult-link ${pillCls} ${isActiveHref(href) ? 'active' : ''}"${pillSt} href="${href}" data-label="${esc(item.label)}">
      ${iconHtml(item.icon)} <span class="lbl">${esc(item.label)}</span></a>`;
  }).join('');
}

function isInsideOurShell() {
  try {
    if (window.self === window.top) return false;
    return !!window.parent.document.getElementById('ult-root');
  } catch {
    return false;
  }
}

const BREAK_OUT = /(?:^|\/)(login|till-login|pos-open|pos|repair-till|customer-display)\.html/i;

function spaPath(href) {
  try {
    const u = new URL(href, location.href);
    if (u.origin !== location.origin) return null;
    return u.pathname + u.search + u.hash;
  } catch {
    return null;
  }
}

function shouldSpa(href) {
  if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return false;
  const path = spaPath(href);
  if (!path) return false;
  if (BREAK_OUT.test(path)) return false;
  return true;
}

function markNavActive() {
  const nav = document.getElementById('ult-nav');
  if (!nav) return;
  nav.querySelectorAll('a[href]').forEach((a) => {
    const on = isActiveHref(a.getAttribute('href'));
    a.classList.toggle('active', on);
    a.classList.toggle('theme-sidebar-child-active', on);
  });
  applySavedOpen(nav);
  nav.querySelectorAll('.ult-group').forEach((g) => g.classList.remove('open'));
  const activeLink = [...nav.querySelectorAll('a[href]')].find((a) => isActiveHref(a.getAttribute('href')));
  let g = activeLink?.closest('.ult-group');
  const chain = [];
  while (g) {
    chain.unshift(g);
    g = g.parentElement?.closest('.ult-group');
  }
  chain.forEach((el) => {
    accordionSiblings(el);
    el.classList.add('open');
  });
  persistOpenGroup(nav);
  markDockActive();
}

function markDockActive() {
  const p = (location.pathname || '').toLowerCase();
  const drawer = document.getElementById('ult-side');
  document.querySelectorAll('#ult-dock [data-dock]').forEach((el) => {
    const k = el.dataset.dock;
    const on = (k === 'menu' && drawer?.classList.contains('show'))
      || (k === 'home' && /dashboard|go-home|\/home/.test(p) && !/custom-dashboard/.test(p))
      || (k === 'products' && /product/.test(p))
      || (k === 'sales' && /sales-order|sell-return/.test(p))
      || (k === 'crm' && /crm|contacts|leads/.test(p));
    el.classList.toggle('on', !!on);
  });
}

function closeMobileSide() {
  document.getElementById('ult-side')?.classList.remove('show');
  document.getElementById('ult-overlay')?.classList.remove('show');
  document.querySelector('#ult-dock [data-dock="menu"]')?.classList.remove('on');
}

function ensureAppHost() {
  document.getElementById('ult-frame')?.remove();
  document.body.classList.remove('ult-spa', 'ult-embed');
  let app = document.getElementById('app');
  if (!app) app = document.querySelector('body > main.ult-main') || document.querySelector('body > main');
  if (!app) {
    app = document.createElement('main');
    app.id = 'app';
    app.className = 'ult-main page';
    const foot = document.querySelector('.df-site-foot');
    if (foot) document.body.insertBefore(app, foot);
    else document.body.appendChild(app);
  }
  app.removeAttribute('hidden');
  app.style.display = '';
  if (!app.id) app.id = 'app';
  return app;
}

function stripSpaArtifacts() {
  document.querySelectorAll('[data-spa-css],[data-spa-script]').forEach((n) => n.remove());
  document.querySelectorAll('.modal-bg, #cd-modal, .todo-modal-bg, .pay-modal-bg, .fc-popover').forEach((n) => n.remove());
  try { window.dispatchEvent(new Event('df-spa-leave')); } catch { /* ignore */ }
  try { if (typeof scope.clearScopeListeners === 'function') scope.clearScopeListeners(); } catch { /* ignore */ }
}

function splitModuleImports(code) {
  let i = 0;
  const n = String(code || '').length;
  const src = String(code || '');
  const skipPad = () => {
    while (i < n) {
      if (/\s/.test(src[i])) { i += 1; continue; }
      if (src[i] === '/' && src[i + 1] === '/') {
        const e = src.indexOf('\n', i);
        i = e < 0 ? n : e + 1;
        continue;
      }
      if (src[i] === '/' && src[i + 1] === '*') {
        const e = src.indexOf('*/', i + 2);
        i = e < 0 ? n : e + 2;
        continue;
      }
      break;
    }
  };
  while (true) {
    skipPad();
    if (!src.startsWith('import', i)) break;
    const after = src[i + 6] || '';
    if (after === '(' || /[$\w]/.test(after)) break;
    const start = i;
    let depth = 0;
    let quote = '';
    i += 6;
    while (i < n) {
      const c = src[i];
      if (quote) {
        if (c === '\\') { i += 2; continue; }
        if (c === quote) quote = '';
        i += 1;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') { quote = c; i += 1; continue; }
      if (c === '{' || c === '(' || c === '[') { depth += 1; i += 1; continue; }
      if (c === '}' || c === ')' || c === ']') { depth = Math.max(0, depth - 1); i += 1; continue; }
      if (c === ';' && depth === 0) { i += 1; break; }
      if (c === '\n' && depth === 0) {
        const chunk = src.slice(start, i).trim();
        if (/from\s*['"][^'"]+['"]\s*$/.test(chunk) || /^import\s*['"][^'"]+['"]\s*$/.test(chunk)) {
          i += 1;
          break;
        }
      }
      i += 1;
    }
  }
  return { head: src.slice(0, i), body: src.slice(i) };
}

function runInlineModule(code, gen) {
  return new Promise((resolve, reject) => {
    const flag = `__dfSpaDone_${gen}`;
    const fail = `__dfSpaFail_${gen}`;
    let settled = false;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      try { delete window[flag]; delete window[fail]; } catch { /* ignore */ }
      if (err) reject(err);
      else resolve();
    };
    window[flag] = () => finish();
    window[fail] = (err) => finish(err instanceof Error ? err : new Error(String(err || 'Page script failed')));
    const { head, body } = splitModuleImports(code);
    const el = document.createElement('script');
    el.type = 'module';
    el.setAttribute('data-spa-script', '1');
    el.textContent = `${head}\n(async()=>{try{\n${body}\n;window.${flag}&&window.${flag}();}catch(e){window.${fail}&&window.${fail}(e);}})();`;
    el.onerror = () => finish(new Error('Page script failed'));
    try {
      document.body.appendChild(el);
    } catch (e) {
      finish(e instanceof Error ? e : new Error(String(e)));
    }
    setTimeout(() => {
      if (settled) return;
      const app = document.getElementById('app');
      const txt = (app?.innerText || '').trim();
      if (txt && !/^Loading/i.test(txt) && txt.length > 24) {
        finish();
        return;
      }
      finish(new Error('Page script timed out'));
    }, 10000);
  });
}

let spaGen = 0;
let spaTimer = 0;

async function loadSpaDocument(path, gen) {
  const app = ensureAppHost();
  document.body.classList.add('ult-spa-pending');
  let res;
  try {
    res = await fetch(path, { credentials: 'same-origin', cache: 'no-cache' });
  } catch (err) {
    document.body.classList.remove('ult-spa-pending');
    throw err;
  }
  if (gen !== spaGen) { document.body.classList.remove('ult-spa-pending'); return; }
  if (!res.ok) {
    document.body.classList.remove('ult-spa-pending');
    app.innerHTML = `<div class="card" style="margin:20px;padding:24px"><h2>Page not found</h2><p>Could not open ${path.split('?')[0]} (${res.status}).</p></div>`;
    return;
  }
  const html = await res.text();
  if (gen !== spaGen) { document.body.classList.remove('ult-spa-pending'); return; }
  if (!/id=["']app["']/.test(html) || /<div id="root"|data-tsr-meta/i.test(html)) {
    document.body.classList.remove('ult-spa-pending');
    if (typeof window.__dfNativeAssign === 'function') window.__dfNativeAssign(path);
    else location.assign(path);
    return;
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  document.title = doc.title || document.title;

  stripSpaArtifacts();
  doc.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
    const href = link.getAttribute('href') || '';
    if (!href || /ultimate-pos\.css/i.test(href)) return;
    const el = document.createElement('link');
    el.rel = 'stylesheet';
    el.href = href;
    el.setAttribute('data-spa-css', '1');
    document.head.appendChild(el);
  });
  doc.querySelectorAll('style').forEach((style) => {
    const el = document.createElement('style');
    el.setAttribute('data-spa-css', '1');
    el.textContent = style.textContent;
    document.head.appendChild(el);
  });

  const incoming = doc.getElementById('app') || doc.querySelector('main');
  const incomingText = (incoming?.innerText || incoming?.textContent || '').trim();
  const placeholder = !incomingText || /^Loading/i.test(incomingText);
  if (incoming && !placeholder) {
    app.className = incoming.className || 'ult-main page';
    app.innerHTML = incoming.innerHTML || '';
  } else if (incoming) {
    app.className = incoming.className || app.className || 'ult-main page';
    app.innerHTML = incoming.innerHTML || '<div class="ult-muted">Loading…</div>';
  }

  const scripts = [...doc.querySelectorAll('script')].filter((s) => {
    const t = (s.getAttribute('type') || 'text/javascript').toLowerCase();
    return t === 'module' || t === 'text/javascript' || t === 'application/javascript';
  });
  for (const s of scripts) {
    if (gen !== spaGen) { document.body.classList.remove('ult-spa-pending'); return; }
    const src = s.getAttribute('src');
    if (src) {
      const url = new URL(src, location.origin);
      url.searchParams.set('spa', String(gen));
      await import(url.href);
    } else if (s.textContent.trim()) {
      await runInlineModule(s.textContent, gen);
    }
  }
  if (gen !== spaGen) { document.body.classList.remove('ult-spa-pending'); return; }
  try { applyDomPermissions(app); } catch { /* ignore */ }
  try { enforcePageAccess(); } catch { /* ignore */ }
  try { showPendingAck(); } catch { /* ignore */ }
  try { mountMigratedHead(); } catch { /* ignore */ }
  try { bindOverflowTabs(document); } catch { /* ignore */ }
  try { bindRecordViews(document); } catch { /* ignore */ }
  try { syncJumpBar(); } catch { /* ignore */ }
  document.body.classList.remove('ult-spa-pending');
}

function openSpa(href, opts = {}) {
  if (!href) return;
  window.__dfOpenSpa = function (h, o = {}) {
    return openSpa(h, { ...o, skipAcl: false });
  };
  if (/pos-open|\/pos\.html/i.test(href)) {
    if (!(can('pos.view') || can('pos.add') || can('sell.add'))) {
      openSpa('/dashboard.html', { force: true, fromPop: true });
      return;
    }
    goToRegister({ userId: window.__dfUserId, repair: /repair/i.test(href) });
    return;
  }
  const path = spaPath(href) || (href.startsWith('/') ? href : '/' + href);
  const destFile = String(path.split('?')[0].split('#')[0].split('/').pop() || '').toLowerCase();
  const homeish = destFile === 'dashboard.html' || destFile === 'login.html' || destFile === 'go-home.html';
  try {
    if (!homeish && !canOpenPage(path)) {
      if (spaPath(path) !== '/dashboard.html') openSpa('/dashboard.html', { force: true, fromPop: true });
      return;
    }
  } catch { /* access not ready — only Home is allowed */ 
    if (!homeish) {
      openSpa('/dashboard.html', { force: true, fromPop: true });
      return;
    }
  }
  if (BREAK_OUT.test(path)) {
    location.href = path;
    return;
  }
  const leaving = location.pathname + location.search + location.hash;
  const fileOf = (p) => String(p || '').split('?')[0].split('#')[0];
  if (!opts.fromPop && leaving !== path) {
    try { pushDeskBack(leaving); } catch { /* ignore */ }
  }
  if (opts.fromPop && leaving !== path) {
    try { history.replaceState({ spa: path }, '', path); } catch { /* ignore */ }
  }
  if (!opts.force && fileOf(leaving) === fileOf(path) && document.getElementById('app')) {
    if (!opts.fromPop && leaving !== path) history.pushState({ spa: path, tab: true }, '', path);
    try { rememberLastPath(path); } catch { /* ignore */ }
    markNavActive();
    markDockActive();
    try { syncJumpBar(); } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent('df-tab', { detail: path }));
    return;
  }
  if (!opts.fromPop && leaving !== path) history.pushState({ spa: path }, '', path);
  try { rememberLastPath(path); } catch { /* ignore */ }
  markNavActive();
  markDockActive();
  try { syncJumpBar(); } catch { /* ignore */ }
  closeMobileSide();
  if (!opts.fromPop && !opts.force && leaving === path && !document.getElementById('ult-frame') && spaTimer) return;
  const gen = ++spaGen;
  spaTimer = Date.now();
  loadSpaDocument(path, gen).catch((err) => {
    document.body.classList.remove('ult-spa-pending');
    if (gen !== spaGen) return;
    console.warn('spa', err);
    if (/timed out/i.test(String(err?.message || err))) {
      location.assign(path);
      return;
    }
    const app = ensureAppHost();
    app.innerHTML = `<div class="card" style="margin:20px;padding:24px"><h2>Could not load</h2><p>${String(err?.message || err)}</p><p><a href="${path}">Open full page</a></p></div>`;
  });
}

window.__dfOpenSpa = function (h, o = {}) {
  return openSpa(h, { ...o, skipAcl: false });
};
window.__dfRefreshPane = function refreshPane() {
  const path = location.pathname + location.search + location.hash;
  openSpa(path, { force: true, fromPop: true });
};

function bindSpaClicks() {
  if (document.documentElement.dataset.spaClicks === '1') return;
  document.documentElement.dataset.spaClicks = '1';
  /* The generic in-app navigator. Registered at the lowest navigation priority
     so the specialised guards — archive lock, till exit, tab nav, record view,
     table context — get first refusal; if none of them claims the click, this
     one SPA-navigates. It used to race them all in the capture phase. */
  registerClickGuard({
    name: 'spa-nav',
    priority: PRIORITY.page,
    match: (origin) => origin?.closest?.('a[href]'),
    claim: (a) => {
      if (a.target === '_blank' || a.hasAttribute('download')) return 'pass';
      const href = a.getAttribute('href');
      if (!shouldSpa(href)) return 'pass';
      if (/[?&]view=1/.test(href) || /(?:^|\b)view(?:\b|$)/i.test((a.textContent || '').trim())) return 'pass';
      try {
        const u = new URL(href, location.origin);
        const hereFile = (location.pathname.split('/').pop() || '').toLowerCase();
        const nextFile = (u.pathname.split('/').pop() || '').toLowerCase();
        const inHub = a.closest('.bank-head-tabs, .hub-subtabs, .acc-nav, .acc-inner-tabs, .tab-drop, .nest-grid, .addon-head-tabs, .rpt-subtabs, .comm-rooms, .comm-wrap');
        if (inHub && hereFile && nextFile === hereFile) return 'pass';
      } catch { /* fall through to spa */ }
      openSpa(href);
      return 'claim';
    },
  });

  registerClickGuard({
    name: 'row-open',
    priority: PRIORITY.page - 1,
    match: (origin, e) => {
      if (e.target.closest('a[href],button,summary,menu,input,select,label,.act,.act-portal,[data-toggle]')) return null;
      return e.target.closest('tbody tr[data-view]');
    },
    claim: (row) => {
      if (!row?.dataset.view || !shouldSpa(row.dataset.view)) return 'pass';
      openSpa(row.dataset.view);
      return 'claim';
    },
  });
}

let _mountedSession = null;

try {
  window.__df_mounting = true;
  window.addEventListener('unhandledrejection', (ev) => {
    try { console.warn('page rejection', ev.reason); } catch { /* ignore */ }
  });
  window.addEventListener('error', (ev) => {
    try { console.warn('page error', ev.message || ev.error); } catch { /* ignore */ }
  });
  setTimeout(() => {
    if (document.getElementById('ult-root')) return;
    if (window.__df_mounting) return;
    const app = document.getElementById('app');
    if (!app) return;
    const txt = String(app.textContent || '').replace(/\s+/g, ' ').trim();
    if (!/^Loading/i.test(txt) && txt.length > 60) return;
    app.innerHTML = `<div class="ult-card" style="margin:28px auto;max-width:520px;padding:20px">
      <h1 style="margin:0 0 8px;font-size:20px">This screen did not open</h1>
      <p class="ult-muted">The session did not finish loading. Sign in, then open the page from the menu.</p>
      <p style="display:flex;gap:8px;flex-wrap:wrap;margin:16px 0 0">
        <a class="ult-btn ult-btn-primary" href="/login.html">Sign in</a>
        <a class="ult-btn ult-btn-outline" href="/dashboard.html">Home</a>
        <a class="ult-btn ult-btn-outline" href="/dashboard.html">Home</a>
      </p>
    </div>`;
  }, 16000);
} catch { /* ignore */ }

function bootCalls() {
  import('./comm-calls.js').then((m) => { try { m.installCallListener(); } catch { /* ignore */ } }).catch(() => {});
}

function bootHeavy() {
  if (window.__dfHeavyBoot) return;
  window.__dfHeavyBoot = true;
  const later = (path, fn, ms) => {
    setTimeout(() => {
      import(path).then((m) => { try { fn(m); } catch { /* ignore */ } }).catch(() => {});
    }, ms);
  };
  later('./paper-purchase.js', (m) => m.syncPinaroSupplier && m.syncPinaroSupplier(), 20000);
  later('./easybuy-customers.js', (m) => m.hydrateEasybuyCustomers && m.hydrateEasybuyCustomers(), 20000);
  later('./live-sync.js', (m) => m.installLiveSync && m.installLiveSync(), 25000);
}

export async function mountUltimateShell(opts = {}) {
  try { window.__df_mounting = true; } catch { /* ignore */ }
  try { if (typeof scope.installScopeListenerGuard === 'function') scope.installScopeListenerGuard(); } catch { /* ignore */ }
  ensureMobileMeta();
  if (document.getElementById('ult-root')) {
    document.body.classList.remove('ult-embed');
    applyTheme(getTheme());
    bindActMenus();
    bindScrollTop();
    observeLiveSearch();
    bindViewEditAudit();
    try { ensureDeleteKey(); } catch { /* ignore */ }
    if (_mountedSession?.user) {
      try { await loadAccess(); } catch { /* ignore */ }
      bootCalls();
      return _mountedSession;
    }
    const session = await requireAuth();
    _mountedSession = session;
    try { await loadAccess(); } catch { /* ignore */ }
    bootCalls();
    return session;
  }
  if (isInsideOurShell()) {
    document.body.classList.add('ult-embed');
    applyTheme(getTheme());
    bindActMenus();
    bindScrollTop();
    observeLiveSearch();
    bindViewEditAudit();
    try { ensureDeleteKey(); } catch { /* ignore */ }
    const session = await requireAuth();
    if (!session) {
      location.replace('/login.html');
      return null;
    }
    try { await loadAccess(); } catch { /* ignore */ }
    await loadActiveSubsidiary(session.user.id);
    bootHeavy();
    _mountedSession = session;
    bootCalls();
    return session;
  }

  // Apply theme before paint of shell
  let theme = getTheme();
  applyTheme(theme);

  const session = await requireAuth();
  if (!session) return null;
  _mountedSession = session;
  try { await loadAccess(); } catch { /* ignore */ }
  try { await hydrateUser(session); } catch { /* local */ }
  try {
    const dest = destinationForSession(session, location.pathname);
    if (dest) {
      location.replace(dest);
      return null;
    }
  } catch { /* ignore */ }
  bootHeavy();
  try {
    const p = location.pathname + location.search + location.hash;
    rememberLastPath(p);
  } catch { /* ignore */ }

  // Profile fetch must not block the chrome
  let myProfile = null;
  try {
    const pr = await Promise.race([
      supabase.from('profiles')
        .select('ui_theme, full_name, role, role_name, designation, assigned_locations, preferred_subsidiary, allow_login')
        .eq('id', session.user.id)
        .maybeSingle(),
      new Promise((resolve) => setTimeout(() => resolve({ data: null }), 2500)),
    ]);
    if (pr?.data?.ui_theme === 'dark' || pr?.data?.ui_theme === 'light') {
      theme = applyTheme(pr.data.ui_theme);
    }
  if (pr?.data?.full_name && !opts.userLabel) opts.userLabel = pr.data.full_name;
    if (pr?.data?.designation) opts.roleLabel = pr.data.designation;
    else if (pr?.data?.role) opts.roleLabel = pr.data.role;
    myProfile = pr?.data || null;
  } catch (_) {}
  if (!myProfile) {
    try { myProfile = await loadMyProfile(); } catch { myProfile = null; }
  }
  if (myProfile && myProfile.allow_login === false) {
    resetAccess();
    await supabase.auth.signOut();
    location.replace('/login.html');
    return null;
  }
  if (typeof scope.setLocationGate === 'function') {
    scope.setLocationGate((locs) => filterLocations(locs, myProfile));
  }

  const userLabel = opts.userLabel || session.user.email?.split('@')[0] || 'Admin';
  let roleLabel = 'Staff';
  try {
    const { publicJobLabel } = await import('./staff-jobs.js');
    roleLabel = publicJobLabel({
      ...(myProfile || {}),
      email: session.user.email,
      designation: myProfile?.designation || session.user.user_metadata?.designation || opts.roleLabel,
    }, session.user.email);
  } catch {
    roleLabel = String(myProfile?.designation || opts.roleLabel || 'Staff');
    if (/^(hq\s*admin|owner|superadmin|admin)$/i.test(roleLabel.replace(/_/g, ' ').trim())) {
      roleLabel = 'Staff';
    }
  }
  let sub = await Promise.race([
    loadActiveSubsidiary(session.user.id),
    new Promise((resolve) => setTimeout(() => resolve(SUBSIDIARIES[0]), 2500)),
  ]);
  if (!sub) sub = SUBSIDIARIES[0];
  const allowedSubs = subsidiariesFor(myProfile, SUBSIDIARIES, BUSINESS_LOCATIONS);
  if (!isGroupOperatorRole(opts.roleLabel || myProfile?.role || myProfile?.role_name) && sub?.code === 'group' && allowedSubs[0]) {
    sub = allowedSubs[0];
    try { await saveActiveSubsidiary(session.user.id, sub); } catch { /* ignore */ }
  }
  const path = (location.pathname.split('/').pop() || 'dashboard.html').toLowerCase();
  const fieldOn = typeof scope.isBnplFieldScope === 'function' && scope.isBnplFieldScope(sub.code, getActiveLocation());

  /**
   * Field Ops used to take over the dashboard for anyone whose active scope was
   * BNPL: pick BNPL in the sidebar dropdown, the page reloads, and this replaced
   * the dashboard with /field-ops.html. Selecting a scope is not a request to go
   * anywhere, so for everyone except actual field staff it now stays put — the
   * module is one click away in the menu.
   *
   * Field and agent roles still land there, because the group dashboard is not
   * their screen. ?stay=1 overrides it for them too.
   */
  const roleText = String(opts.roleLabel || myProfile?.role || '').toLowerCase();
  const isFieldRole = /field|agent|bnpl|easybuy/.test(roleText)
    && !isHqRole(opts.roleLabel || myProfile?.role);
  let stay = false;
  try { stay = new URLSearchParams(location.search).has('stay'); } catch { /* ignore */ }
  /* Scope dropdowns never open Field Ops. Stay on this page. */

  const root = document.createElement('div');
  root.id = 'ult-root';
  root.innerHTML = `
    <header class="ult-top">
      <div class="ult-top-left">
        <button type="button" class="ult-icon-btn ult-tile hdr-home" id="hdr-home" data-desk-home title="Go Home" aria-label="Go Home">${HDR.home}</button>
        <strong class="ult-brand">DELKOR-FIBERK <span class="desk-only">GROUP</span><span class="dot" title="Online">●</span></strong>
        <button type="button" class="ult-icon-btn" id="ult-side-toggle" title="Full screen workspace">⇤</button>
      </div>
      <div class="ult-top-right">
        <div class="hdr-drop" id="hdr-mig-slot"></div>
        <div class="hdr-drop" id="hdr-find-drop">
          <button type="button" class="ult-icon-btn ult-tile" id="hdr-find" title="Search">${HDR.search}</button>
          <div class="hdr-menu hdr-search-menu" id="hdr-find-menu" hidden>
            <input type="search" id="hdr-erp-search" placeholder="Search pages, SKUs, customers…" autocomplete="off" />
            <div id="hdr-erp-suggest" class="hdr-suggest"></div>
          </div>
        </div>
        <button type="button" class="ult-theme-btn ult-tile" id="ult-theme" title="Theme">${theme === 'dark' ? HDR.sun : HDR.moon}</button>
        <button type="button" class="ult-icon-btn ult-tile" id="hdr-clock" title="Clock in">${HDR.clock}</button>
        <button type="button" class="ult-icon-btn ult-tile" id="hdr-calc" title="Calculator">${HDR.abacus}</button>
        ${(isHqRole(opts.roleLabel || myProfile?.role || myProfile?.role_name) || isOwnerRole(opts.roleLabel || myProfile?.role || myProfile?.role_name))
          ? `<button type="button" class="ult-icon-btn ult-tile" id="hdr-system" title="Business Settings — always on for leadership">${HDR.cog}</button>`
          : ''}
        ${(() => { try { return isGated(findUser(session)); } catch { return false; } })()
          ? ''
          : `<button type="button" class="ult-pos-btn ult-tile" id="hdr-pos" title="Register">POS</button>
        <button type="button" class="ult-repair-btn ult-tile" id="hdr-repair" title="Repair till">${HDR.wrench}</button>`}
        <div class="hdr-drop">
          <button type="button" class="ult-icon-btn ult-tile" id="hdr-cal" title="More">${HDR.plus}</button>
          <div class="hdr-menu" id="hdr-cal-menu" hidden>
            <button type="button" data-act="cal">${HDR.cal}<span>Calendar</span></button>
            <button type="button" data-act="todo">${HDR.todo}<span>Add to do</span></button>
            <button type="button" data-act="tour">${HDR.tour}<span>Application tour</span></button>
          </div>
        </div>
        <button type="button" class="ult-icon-btn ult-tile" id="hdr-profit" title="Today's profit">${HDR.chart}</button>
        <span class="ult-date">${new Date().toLocaleDateString('en-GB')}</span>
        <button type="button" class="ult-icon-btn ult-tile" id="hdr-bell" title="Notifications" style="position:relative;overflow:visible">${HDR.bell}</button>
        <div class="hdr-drop">
          <button type="button" class="ult-user-chip" id="hdr-user">${HDR.user}<span>${esc(userLabel)}</span></button>
          <div class="hdr-menu" id="hdr-user-menu" hidden>
            <div class="hdr-signed">Signed in as<br><strong>${esc(userLabel)}</strong><div class="hdr-role">${esc(roleLabel)}</div></div>
            <div class="hdr-attend ult-muted" id="hdr-attend">Attendance: checking…</div>
            <a href="/profile.html">Profile</a>
            ${(isHqRole(opts.roleLabel || myProfile?.role || myProfile?.role_name) || isOwnerRole(opts.roleLabel || myProfile?.role || myProfile?.role_name))
              ? '<a href="/settings.html">Business Settings</a>'
              : ''}
            <button type="button" id="ult-logout">Sign out</button>
          </div>
        </div>
      </div>
    </header>
    <aside class="ult-side" id="ult-side">
      <div class="ult-side-head phone-only">
        <strong>Menu</strong>
        <button type="button" id="ult-side-close" aria-label="Close menu">×</button>
      </div>
      <div class="ult-side-tools">
        <select id="ult-sub" class="ult-side-box" data-scope-sub title="Active subsidiary">
          ${(() => {
            const raw = allowedSubs || [];
            const hasGroup = raw.some((s) => s.code === 'group');
            const rest = raw.filter((s) => s.code !== 'group');
            const withOps = rest.some((s) => s.code === 'ops')
              ? rest
              : [{ code: 'ops', name: 'Operations Hub', short: 'Operations Hub' }, ...rest];
            const list = hasGroup || isGroupOperatorRole(opts.roleLabel || myProfile?.role || myProfile?.role_name)
              ? [{ code: 'group', name: 'All Subsidiaries', short: 'All Subsidiaries' }, ...withOps]
              : withOps;
            const cur = sub?.code || 'group';
            return list.map((s) => {
              const label = s.code === 'group' ? 'All Subsidiaries'
                : s.code === 'ops' ? 'Operations Hub'
                : (s.short || s.name);
              return `<option value="${s.code}" ${s.code === cur ? 'selected' : ''}>${esc(label)}</option>`;
            }).join('');
          })()}
        </select>
        <select id="ult-loc" class="ult-side-box" data-scope-loc title="Business location">
          <option value="">All Locations</option>
          ${filterLocations(locationsFor(sub.code), myProfile).map((l) =>
            `<option value="${l.code}" ${getActiveLocation() === l.code ? 'selected' : ''}>${esc(l.name)}</option>`
          ).join('')}
        </select>
        <div data-scope-agent-wrap ${scope.locationSupportsAgents(getActiveLocation()) ? '' : 'hidden'}>
          <select id="ult-agent" class="ult-side-box" data-scope-agent title="Field agent"></select>
        </div>
        <div class="ult-side-suggest">
          <input type="search" id="ult-menu-search" class="ult-side-box" placeholder="Search the ERP…" autocomplete="off" />
          <div id="ult-suggest" class="ult-suggest" hidden></div>
        </div>
      </div>
      <nav id="ult-nav">${buildNavHtml(path, [{ href: '/dashboard.html', label: 'Home', icon: 'home' }])}</nav>
    </aside>
    <div class="ult-overlay" id="ult-overlay"></div>
    <nav class="ult-dock" id="ult-dock" aria-label="Phone app bar">
      <button type="button" data-dock="menu"><span class="dock-ico">☰</span><span>Menu</span></button>
      <a href="/dashboard.html" data-dock="home"><span class="dock-ico">⌂</span><span>Home</span></a>
      <a href="/crm.html" data-dock="crm"><span class="dock-ico">💼</span><span>CRM</span></a>
      <a href="/sales-orders.html" data-dock="sales"><span class="dock-ico">🛒</span><span>Sales</span></a>
      <button type="button" data-dock="me"><span class="dock-ico">👤</span><span>Account</span></button>
    </nav>
    <div class="acct-sheet" id="acct-sheet" hidden>
      <button type="button" class="acct-back" id="acct-back" aria-label="Close account"></button>
      <div class="acct-card" role="dialog" aria-labelledby="acct-title">
        <div class="acct-handle"></div>
        <h3 id="acct-title">Account</h3>
        <p class="acct-who">Signed in as<br><strong>${esc(userLabel)}</strong>
          <span class="hdr-role">${esc(roleLabel)}</span>
          <span class="ult-muted">${esc(session.user.email || '')}</span>
        </p>
        <p class="hdr-attend ult-muted" id="acct-attend">Attendance: checking…</p>
        <a class="acct-link" href="/profile.html">Profile</a>
        <button type="button" class="acct-link" id="acct-clock">Clock in / out</button>
        <button type="button" class="acct-link" id="acct-theme">Theme</button>
        <button type="button" class="acct-link danger" id="acct-logout">Sign out</button>
      </div>
    </div>
    <div class="ult-modal" id="ult-modal" hidden></div>
  `;
  document.body.prepend(root);
  document.body.classList.add('ult-on');
  try { document.documentElement.dataset.rbacReady = '1'; } catch { /* ignore */ }
  ensureSiteFooter();
  watchScopeSelects(session.user.id);

  const nav = document.getElementById('ult-nav');
  nav.addEventListener('click', (e) => {
    const t = e.target.closest('[data-toggle]');
    if (t) {
      e.preventDefault();
      e.stopPropagation();
      const g = t.closest('.ult-group');
      if (!g) return;
      const wasOpen = g.classList.contains('open');
      accordionSiblings(g);
      g.classList.toggle('open', !wasOpen);
      persistOpenGroup(nav);
      return;
    }
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('http')) return;
    e.preventDefault();
    openSpa(href);
  });
  bindSpaClicks();
  try { applyChrome(); } catch { /* ignore */ }
  if (!window.__dfChevronBound) {
    window.__dfChevronBound = true;
    window.addEventListener('df-chevron', () => {
      try { applyChrome(); } catch { /* ignore */ }
      const n = document.getElementById('ult-nav');
      if (n && window.__dfLastMenu) {
        n.innerHTML = buildNavHtml(location.pathname, window.__dfLastMenu);
        try { markNavActive(); } catch { /* ignore */ }
      }
    });
  }
  try { installDeskBack(document); } catch { /* ignore */ }
  try { syncJumpBar(); } catch { /* ignore */ }
  window.addEventListener('popstate', () => {
    const href = location.pathname + location.search + location.hash;
    openSpa(href, { fromPop: true, force: true });
  });
  setTimeout(() => { try { finishShellChrome(); } catch (err) { console.warn('shell rest', err); } }, 0);
  try { window.__df_mounting = false; } catch { /* ignore */ }
  return session;

  async function finishShellChrome() {
  try { mountMigratedHead(); } catch { /* ignore */ }

  function flattenMenu(items, parent = '') {
    const out = [];
    (items || []).forEach((it) => {
      if (it.href) out.push({ label: it.label, href: it.href, parent });
      if (it.pages) {
        it.pages.forEach((p) => out.push({ label: p.label, href: p.href, parent: it.label }));
      }
      if (it.leaves) {
        it.leaves.forEach((p) => out.push({ label: p.label, href: p.href, parent: it.label }));
      }
      if (it.children && !isAddonModule(it)) out.push(...flattenMenu(it.children, it.label));
    });
    return out;
  }
  let menuIndex = flattenMenu(MENU);
  loadMenu().then((menuItems) => {
    const painted = Array.isArray(menuItems) && menuItems.length
      ? menuItems
      : [{ href: '/dashboard.html', label: 'Home', icon: 'home' }];
    window.__dfLastMenu = painted;
    try { applyChrome(); } catch { /* ignore */ }
    nav.innerHTML = buildNavHtml(path, painted);
    markNavActive();
    menuIndex = flattenMenu(painted);
    document.documentElement.dataset.rbacReady = '1';
    try {
      const access = getAccess();
      const crm = document.querySelector('[data-dock="crm"]');
      const sales = document.querySelector('[data-dock="sales"]');
      if (crm && access && !(isHqRole(access.roleName) || isOwnerRole(access.roleName))) {
        const on = access.moduleFlags || {};
        if (crm && on.module_crm === false) crm.hidden = true;
        if (sales && on.module_sales === false) sales.hidden = true;
      }
    } catch { /* ignore */ }
  }).catch(() => {
    document.documentElement.dataset.rbacReady = '1';
  });
  const searchBox = document.getElementById('ult-menu-search');
  const suggestEl = document.getElementById('ult-suggest');
  let lastHits = [];
  function paintSuggest(q) {
    const term = q.trim().toLowerCase();
    if (!term) {
      suggestEl.hidden = true;
      suggestEl.innerHTML = '';
      nav.querySelectorAll('.ult-group, .ult-link').forEach((el) => { el.style.display = ''; });
      applySavedOpen(nav);
      return;
    }
    import('./erp-search.js').then((mod) => {
      lastHits = mod.searchErp(q, MENU);
      suggestEl.hidden = false;
      suggestEl.innerHTML = mod.suggestHtml(lastHits);
    }).catch(() => {
      const hits = menuIndex.filter((m) =>
        m.label.toLowerCase().includes(term) || (m.parent || '').toLowerCase().includes(term)
      ).slice(0, 12);
      lastHits = hits;
      suggestEl.hidden = hits.length === 0;
      suggestEl.innerHTML = hits.map((m) =>
        `<a href="${esc(m.href)}" data-href="${esc(m.href)}"><strong>${esc(m.label)}</strong>${m.parent ? `<span>${esc(m.parent)}</span>` : ''}</a>`
      ).join('') || '';
    });
    nav.querySelectorAll('.ult-group, .ult-link').forEach((el) => {
      const label = (el.dataset.label || el.textContent || '').toLowerCase();
      const childHit = el.classList.contains('ult-group') &&
        [...el.querySelectorAll('[data-label]')].some((a) => (a.dataset.label || '').toLowerCase().includes(term));
      const show = label.includes(term) || childHit;
      el.style.display = show ? '' : 'none';
    });
    const first = [...nav.querySelectorAll('.ult-group')].find((el) => el.style.display !== 'none');
    if (first) setOpenGroup(nav, first);
  }
  searchBox.addEventListener('input', (e) => paintSuggest(e.target.value));
  searchBox.addEventListener('focus', () => { if (searchBox.value.trim()) paintSuggest(searchBox.value); });
  searchBox.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const first = suggestEl.querySelector('a[data-href]');
    if (!first) return;
    e.preventDefault();
    suggestEl.hidden = true;
    openSpa(first.getAttribute('data-href') || first.getAttribute('href'));
  });
  suggestEl.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-href]');
    if (!a) return;
    e.preventDefault();
    suggestEl.hidden = true;
    openSpa(a.dataset.href);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.ult-side-suggest')) suggestEl.hidden = true;
  });

  const hdrSearch = document.getElementById('hdr-erp-search');
  const hdrSuggest = document.getElementById('hdr-erp-suggest');
  const paintHdrSuggest = (q) => {
    if (!hdrSuggest) return;
    const term = String(q || '').trim();
    if (!term) {
      hdrSuggest.innerHTML = '<div class="ult-sug-empty">Type a page, SKU, customer, or invoice…</div>';
      return;
    }
    import('./erp-search.js').then((mod) => {
      hdrSuggest.innerHTML = mod.suggestHtml(mod.searchErp(q, MENU));
    }).catch(() => {
      const hits = menuIndex.filter((m) =>
        m.label.toLowerCase().includes(term.toLowerCase()) || (m.parent || '').toLowerCase().includes(term.toLowerCase())
      ).slice(0, 12);
      hdrSuggest.innerHTML = hits.map((m) =>
        `<a href="${esc(m.href)}" data-href="${esc(m.href)}"><strong>${esc(m.label)}</strong>${m.parent ? `<span>${esc(m.parent)}</span>` : ''}</a>`
      ).join('') || '<div class="ult-sug-empty">No match.</div>';
    });
  };
  hdrSearch?.addEventListener('input', (e) => paintHdrSuggest(e.target.value));
  hdrSearch?.addEventListener('focus', () => paintHdrSuggest(hdrSearch.value));
  hdrSearch?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.getElementById('hdr-find-menu').hidden = true;
      return;
    }
    if (e.key !== 'Enter') return;
    const first = hdrSuggest?.querySelector('a[data-href]');
    if (!first) return;
    e.preventDefault();
    document.getElementById('hdr-find-menu').hidden = true;
    openSpa(first.getAttribute('data-href') || first.getAttribute('href'));
  });
  hdrSuggest?.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-href]');
    if (!a) return;
    e.preventDefault();
    document.getElementById('hdr-find-menu').hidden = true;
    openSpa(a.dataset.href);
  });

  document.getElementById('ult-theme').onclick = async () => {
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    await persistTheme(session.user.id, next);
  };

  async function doLogout(e) {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    try {
      const { recordPunch } = await import('./time-clock.js');
      const { writeActivity } = await import('./staff-log.js');
      writeActivity({
        action: 'logout',
        type: 'Attendance',
        by: session?.user?.email || '',
        user_id: session?.user?.id || '',
        note: 'Signed out of the app',
      });
      if (!isTillCashier()) {
        recordPunch({
          type: 'clock_out',
          note: 'App sign-out',
          user_id: session?.user?.id || '',
          user_email: session?.user?.email || '',
          staff: session?.user?.email || userLabel || '',
          role: opts.roleLabel || myProfile?.role_name || myProfile?.role || '',
        });
      }
    } catch { /* still sign out */ }
    resetAccess();
    try { clearLocalAuth(); } catch { /* ignore */ }
    /* Sign-out used to clear df_preview_demo from sessionStorage only, while
       login.html wrote it to localStorage as well — so the demo session
       survived every sign-out and re-hijacked the login screen. Clear the whole
       set from both storages, including the cached profile, which is what made
       a sandbox "HQ Finance" identity stick. */
    ['df_preview_demo', 'df_logged_in', 'df_auth', 'df_profile', 'df_last_path', 'df_active_sub', 'df_active_loc'].forEach((k) => {
      try { localStorage.removeItem(k); } catch { /* ignore */ }
      try { sessionStorage.removeItem(k); } catch { /* ignore */ }
    });
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
    location.replace('/login.html?switch=1');
  }
  document.getElementById('ult-logout').onclick = doLogout;
  document.getElementById('acct-logout')?.addEventListener('click', doLogout);
  document.getElementById('acct-clock')?.addEventListener('click', () => document.getElementById('hdr-clock')?.click());
  document.getElementById('acct-theme')?.addEventListener('click', () => document.getElementById('ult-theme')?.click());
  const closeAcct = () => {
    const sheet = document.getElementById('acct-sheet');
    if (sheet) sheet.hidden = true;
    document.querySelector('#ult-dock [data-dock="me"]')?.classList.remove('on');
  };
  document.getElementById('acct-back')?.addEventListener('click', closeAcct);

  bindHeaderTools(session, userLabel);
  bindActMenus();
  bindScrollTop();
  observeLiveSearch();
  bindViewEditAudit();
  try { injectDeskChromeCss(); installDeskNavGuard(); installDeskBack(document); } catch { /* ignore */ }
  try { ensureDeleteKey(); } catch { /* ignore */ }
  setTimeout(() => {
    try { installFormFill(); } catch { /* ignore */ }
    try { watchActionColumns(document); } catch { /* ignore */ }
    try { installArchiveReadonly(document, { allowEdit: isHqRole(opts.roleLabel || myProfile?.role) }); } catch { /* ignore */ }
    bootHeavy();
    try { showPendingAck(); } catch { /* ignore */ }
    import('./chatbot.js')
      .then((m) => { try { m.mountChatbot({ session, menu: MENU }); } catch (err) { console.warn('chatbot', err); } })
      .catch((err) => { console.warn('chatbot load', err); });
    if (isHqRole(opts.roleLabel || myProfile?.role || myProfile?.role_name) || isOwnerRole(opts.roleLabel || myProfile?.role || myProfile?.role_name)) {
      import('./staff-hours.js').then((m) => m.scanAbsences()).catch(() => {});
      if (!document.documentElement.dataset.absentPoll) {
        document.documentElement.dataset.absentPoll = '1';
        setInterval(() => {
          import('./staff-hours.js').then((m) => m.scanAbsences()).catch(() => {});
        }, 60000);
      }
    }
    bootCalls();
  }, 2500);
  const acc = getAccess();
  if (acc && !can('home.kpis')) {
    document.getElementById('hdr-profit')?.remove();
  }

  const burger = document.getElementById('ult-burger');
  const side = document.getElementById('ult-side');
  const overlay = document.getElementById('ult-overlay');
  const closeSide = () => {
    side?.classList.remove('show');
    overlay?.classList.remove('show');
    document.querySelector('#ult-dock [data-dock="menu"]')?.classList.remove('on');
  };
  const openSide = () => {
    side?.classList.add('show');
    overlay?.classList.add('show');
    document.querySelector('#ult-dock [data-dock="menu"]')?.classList.add('on');
  };
  burger?.addEventListener('click', () => {
    if (side.classList.contains('show')) closeSide();
    else openSide();
  });
  overlay.onclick = closeSide;
  document.getElementById('ult-side-close')?.addEventListener('click', closeSide);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSide();
  });
  document.getElementById('hdr-find')?.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.hdr-menu').forEach((el) => {
      if (el.id !== 'hdr-find-menu') el.hidden = true;
    });
    const menu = document.getElementById('hdr-find-menu');
    if (!menu) return;
    menu.hidden = !menu.hidden;
    if (!menu.hidden) setTimeout(() => document.getElementById('hdr-erp-search')?.focus(), 20);
  });
  document.getElementById('hdr-find-menu')?.addEventListener('click', (e) => e.stopPropagation());
  nav.addEventListener('click', (e) => {
    if (e.target.closest('a[href]')) closeSide();
  });
  markDockActive();
  document.getElementById('ult-dock')?.addEventListener('click', (e) => {
    const act = e.target.closest('[data-dock]')?.dataset.dock;
    if (!act) return;
    if (act === 'menu' || act === 'more') {
      e.preventDefault();
      if (side.classList.contains('show')) closeSide();
      else openSide();
    }
    if (act === 'me') {
      e.preventDefault();
      e.stopPropagation();
      const sheet = document.getElementById('acct-sheet');
      if (sheet) sheet.hidden = !sheet.hidden;
      document.querySelector('#ult-dock [data-dock="me"]')?.classList.toggle('on', sheet && !sheet.hidden);
    }
  });

  const applySideCollapse = (on) => {
    if (isPhoneLayout()) on = false;
    document.body.classList.toggle('ult-side-collapsed', on);
    const btn = document.getElementById('ult-side-toggle');
    if (btn) btn.textContent = on ? '⇥' : '⇤';
    if (!isPhoneLayout()) {
      try { localStorage.setItem('df_side_collapsed', on ? '1' : '0'); } catch { /* ignore */ }
    }
  };
  applySideCollapse(localStorage.getItem('df_side_collapsed') === '1');
  document.getElementById('ult-side-toggle').onclick = () => {
    applySideCollapse(!document.body.classList.contains('ult-side-collapsed'));
  };

  loadTillPin(session.user.id);
  document.getElementById('hdr-system')?.addEventListener('click', () => {
    location.href = '/settings.html';
  });
  document.getElementById('hdr-pos')?.addEventListener('click', () => {
    if (isGated(findUser(session))) { location.replace('/orientation.html'); return; }
    goToRegister({ userId: session.user.id, repair: false });
  });
  document.getElementById('hdr-repair')?.addEventListener('click', () => {
    if (isGated(findUser(session))) { location.replace('/orientation.html'); return; }
    goToRegister({ userId: session.user.id, repair: true });
  });
  loadAccess().then((acc) => {
    if (!acc) return;
    if (!can('home.kpis')) {
      document.getElementById('hdr-profit')?.remove();
    }
    if (!can('cashier.role') && !can('pos.add')) {
      document.getElementById('hdr-pos')?.remove();
      document.getElementById('hdr-repair')?.remove();
    }
  }).catch(() => {});
  }
}

const APP_TOUR = [
  { title: 'Application Tour', body: "Let's go through Delkor-Fiberk ERP in 7 quick steps…" },
  { title: 'Step 1: Group & subsidiaries', body: 'The header switcher and Home chips move between Delkor-Fiberk Group, Axidigetek, BuyNowPaysLater, Delkor Logistics and Fiberk. Group users see all four; branch users see only their company.' },
  { title: 'Step 2: Business locations', body: 'Locations are the shops under each subsidiary (Fiberk Shop, Axidigetek Online Store, Delkor Furniture Market, BNPL Field and Online). Set them under Settings. POS and dashboard filters use the same list.' },
  { title: 'Step 3: Contacts', body: 'Contacts holds suppliers and customers for the active company. Sales, purchases and CRM all attach to these records.' },
  { title: 'Step 4: Products & stock', body: 'Products, categories, brands and stock adjustments live under Products. Stock alerts on Home use the same quantities as the till.' },
  { title: 'Step 5: POS till', body: 'POS first opens a cash register (subsidiary + location + opening float), then a full-screen till. Administrative sales stay on Sales Orders if you are not on the counter.' },
  { title: 'Step 6: Purchases, sales & accounting', body: 'Purchase and sales orders feed stock and the ledger. Accounting is the coloured module; cash, banks, MoMo, crypto and GRA Tax live under Finance → Banking.' },
  { title: 'Step 7: Users, Repair & Home', body: 'User Management assigns HQ Admin vs branch roles. Repair is the workshop module. Home KPIs follow the date + subsidiary + location filters. End tour whenever you like.' },
];

export function startAppTour(startAt = 0) {
  let i = startAt;
  const paint = () => {
    const step = APP_TOUR[i];
    const m = openUltModal(`<div>
      <h3 style="margin:0 0 10px">${step.title}</h3>
      <p style="margin:0;line-height:1.5">${step.body}</p>
      <div class="tour-actions">
        <button type="button" class="tour-prev" ${i===0?'disabled':''}>« Prev</button>
        <button type="button" class="tour-next">${i===APP_TOUR.length-1?'Finish':'Next »'}</button>
        <button type="button" class="tour-end">End tour</button>
      </div>
    </div>`);
    const card = m.querySelector('.ult-modal-card');
    if (card) card.classList.add('tour-card');
    m.querySelector('.tour-prev').onclick = (e) => { e.stopPropagation(); if (i>0) { i--; paint(); } };
    m.querySelector('.tour-next').onclick = (e) => { e.stopPropagation(); if (i < APP_TOUR.length-1) { i++; paint(); } else { m.hidden = true; } };
    m.querySelector('.tour-end').onclick = (e) => { e.stopPropagation(); m.hidden = true; m.innerHTML = ''; };
  };
  paint();
}

function openUltModal(html, cardClass = '') {
  const m = document.getElementById('ult-modal');
  m.hidden = false;
  m.className = 'ult-modal' + (cardClass ? ' ' + cardClass + '-host' : '');
  m.innerHTML = `<div class="ult-modal-card ${cardClass}">${html}<button type="button" class="ult-modal-x" id="ult-modal-x">×</button></div>`;
  m.querySelector('#ult-modal-x').onclick = () => { m.hidden = true; m.innerHTML = ''; m.className = 'ult-modal'; };
  m.onclick = (e) => { if (e.target === m) { m.hidden = true; m.innerHTML = ''; m.className = 'ult-modal'; } };
  return m;
}

async function refreshAttendance(session) {
  if (!session) return;
  const els = [document.getElementById('hdr-attend'), document.getElementById('acct-attend')].filter(Boolean);
  if (!els.length) return;
  const setTxt = (t) => els.forEach((n) => { n.textContent = t; });
  try {
    const { punchesToday } = await import('./time-clock.js');
    const last = punchesToday(session.user.id)[0];
    if (last?.clocked_at) {
      const dt = new Date(last.clocked_at);
      const when = dt.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
      setTxt(last.type === 'clock_out' ? ('Clocked out · ' + when) : ('Clocked in · ' + when));
      return;
    }
  } catch { /* fall through */ }
  try {
    const { data } = await supabase.from('clock_ins')
      .select('type, created_at, clocked_at, clock_in_at, note')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(1);
    const last = data?.[0];
    if (!last) { setTxt('Attendance: not clocked in'); return; }
    const raw = last.clocked_at || last.created_at || last.clock_in_at;
    const dt = raw ? new Date(raw) : new Date();
    const when = dt.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short', year: 'numeric' });
    setTxt(last.type !== 'clock_out' ? ('Clocked in · ' + when) : ('Clocked out · ' + when));
  } catch {
    setTxt('Attendance: not clocked in');
  }
}

function bindHeaderTools(session, userLabel) {
  refreshAttendance(session);
  const toggleMenu = (id) => {
    document.querySelectorAll('.hdr-menu').forEach((el) => {
      if (el.id !== id) el.hidden = true;
    });
    const menu = document.getElementById(id);
    if (menu) menu.hidden = !menu.hidden;
  };
  document.getElementById('hdr-cal').onclick = (e) => { e.stopPropagation(); toggleMenu('hdr-cal-menu'); };
  document.getElementById('hdr-user').onclick = (e) => { e.stopPropagation(); toggleMenu('hdr-user-menu'); };
  document.addEventListener('click', () => {
    document.querySelectorAll('.hdr-menu').forEach((el) => { el.hidden = true; });
  });

  document.getElementById('hdr-cal-menu').onclick = (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'cal') {
      openSpa('/calendar.html');
    }
    if (act === 'todo') {
      import('./calendar.js').then((mod) => {
        mod.openTodoModal({
          onSaved: () => {
            try { window.dispatchEvent(new Event('df-cal-change')); } catch { /* ignore */ }
          },
        });
      });
    }
    if (act === 'tour') startAppTour(0);
  };

  document.getElementById('hdr-clock').onclick = async () => {
    const leadership = isHqRole(opts.roleLabel || myProfile?.role_name || myProfile?.role)
      || isOwnerRole(opts.roleLabel || myProfile?.role_name || myProfile?.role);
    const m = openUltModal(`<h3>Clock In / Clock Out</h3>
      ${leadership
        ? '<p class="ult-muted">HQ Admin and Owner are not tied to shop IP or GPS. Punch records the time only.</p>'
        : '<p class="ult-muted">Shop IP / GPS is captured in the background. A missed pin does not block the punch.</p>'}
      <p>Network: <strong id="clk-ip">checking…</strong></p>
      ${leadership ? '' : `<p><button type="button" class="ult-btn ult-btn-outline" id="clk-geo">Use current location</button> <span id="clk-geo-txt" class="ult-muted"></span></p>`}
      <div class="ult-field"><label>Type</label>
        <select id="clk-type"><option value="clock_in">Clock in</option><option value="clock_out">Clock out</option></select>
      </div>
      <div class="ult-field"><label>Note</label><textarea id="clk-note" rows="3" placeholder="Clock in / out note"></textarea></div>
      <button type="button" class="ult-btn ult-btn-primary" id="clk-go">Submit</button>
      <button type="button" class="ult-btn ult-btn-outline" id="clk-close">Close</button>`);
    m.querySelector('#clk-close').onclick = () => { m.hidden = true; };
    let ip = '';
    let geo = '';
    import('./till-open.js').then((mod) => {
      mod.fetchPublicIp().then((v) => {
        ip = v || '';
        const el = m.querySelector('#clk-ip');
        if (el) el.textContent = ip || 'not available';
      }).catch(() => {
        const el = m.querySelector('#clk-ip');
        if (el) el.textContent = 'not available';
      });
    }).catch(() => {
      const el = m.querySelector('#clk-ip');
      if (el) el.textContent = 'not available';
    });
    m.querySelector('#clk-geo')?.addEventListener('click', () => {
      const txt = m.querySelector('#clk-geo-txt');
      if (!navigator.geolocation) { txt.textContent = 'Location not supported'; return; }
      txt.textContent = 'Locating…';
      navigator.geolocation.getCurrentPosition((pos) => {
        geo = pos.coords.latitude.toFixed(5) + ',' + pos.coords.longitude.toFixed(5);
        txt.textContent = geo;
      }, () => { txt.textContent = 'Pin skipped — punch still works'; }, { timeout: 5000, maximumAge: 30000 });
    });
    m.querySelector('#clk-go').onclick = async () => {
      const kind = m.querySelector('#clk-type').value;
      const note = m.querySelector('#clk-note').value.trim();
      const stamp = new Date().toISOString();
      try {
        const { recordPunch } = await import('./time-clock.js');
        recordPunch({
          type: kind,
          note,
          ip,
          location: geo,
          user_id: session.user.id,
          user_email: session.user.email,
          staff: session.user.email,
          role: opts.roleLabel || myProfile?.role_name || myProfile?.role || '',
          verified: leadership ? true : undefined,
        });
      } catch { /* still try remote */ }
      supabase.from('clock_ins').insert({
        user_id: session.user.id,
        user_email: session.user.email,
        note: note || null,
        ip_address: ip || null,
        type: kind,
        clocked_at: stamp,
        created_at: stamp,
        location: geo || null,
      }).then(() => {}).catch(() => {});
      m.hidden = true;
      refreshAttendance(session);
    };
  };

  document.getElementById('hdr-calc').onclick = () => {
    const keys = [
      ['AC', 'ac'], ['CE', 'ce'], ['⌫', 'bk'], ['÷', 'op'],
      ['7', ''], ['8', ''], ['9', ''], ['×', 'op'],
      ['4', ''], ['5', ''], ['6', ''], ['−', 'op'],
      ['1', ''], ['2', ''], ['3', ''], ['+', 'op'],
      ['0', ''], ['.', ''], ['%', 'pct'], ['=', 'eq'],
    ];
    const m = openUltModal(`
      <div class="calc-head">CALCULATOR</div>
      <input id="calc-scr" readonly class="calc-scr" value="0" />
      <div class="calc-pad">${keys.map(([k, cls]) =>
        `<button type="button" class="calc-k ${cls}" data-k="${k}">${k}</button>`).join('')}</div>`, 'calc-card');
    let cur = '0';
    const scr = () => { m.querySelector('#calc-scr').value = cur; };
    m.querySelectorAll('.calc-k').forEach((b) => {
      b.onclick = () => {
        const k = b.dataset.k;
        if (k === 'AC') cur = '0';
        else if (k === 'CE' || k === '⌫') cur = cur.slice(0, -1) || '0';
        else if (k === '%') {
          try { cur = String(Number(Function('"use strict";return (' + cur.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-') + ')')()) / 100); }
          catch { cur = 'Err'; }
        } else if (k === '=') {
          try { cur = String(Function('"use strict";return (' + cur.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-') + ')')()); }
          catch { cur = 'Err'; }
        } else cur = cur === '0' && k !== '.' ? k : cur + k;
        scr();
      };
    });
  };

  document.getElementById('hdr-profit').onclick = async () => {
    const money = (n) => 'GH₵ ' + Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const day = new Date().toISOString().slice(0, 10);
    const [{ data: sales }, { data: purch }, { data: exp }, { data: returns }, { data: stock }] = await Promise.all([
      supabase.from('sales_orders').select('total_amount, status, payment_status, tax_amount').gte('order_date', day),
      supabase.from('purchase_orders').select('total_amount').gte('order_date', day),
      supabase.from('expenses').select('amount').gte('expense_date', day),
      supabase.from('sell_returns').select('total').gte('return_date', day),
      supabase.from('products').select('current_stock_value, cost_price, selling_price').limit(800),
    ]);
    const liveSales = (sales || []).filter((s) => !/draft|quot|cancel/i.test(s.status || ''));
    const sell = liveSales.reduce((a, r) => a + Number(r.total_amount || 0), 0);
    const taxSales = liveSales.reduce((a, r) => a + Number(r.tax_amount || 0), 0);
    const buy = (purch || []).reduce((a, r) => a + Number(r.total_amount || 0), 0);
    const ex = (exp || []).reduce((a, r) => a + Number(r.amount || 0), 0);
    const sellReturn = (returns || []).reduce((a, r) => a + Number(r.total || 0), 0);
    const openCost = (stock || []).reduce((a, p) => a + Number(p.stock || p.current_stock_value || 0) * Number(p.cost_price || 0), 0);
    const openSell = (stock || []).reduce((a, p) => a + Number(p.stock || p.current_stock_value || 0) * Number(p.selling_price || 0), 0);
    const closeCost = openCost + buy - sellReturn;
    const closeSell = openSell + sell - sellReturn;
    const discount = sell * 0.1;
    const cogs = openCost + buy - closeCost;
    const gross = sell - buy + 0;
    const net = gross - ex - discount;
    const taxPurch = 0;
    const row = (label, hint, val, hi) =>
      `<div class="pf-row ${hi || ''}"><div><b>${label}</b>${hint ? `<small>${hint}</small>` : ''}</div><strong>${money(val)}</strong></div>`;

    const m = openUltModal(`
      <h3 class="pf-title">Today's profit</h3>
      <div class="pf-cols">
        <section class="pf-card">
          <header>↓ COSTS &amp; DEDUCTIONS</header>
          ${row('Opening Stock', '(By purchase price):', openCost)}
          ${row('Opening Stock', '(By sale price):', openSell)}
          ${row('Total purchase:', '(Exc. tax, Discount)', buy, 'hi-amber')}
          ${row('Total Stock Adjustment:', '', 0)}
          ${row('Total Expense:', '', ex)}
          ${row('Total purchase shipping charge:', '', 0)}
          ${row('Purchase additional expenses:', '', 0)}
          ${row('Total transfer shipping charge:', '', 0)}
          ${row('Total Sell discount:', '', discount)}
          ${row('Total customer reward:', '', 0)}
          ${row('Total Sell Return:', '', sellReturn)}
          ${row('Total Payroll:', '', 0)}
          ${row('Total Production Cost:', '', 0)}
        </section>
        <section class="pf-card">
          <header>↑ REVENUE &amp; INCOME</header>
          ${row('Closing stock', '(By purchase price):', closeCost)}
          ${row('Closing stock', '(By sale price):', closeSell)}
          ${row('Total Sales:', '(Exc. tax, Discount)', sell, 'hi-green')}
          ${row('Total sell shipping charge:', '', 0)}
          ${row('Sell additional expenses:', '', 0)}
          ${row('Total Stock Recovered:', '', 0)}
          ${row('Total Purchase Return:', '', 0)}
          ${row('Total Purchase discount:', '', 0)}
          ${row('Total sell round off:', '', 0)}
          ${row('Total Sell Return Discount:', '', 0)}
          ${row('Hms Total:', '', 0)}
        </section>
      </div>
      <div class="pf-foot">
        <p class="pf-cogs">COGS: <strong>${money(cogs)}</strong><small>Cost of Goods Sold = Starting inventory (opening stock) + purchases − ending inventory (closing stock)</small></p>
        <p class="pf-gross">Gross Profit: <strong>${money(gross)}</strong> <span>(${sell ? ((gross / sell) * 100).toFixed(2) : '0.00'}%)</span>
          <small>Total sell price − Total purchase price + Hms Total + Project Invoice</small></p>
        <p class="pf-net">Net Profit: <strong>${money(net)}</strong> <span>(${sell ? ((net / sell) * 100).toFixed(2) : '0.00'}%)</span>
          <small>Gross Profit + shipping / recovered / discounts − expenses / payroll / production / sell discount</small></p>
        <div class="pf-tax">
          <h4>Tax Summary</h4>
          <p>Tax Collected on Sales: <strong>${money(taxSales)}</strong></p>
          <p>Tax Paid on Purchases: <strong>${money(taxPurch)}</strong></p>
          <p>Net Tax Liability: <strong class="due">${money(taxSales - taxPurch)}</strong></p>
          <small>This section is informational only. The P&amp;L figures above are calculated excluding tax.</small>
        </div>
        <button type="button" class="ult-btn" id="pf-close" style="background:#0f172a;color:#fff;margin-left:auto;display:block">Close</button>
      </div>`, 'pf-wide');
    m.querySelector('#pf-close').onclick = () => { m.hidden = true; m.innerHTML = ''; };
  };

  document.getElementById('hdr-bell').onclick = async () => {
    const email = String(session.user?.email || '').toLowerCase();
    const userId = session.user?.id;
    await pullNotices(email, userId);
    const rows = listNotices(email, userId, { unreadOnly: true });
    const m = openUltModal(`
      <h3 class="note-h">Notifications</h3>
      <p class="note-tools">
        <button type="button" class="ult-btn ult-btn-outline" id="note-read">Mark all read</button>
        <button type="button" class="ult-btn ult-btn-outline" id="note-clear">Clear</button>
      </p>
      <div class="note-list">${rows.length
        ? rows.map((n) => `
            <button type="button" class="note-row" data-note="${esc(n.id)}" data-href="${esc(n.href || '')}">
              <b>${esc(n.title || 'Notice')}</b>
              <p>${esc(n.body || '')}</p>
              <small>${esc(String(n.created_at || '').replace('T', ' ').slice(0, 16))}</small>
            </button>`).join('')
        : '<p class="note-empty">No new notifications</p>'}</div>`, 'note-drawer');
    m.querySelector('#note-read')?.addEventListener('click', async () => {
      await markAllRead(email, userId);
      refreshBellCount(session);
      const list = m.querySelector('.note-list');
      if (list) list.innerHTML = '<p class="note-empty">No new notifications</p>';
    });
    m.querySelector('#note-clear')?.addEventListener('click', async () => {
      await clearNotices(email, userId);
      refreshBellCount(session);
      const list = m.querySelector('.note-list');
      if (list) list.innerHTML = '<p class="note-empty">No new notifications</p>';
    });
    m.querySelectorAll('[data-note]').forEach((btn) => {
      btn.onclick = async () => {
        await markNoticeRead(btn.dataset.note);
        refreshBellCount(session);
        btn.remove();
        const list = m.querySelector('.note-list');
        if (list && !list.querySelector('.note-row')) list.innerHTML = '<p class="note-empty">No new notifications</p>';
        const href = btn.dataset.href || '';
        if (href && !/users\.html/i.test(href)) {
          const host = document.getElementById('ult-modal');
          if (host) { host.hidden = true; host.innerHTML = ''; host.className = 'ult-modal'; }
          if (typeof window.__dfOpenSpa === 'function') window.__dfOpenSpa(href);
          else location.assign(href);
        }
      };
    });
  };
  refreshBellCount(session);
  if (!document.documentElement.dataset.bellPoll) {
    document.documentElement.dataset.bellPoll = '1';
    setInterval(() => refreshBellCount(session), 8000);
  }
}

async function refreshBellCount(session) {
  const btn = document.getElementById('hdr-bell');
  if (!btn) return;
  const email = session?.user?.email;
  const userId = session?.user?.id;
  try { await pullNotices(email, userId); } catch { /* local */ }
  const n = unreadCount(email, userId);
  btn.querySelector('.bell-count')?.remove();
  if (n > 0) {
    const b = document.createElement('span');
    b.className = 'bell-count';
    b.textContent = n > 99 ? '99+' : String(n);
    b.style.cssText = 'position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#dc2626;color:#fff;font-size:10px;font-weight:800;line-height:16px;text-align:center;box-shadow:0 0 0 2px #fff;pointer-events:none';
    btn.style.position = 'relative';
    btn.style.overflow = 'visible';
    btn.appendChild(b);
  }
}

/** Slim POS chrome — no ERP sidebar */
export async function mountPosFrame(opts = {}) {
  const session = await requireAuth();
  if (!session) return null;
  try { await hydrateUser(session); } catch { /* local */ }
  try {
    const dest = destinationForSession(session, location.pathname);
    if (dest) { location.replace(dest); return null; }
  } catch { /* ignore */ }
  applyTheme(getTheme());
  const sub = await loadActiveSubsidiary(session.user.id);
  let posProfile = opts.profile || null;
  if (!posProfile) {
    try { posProfile = await loadMyProfile(); } catch { posProfile = null; }
  }
  if (typeof scope.setLocationGate === 'function') {
    scope.setLocationGate((locs) => tillLocations(locs, posProfile));
  }
  const till = opts.till || null;
  const admin = !!opts.admin;
  const openTills = opts.openTills || [];
  const lock = !!(till && (till.subsidiary_code || till.location_name));

  const subLabel = () => {
    const pair = typeof scope.pairFromLocation === 'function'
      ? scope.pairFromLocation(till?.location_code || till?.location_name, till?.subsidiary_code || sub?.code)
      : null;
    const code = String(pair?.subsidiary || till?.subsidiary_code || sub?.code || '');
    const hit = SUBSIDIARIES.find((s) => s.code === code);
    return hit ? hit.short : code;
  };
  const locLabel = (() => {
    if (typeof scope.pairFromLocation === 'function') {
      const pair = scope.pairFromLocation(till?.location_code || till?.location_name, till?.subsidiary_code);
      if (pair?.location_name) return pair.location_name;
    }
    return till?.location_name || getActiveLocation() || 'Location';
  })();
  const cashierJob = opts.cashierJob || '';
  const cashierLabel = opts.cashierName || (till?.cashier_email || '').split('@')[0] || '';

  const tillOptions = openTills.map((r) => {
    const who = (r.cashier_email || '').split('@')[0];
    const label = `${r.subsidiary_code || ''} · ${r.location_name || ''} · ${who}`.replace(/ · $/, '');
    return `<option value="${r.id}" ${r.id === till?.id ? 'selected' : ''}>${esc(label)}</option>`;
  }).join('');

  const frozenChips = lock
    ? `<div class="pos-id-row">
         <span class="pos-lock-chip" title="Selling company"><small>Company</small><span class="v">${esc(subLabel())}</span></span>
         <span class="pos-lock-chip loc" title="Business location"><small>Location</small><span class="v">${esc(locLabel)}</span></span>
         ${cashierLabel ? `<button type="button" class="pos-lock-chip agent" id="pos-cashier" title="Cashier on this till"><small>${esc(cashierJob || 'Sales Associate')}</small><span class="v">${esc(cashierLabel)}</span></button>` : ''}
       </div>`
    : '';
  const adminSwitch = lock && admin && openTills.length > 1
    ? `<label class="pos-lock">Switch till
        <select id="pos-till-switch" class="ult-sub-select" title="Jump to another open till">
          ${tillOptions}
        </select>
      </label>`
    : '';

  const chrome = lock
    ? frozenChips + adminSwitch
    : `<select id="pos-sub" class="ult-sub-select" title="Selling company">
        ${subsidiariesFor(posProfile, OPERATING_SUBSIDIARIES, BUSINESS_LOCATIONS).map((s) =>
          `<option value="${s.code}" ${s.code === sub.code ? 'selected' : ''}>${esc(s.short)}</option>`
        ).join('')}
      </select>
      <select id="pos-loc" class="ult-sub-select" title="Business location">
        ${tillLocations(locationsFor(sub.code === 'group' ? '' : sub.code, { forSale: true }), posProfile).map((l) =>
          `<option value="${l.code}" ${getActiveLocation() === l.code ? 'selected' : ''}>${esc(l.name)}</option>`
        ).join('')}
      </select>`;

  if (document.getElementById('pos-frame')) {
    const inner = document.querySelector('#pos-frame .pos-frame-inner');
    if (inner && lock) {
      const grow = inner.querySelector('.pos-frame-grow');
      const old = inner.querySelectorAll('#pos-sub, #pos-loc, .pos-lock, .pos-lock-chip, .pos-id-row');
      old.forEach((el) => el.remove());
      inner.querySelectorAll('a[href="/sales-orders.html"]').forEach((el) => el.remove());
      const mark = inner.querySelector('.pos-frame-mark') || inner.querySelector('strong');
      if (mark) mark.insertAdjacentHTML('afterend', chrome);
    }
    return session;
  }
  const bar = document.createElement('header');
  bar.id = 'pos-frame';
  bar.innerHTML = `
    <div class="pos-frame-inner">
      <span class="pos-frame-mark">POS</span>
      ${chrome}
      <span class="pos-frame-grow"></span>
      <span class="pos-frame-acts">
        <a class="pos-act-reg" href="/till-login.html">Register</a>
        <a class="pos-act-erp" href="/dashboard.html">Back to ERP</a>
      </span>
      <span id="pos-head-extras"></span>
    </div>`;
  document.body.prepend(bar);
  document.body.classList.add('pos-focus');
  document.body.classList.remove('ult-on');
  markPhoneChrome();
  if (!document.getElementById('pos-dock')) {
    const dock = document.createElement('nav');
    dock.id = 'pos-dock';
    dock.className = 'pos-dock';
    dock.setAttribute('aria-label', 'Till shortcuts');
    dock.innerHTML = `
      <button type="button" data-pos-pane="cart"><span class="dock-ico">🛒</span><span>Cart</span></button>
      <button type="button" data-pos-pane="catalog"><span class="dock-ico">▣</span><span>Catalog</span></button>
      <button type="button" data-pos-pane="pay" class="dock-pos"><span class="dock-ico">₵</span><span>Pay</span></button>
      <button type="button" data-pos-pane="crm"><span class="dock-ico">👤</span><span>Customer</span></button>
      <button type="button" data-pos-pane="erp"><span class="dock-ico">⌂</span><span>ERP</span></button>`;
    document.body.appendChild(dock);
    document.body.dataset.posPane = document.body.dataset.posPane || 'catalog';
    dock.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-pos-pane]');
      if (!btn) return;
      e.preventDefault();
      const pane = btn.dataset.posPane;
      if (pane === 'erp') {
        leaveTillOrStay(till?.id || window.__dfTillSessionId, '/dashboard.html');
        return;
      }
      document.body.dataset.posPane = pane;
      dock.querySelectorAll('[data-pos-pane]').forEach((b) => b.classList.toggle('on', b.dataset.posPane === pane));
      if (pane === 'pay') document.getElementById('pos-pay')?.scrollTo?.(0, 0);
    });
    dock.querySelector('[data-pos-pane="catalog"]')?.classList.add('on');
  }

  const sw = document.getElementById('pos-till-switch');
  if (sw) {
    sw.onchange = () => {
      const id = sw.value;
      if (id && id !== String(till?.id || '')) {
        location.href = (opts.repair ? '/repair-till.html' : '/pos.html') + '?session=' + encodeURIComponent(id);
      }
    };
  }
  const posSub = document.getElementById('pos-sub');
  if (posSub) {
    posSub.onchange = async (e) => {
      const s = SUBSIDIARIES.find((x) => x.code === e.target.value);
      if (!s) return;
      const allowed = tillLocations(locationsFor(s.code, { forSale: true }), posProfile).map((l) => l.code);
      if (getActiveLocation() && !allowed.includes(getActiveLocation())) saveActiveLocation('');
      await saveActiveSubsidiary(session.user.id, s);
      location.reload();
    };
  }
  const posLoc = document.getElementById('pos-loc');
  if (posLoc) {
    posLoc.onchange = () => {
      saveActiveLocation(posLoc.value || '');
      location.reload();
    };
  }
  observeLiveSearch();
  if (till?.id) installTillExitGuard(till.id);
  try {
    const books = await import('./module-books.js');
    books.mountModuleBooks();
  } catch { /* ignore */ }
  try {
    const spec = await import('./nav-spec.js');
    spec.mountNavSpec();
  } catch { /* ignore */ }
  try {
    const ctx = await import('./context-mode.js');
    ctx.mountContextMode();
  } catch { /* ignore */ }
  try {
    const tabs = await import('./tab-loader.js');
    tabs.mountTabLoader();
  } catch { /* ignore */ }
  try {
    const tables = await import('./table-rules.js');
    tables.mountTableRules();
  } catch { /* ignore */ }
  return session;
}


export function erpFooterHtml() {
  return `
  <footer class="df-site-foot" id="df-site-foot">
    <p class="df-copy">Delkor-Fiberk ERP — V1.0 | Copyright © 2026 All rights reserved.</p>
    <div class="df-letterhead">
      <div class="df-letterhead-inner">
        <div class="df-brand-block">
          <svg class="df-mark" viewBox="0 0 64 64" aria-hidden="true">
            <path fill="#2dd4bf" d="M10 8h24c13.5 0 24 9.2 24 24S47.5 56 34 56H10V8z"/>
            <path fill="#fff" d="M22 18h12.5c7.5 0 13 5.4 13 14s-5.5 14-13 14H22V18z"/>
            <path fill="#818cf8" d="M10 28h42v8H10z"/>
          </svg>
          <div class="df-wordmark">
            <strong><span class="df-delkor">DELKOR</span><span class="df-hyphen">-</span><span class="df-fiberk">FIBERK</span></strong>
            <span>Delkor Logistics · Fiberk · Digital Retail and Hire Purchase Subsidiaries</span>
          </div>
        </div>
        <div class="df-contacts">
          <div><a href="tel:+233546443323">+233 54 644 3323</a></div>
          <div><a href="mailto:sales@delkorfiberk.com">sales@delkorfiberk.com</a></div>
          <div><a class="df-web" href="https://delkorfiberk.com" target="_blank" rel="noopener">delkorfiberk.com</a></div>
        </div>
      </div>
      <div class="df-bars" aria-hidden="true"><i></i><i></i></div>
    </div>
  </footer>`;
}



function ensureSiteFooter() {
  if (document.getElementById('df-site-foot')) return;
  if (document.body.classList.contains('pos-focus')) return;
  document.body.insertAdjacentHTML('beforeend', erpFooterHtml());
}

export function pageChrome(title, subtitle = '') {
  const sub = subtitle
    ? `<p class="sub">${esc(subtitle)}</p>`
    : '';
  return `${addonHeadHtml()}<div class="ult-chrome desk-head">
    <h1>${esc(title)}</h1>
    ${sub}
    ${deskJumpBar()}
  </div>`;
}



export async function mountShell(opts = {}) {
  await mountUltimateShell({ userLabel: opts.userName });
  let main = document.querySelector('.ult-main');
  if (!main) {
    main = document.createElement('main');
    main.className = 'ult-main';
    main.id = 'app';
    document.body.appendChild(main);
  }
  const content = document.createElement('div');
  content.id = 'page-content';
  main.appendChild(content);
  if (opts.title) {
    content.insertAdjacentHTML('beforebegin', pageChrome(opts.title));
  }
  return { contentEl: content };
}
