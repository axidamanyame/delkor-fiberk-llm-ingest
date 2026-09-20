/**
 * Axidigetek ERP — Role-Based Access Control
 * Permission IDs match roles.html matrix (product.view_purchase_price, sell.add, …)
 */
import { supabase, getAuthSession } from './supabaseClient.js';
import { findUser, isGated, staffFoundationNav } from './access-gate.js';
import { isOwnerRole, isHqRole, isShopManagerRole, isGroupOperatorRole, isHeadOfficeRole, roleKey } from './access-rules.js';
import { materializePerms } from './perm-catalog.js';
import { routePermMap, actionNeed, needForHref } from './menu-perms.js';
import { registerClickGuard, PRIORITY } from './click-router.js';
export { supabase };

/** @type {{ userId: string, email: string, roleName: string, permissions: Record<string, boolean>, isAdmin: boolean } | null} */
let _ctx = null;

const ADMIN_NAMES = new Set([
  'hq admin', 'hq_admin', 'hqadmin', 'admin', 'owner', 'founder', 'partner',
  'super admin', 'superadmin', 'shop manager', 'manager',
  'systems developer', 'it director',
]);

export const ROUTE_PERM = {
  'dashboard.html': null,
  'login.html': null,
  'profile.html': null,
  'users.html': 'user.view',
  'user-edit.html': 'user.view|user.add|user.edit',
  'user-view.html': 'user.view',
  'roles.html': 'role.view',
  'roles-edit.html': 'role.view|role.add|role.edit',
  'commission-agents.html': 'commission.view|user.view',
  'commission-agent-edit.html': 'commission.edit|user.edit',
  'audit-log.html': 'audit.view|user.view',
  'notification-log.html': 'audit.view|user.view',
  'announcements.html': 'comm.announcements|comm.access',
  'messages.html': 'comm.messages|comm.access',
  'calls.html': 'comm.calls|comm.access',
  'meetings.html': 'comm.meetings|comm.access',
  'comm-groups.html': 'comm.groups|comm.access',
  'communications.html': 'comm.access|essentials.todo_add|essentials.todo_edit|essentials.docs|essentials.memos|essentials.reminders',
  'academy.html': 'academy.access|home.view|essentials.kb',
  'suppliers.html': 'supplier.view_all|supplier.view_own|supplier.add',
  'supplier-form.html': 'supplier.add|supplier.edit',
  'customers.html': 'customer.view_all|customer.view_own|customer.add',
  'customer-form.html': 'customer.add|customer.edit',
  'customer-view.html': 'customer.view_all|customer.view_own',
  'customer-groups.html': 'customer.view_all|customer.view_own',
  'customer-group-edit.html': 'customer.add|customer.edit',
  'customer-groups-report.html': 'report.profit_loss|customer.view_all',
  'clients.html': 'customer.view_all|customer.view_own|contact.view',
  'client-form.html': 'customer.add|customer.edit|contact.view',
  'investors.html': 'customer.view_all|customer.view_own|contact.view',
  'partners.html': 'customer.view_all|customer.view_own|contact.view',
  'consultants.html': 'customer.view_all|customer.view_own|contact.view',
  'client-groups.html': 'customer.view_all|customer.view_own|contact.view',
  'supplier-groups.html': 'supplier.view_all|supplier.view_own|supplier.add',
  'group-edit.html': 'customer.add|customer.edit|supplier.add',
  'loyalty-cards.html': 'customer.view_all|customer.view_own',
  'import-contacts.html': 'customer.add|supplier.add',
  'migrated-data.html': 'user.view|product.add|customer.add|purchase.add',
  'migrated-review.html': 'user.view|product.add|customer.add|purchase.add',
  'migrated-archive.html': 'user.view|product.add|customer.add|purchase.add',
  'products.html': 'product.view',
  'update-price.html': 'product.edit',
  'print-labels.html': 'product.view',
  'variations.html': 'product.view',
  'import-products.html': 'product.add',
  'import-stock.html': 'ops.opening|ops.access|product.opening_stock',
  'price-groups.html': 'product.view',
  'units.html': 'product.view',
  'categories.html': 'product.view',
  'brands.html': 'product.view',
  'warranties.html': 'warranty.view|product.view',
  'purchase-orders.html': 'purchase.view_all|purchase.view_own',
  'purchase-catchup.html': 'purchase.view_all|purchase.view_own|purchase.add',
  'purchase-form.html': 'purchase.add|purchase.edit',
  'purchase-invoices.html': 'purchase.view_all|purchase.view_own',
  'purchase-invoice-form.html': 'purchase.add|purchase.edit|purchase.view_all|purchase.view_own',
  'paper-purchase.html': 'purchase.add|purchase.edit|purchase.view_all',
  'purchase-payments.html': 'purchase.view_all|purchase.add_payment',
  'debit-notes.html': 'purchase.view_all|purchase.view_own',
  'pos.html': 'cashier.role|pos.add',
  'pos-open.html': 'cashier.role|pos.add',
  'pos-sessions.html': 'pos.view|pos.add|cashier.role',
  'pos-sales.html': 'sell.view_all|sell.view_own|pos.view',
  'sales-orders.html': 'sell.view_all|sell.view_own|sell.add',
  'quotations.html': 'quotation.view_all|quotation.view_own',
  'sell-returns.html': 'sell.return_all|sell.return_own',
  'shipments.html': 'shipments.access_all|shipments.access_own',
  'discounts.html': 'sell.discount.view|sell.manage_discount',
  'stock-transfers.html': 'stock_transfer.view_all|stock_transfer.view_own',
  'stock-transfer-form.html': 'stock_transfer.add|stock_transfer.edit',
  'virtual-warehouse.html': 'ops.hub|ops.access|stock_transfer.view_all|stock_transfer.view_own',
  'receive-stock.html': 'ops.receive|ops.access|purchase.view_all|purchase.view_own|stock_transfer.view_all',
  'put-away.html': 'ops.putaway|ops.access|stock_transfer.view_all|stock_transfer.view_own',
  'stock-count.html': 'ops.count|ops.access|stock_adjustment.view_all|stock_adjustment.view_own|stock_adjustment.add',
  'stock-adjustments.html': 'stock_adjustment.view_all|stock_adjustment.view_own',
  'opening-stock.html': 'ops.opening|ops.access|product.opening_stock',
  'expenses.html': 'expense.view_all|expense.view_own|expense.add|expense.access_all',
  'expense-form.html': 'expense.add|expense.edit',
  'expense-categories.html': 'expense.view_all|expense.add|expense.access_all',
  'expense-import.html': 'expense.add',
  'finance.html': 'finance.access|finance.hub|account.access|account.view',
  'budgets.html': 'finance.dept_budget|finance.budgeting|accounting.budget|account.access',
  'accounting.html': 'account.view|account.access',
  'cheques.html': 'account.view|account.access',
  'reports.html': 'report.profit_loss|report.stock|report.collections|product.view|crm.leads_all|crm.leads_own',
  'settings.html': 'settings.business',
  'till-policy.html': 'settings.business',
  'business-locations.html': 'settings.business',
  'invoice-schemes.html': 'settings.business',
  'payment-settings.html': 'settings.business',
  'settings-extra.html': 'settings.business',
  'custom-dashboards.html': 'dashboard.manage|settings.business',
  'custom-dashboard-settings.html': 'dashboard.manage|settings.business',
  'custom-dashboard-edit.html': 'dashboard.manage|settings.business',
  'custom-dashboard-view.html': null,
  'payroll.html': 'essentials.payroll_view|hrm.view_all',
  'snnit.html': 'hrm.snnit|essentials.payroll_view',
  'crm.html': 'crm.leads_all|crm.leads_own',
  'call-centre.html': 'crm.leads_all|crm.leads_own',
  'collections-desk.html': 'collections.access|collections.operations|collections.accounts|collections.workflow|collections.strategy',
  'collections-home.html': 'collections.access|collections.operations',
  'collections-floor.html': 'collections.access|collections.operations',
  'collections-calls.html': 'collections.access|collections.operations',
  'collections-promises.html': 'collections.access|collections.operations',
  'collections-plans.html': 'collections.access|collections.operations',
  'collections-aging.html': 'collections.access|collections.accounts',
  'collections-escalations.html': 'collections.access|collections.workflow',
  'collections-publish.html': 'collections.access|collections.workflow',
  'collections.html': 'collections.access|collections.accounts',
  'assets.html': 'asset.view',
  'projects.html': 'project.view|project.create',
  'repair.html': 'repair.invoice_all|repair.invoice_own|repair.job_all|repair.job_assigned',
  'gra-tax.html': 'account.view',
  'mobile-money.html': 'account.view',
  'banking.html': 'finance.banks|finance.treasury|account.view|account.access|account.banking',
  'uba-fiberk.html': 'finance.uba|finance.treasury|account.view|account.access|account.banking',
  'ghana-banking.html': 'account.view',
  'crypto.html': 'account.view',
  'woocommerce.html': 'woo.api|woo.sync_products',
  'connector.html': 'connector.access',
  'spreadsheet.html': 'spreadsheet.access',
  'catalogue-qr.html': 'qr.view',
  'essentials.html': 'comm.access|essentials.todo_add|essentials.leave_all|essentials.leave_own',
  'orientation.html': null,
  'welcome-package.html': null,
  'training.html': null,
  'training-accounting.html': null,
  'field-ops.html': 'field_ops.view_all|field_ops.view_own|field_ops.floor',
  'wms.html': 'stock_transfer.view_all|stock_transfer.view_own|ops.access',
  'product-form.html': 'product.add|product.edit|product.view',
  'product-view.html': 'product.view',
  'category-edit.html': 'product.view',
  'brand-edit.html': 'product.view',
  'unit-edit.html': 'product.view',
  'warranty-edit.html': 'warranty.view|product.view',
  'purchase-returns.html': 'purchase.view_all|purchase.view_own',
  'purchase-return-form.html': 'purchase.add|purchase.edit',
  'sales-form.html': 'sell.add|sell.edit',
  'draft-form.html': 'sell.add|draft.view',
  'drafts.html': 'sell.view_all|sell.view_own|sell.add',
  'quotation-form.html': 'quotation.add|quotation.edit',
  'sell-return-form.html': 'sell.return_all|sell.return_own',
  'discount-form.html': 'sell.discount.add|sell.discount.edit|sell.manage_discount',
  'expense-form.html': 'expense.add|expense.edit',
  'stock-adjustment-form.html': 'stock_adjustment.add|stock_adjustment.edit',
  'stock-adjustments.html': 'stock_adjustment.view_all|stock_adjustment.view_own',
  'payment-accounts.html': 'finance.wallets|finance.treasury|account.view|account.access|account.banking',
  'account-balance-sheet.html': 'account.view|account.access',
  'account-trial-balance.html': 'account.view|account.access',
  'account-cash-flow.html': 'account.view|account.access',
  'payment-account-report.html': 'account.view|account.access',
  'invoice-settings.html': 'settings.business',
  'barcode-settings.html': 'settings.business',
  'printers.html': 'settings.business',
  'tax-rates.html': 'settings.business',
  'selling-price-groups.html': 'settings.business',
  'trending-products.html': 'report.profit_loss|product.view',
  'repair-catalog.html': 'repair.invoice_all|repair.invoice_own|repair.job_all|repair.job_assigned',
  'accounting-account-form.html': 'accounting.access|account.access',
  'accounting-journal-form.html': 'accounting.journal.view|accounting.access',
  'accounting-map-form.html': 'accounting.access',
  'accounting-type-form.html': 'settings.business',
  'accounting-transfer-form.html': 'accounting.transfer.view|accounting.access',
  'visit-form.html': 'field_ops.visits_add|field_ops.visits_edit|field_ops.view_own',
  'hrm.html': 'hrm.view_all|hrm.view_own|essentials.leave_all|essentials.leave_own|essentials.payroll_view',
  'ai-assistance.html': 'ai.access',
  'accounting-coa.html': 'accounting.access|account.access',
  'accounting-journal.html': 'accounting.journal.view|accounting.access',
  'accounting-transfer.html': 'finance.transfers|finance.treasury|accounting.transfer.view|accounting.access|account.access',
  'accounting-transactions.html': 'accounting.access|account.access',
  'accounting-budget.html': 'finance.annual_budget|finance.budgeting|accounting.budget|account.access',
  'accounting-reports.html': 'accounting.reports',
  'accounting-settings.html': 'settings.business',
  'accounting-bank-ledger.html': 'accounting.access|account.access',
  'accounting-reconciliation.html': 'accounting.access',
  'manufacturing.html': 'manufacturing.access',
  'crm-leads.html': 'crm.leads_all|crm.leads_own',
  'crm-followups.html': 'crm.leads_all|crm.leads_own',
  'crm-campaigns.html': 'crm.leads_all|crm.leads_own',
  'crm-contact-login.html': 'crm.leads_all|crm.leads_own',
  'crm-life-stages.html': 'crm.leads_all|crm.leads_own',
  'crm-proposals.html': 'crm.leads_all|crm.leads_own',
  'crm-sources.html': 'crm.leads_all|crm.leads_own',
  'contact-view.html': 'customer.view_all|customer.view_own|supplier.view_all|supplier.view_own',
  'contact-ledger.html': 'customer.view_all|customer.view_own|supplier.view_all|account.view',
  'product-catalog.html': 'product.view',
  'product-stock-history.html': 'product.view|report.stock_history|ops.access',
  'inventory.html': 'product.view',
  'purchases.html': 'purchase.view_all|purchase.view_own',
  'sales.html': 'sell.view_all|sell.view_own',
  'orders.html': 'sell.view_all|sell.view_own',
  'sells.html': 'sell.view_all|sell.view_own',
  'import-sales.html': 'sell.add',
  'attendance.html': 'hrm.view_all|hrm.view_own|essentials.leave_own',
  'leave.html': 'essentials.leave_all|essentials.leave_own|hrm.view_own',
  'leave-types.html': 'hrm.view_all|essentials.leave_all',
  'holidays.html': 'hrm.holiday.view|hrm.holiday|hrm.view_all',
  'departments.html': 'hrm.view_all',
  'designations.html': 'hrm.view_all',
  'sales-targets.html': 'hrm.targets|hrm.view_all',
  'todos.html': 'essentials.todo_add|essentials.todo_edit',
  'documents.html': 'essentials.todo_add',
  'memos.html': 'essentials.todo_add',
  'notifications.html': 'settings.notifications|audit.view',
  'backup.html': 'settings.backup',
  'sms-settings.html': 'settings.notifications|settings.business',
  'printers.html': 'settings.printers|settings.business',
  'modules.html': 'settings.business',
  'manual.html': 'settings.business',
  'module-form.html': 'settings.business',
  'users-rbac.html': 'user.view',
  'products-rbac.html': 'product.view',
  'till-login.html': 'cashier.role|pos.add',
  'repair-till.html': 'repair.invoice_all|repair.invoice_own|pos.add',
  'repair-jobs.html': 'repair.job_all|repair.job_assigned',
  'repair-invoices.html': 'repair.invoice_all|repair.invoice_own',
  'repair-job-status.html': 'repair.job_all|repair.job_assigned',
  'spreadsheets.html': 'spreadsheet.access',
  'fiberk-bank.html': 'account.banking|account.access|finance.banks',
  'banks.html': 'finance.banks|account.banking|account.access',
  'fund-transfer.html': 'finance.transfers|accounting.transfer.view|account.access',
  'location-pay-accounts.html': 'finance.wallets|account.access',
  'customer-receipts.html': 'sell.view_all|sell.view_own|account.view',
  'sell-payments.html': 'sell.view_all|sell.view_own',
  'cash-register.html': 'cash_register.view|pos.view',
  'till-alerts.html': 'cash_register.view|cash_register.close',
  'chat.html': 'comm.messages|comm.access',
  'visits.html': 'field_ops.view_all|field_ops.view_own',
  'stock.html': 'product.view|ops.access',
  'operations.html': 'ops.access',
  'ops-desk.html': 'ops.access',
  'report-profit-loss.html': 'report.profit_loss',
  'report-tax.html': 'report.tax',
  'report-expense.html': 'report.expense',
  'report-stock.html': 'report.stock',
  'report-stock-value.html': 'report.stock_value',
  'report-trending.html': 'report.trending',
  'report-register.html': 'report.register',
  'report-sales-rep.html': 'report.sales_rep',
  'report-purchase-sell.html': 'report.purchase_sell',
  'report-contacts.html': 'report.supplier_customer',
  'reports-hub.html': 'report.profit_loss|report.stock|product.view',
  'collections-accounts.html': 'collections.access|collections.accounts',
  'collections-import-crm.html': 'collections.access|crm.leads_all',
  'import-users.html': 'user.add|user.edit',
  'dashboard-groups.html': 'settings.business|dashboard.manage',
  'packages.html': 'superadmin.packages',
  'abac-explorer.html': 'role.view|user.view',
};

try {
  Object.entries(routePermMap()).forEach(([file, need]) => {
    ROUTE_PERM[file] = need;
  });
} catch { /* menu map optional */ }

/**
 * Load session + role permissions from app_roles.
 * Cashier / empty permission maps are NOT treated as admin.
 */
export async function loadAccess() {
  if (_ctx) {
    try { installActionGuard(); } catch { /* ignore */ }
    return _ctx;
  }

  const session = await getAuthSession();
  if (!session) {
    if (!/\/login\.html/i.test(location.pathname || '')) location.href = '/login.html';
    return null;
  }

  const userId = session.user.id;
  const email = session.user.email || '';
  const local = findUser({ id: userId, email });

  let profile = null;
  try {
    const q = await Promise.race([
      supabase.from('profiles').select('full_name, role, role_id, role_name, designation, dashboard_group').eq('id', userId).maybeSingle(),
      new Promise((resolve) => setTimeout(() => resolve({ data: null }), 4000)),
    ]);
    profile = q?.data || null;
  } catch { profile = null; }
  try {
    const { applyStaffJob, persistStaffJob, publicJobLabel } = await import('./staff-jobs.js');
    const before = profile || {};
    const patched = applyStaffJob({ ...before, ...(local || {}), email, id: userId }, email, local?.username);
    if (patched) {
      const needsWrite = String(patched.role || '') !== String(before.role_name || before.role || '')
        || String(patched.designation || '') !== String(before.designation || '');
      profile = { ...before, ...patched };
      if (needsWrite) persistStaffJob(patched).catch(() => {});
    }
  } catch { /* named jobs optional */ }

  let roleName = profile?.role_name || profile?.role || '';
  let permissions = {};
  let roleRow = null;
  try {
    const named = String(profile?.role_name || profile?.role || '').trim();
    const looksUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(profile?.role_id || ''));
    if (looksUuid) {
      const r = await Promise.race([
        supabase.from('app_roles').select('*').eq('id', profile.role_id).maybeSingle(),
        new Promise((resolve) => setTimeout(() => resolve({ data: null }), 3000)),
      ]);
      roleRow = r?.data;
      if (roleRow && named && String(roleRow.name || '').toLowerCase() !== named.toLowerCase()) {
        roleRow = null;
      }
    }
    if (!roleRow && named) {
      const r = await Promise.race([
        supabase.from('app_roles').select('*').ilike('name', named).maybeSingle(),
        new Promise((resolve) => setTimeout(() => resolve({ data: null }), 3000)),
      ]);
      roleRow = r?.data;
    }
  } catch { roleRow = null; }

  if (!roleRow) {
    try {
      const { loadRows } = await import('./ls-rows.js');
      const { KEYS, SEED_ROLES } = await import('./catalog-seed.js');
      const localRoles = await loadRows('app_roles', KEYS.roles, SEED_ROLES);
      const rid = profile?.role_id || local?.role_id;
      roleRow = (localRoles || []).find((r) => String(r.id) === String(rid))
        || (localRoles || []).find((r) => String(r.name || '').toLowerCase() === String(roleName).toLowerCase())
        || null;
    } catch { /* ignore */ }
  }

  const localUser = local;
  /* Role comes from the profile row, not Auth metadata (that field is the
     public position, or leftover HQ Admin from older SQL). */
  roleName = String(profile?.role_name || profile?.role || roleRow?.name || 'Pending').trim()
    || 'Pending';

  if (roleRow) {
    permissions = materializePerms(normalizePerms(roleRow.permissions), roleName);
    try {
      const localRoles = JSON.parse(localStorage.getItem('df_roles') || '[]');
      const i = (localRoles || []).findIndex((r) =>
        String(r.id) === String(roleRow.id)
        || String(r.name || '').toLowerCase() === String(roleName || '').toLowerCase()
      );
      if (i >= 0) {
        localRoles[i] = { ...localRoles[i], permissions: roleRow.permissions || {} };
        localStorage.setItem('df_roles', JSON.stringify(localRoles));
      }
    } catch { /* ignore */ }
  } else {
    try {
      const localRoles = JSON.parse(localStorage.getItem('df_roles') || '[]');
      const localHit = (localRoles || []).find((r) =>
        String(r.name || '').toLowerCase() === String(roleName || '').toLowerCase()
      );
      if (localHit?.permissions) {
        permissions = materializePerms(normalizePerms(localHit.permissions), roleName);
      }
    } catch { /* ignore */ }
  }

  const overlay = readPermOverlay();
  if (overlay && overlay.permissions && (
    (roleRow && String(overlay.roleId) === String(roleRow.id))
    || String(overlay.roleName || '').toLowerCase() === String(roleName || '').toLowerCase()
  )) {
    permissions = materializePerms(normalizePerms(overlay.permissions), roleName);
  }

  const gated = (isHqRole(roleName) || isOwnerRole(roleName))
    ? false
    : (localUser ? isGated(localUser) : isPendingStaff(roleName));
  if (gated) {
    permissions = {};
  }

  let jobLabel = roleName;
  let moduleFlags = {};
  try {
    const { publicJobLabel } = await import('./staff-jobs.js');
    jobLabel = publicJobLabel({ ...(profile || {}), email }, email) || roleName;
  } catch { /* ignore */ }
  try {
    const { roleGrantMap, hydrateGrantsFromRows } = await import('./module-grants.js');
    let localRoles = [];
    try { localRoles = JSON.parse(localStorage.getItem('df_roles') || '[]'); } catch { localRoles = []; }
    hydrateGrantsFromRows(roleRow ? [roleRow, ...localRoles] : localRoles, []);
    if (roleRow?.module_flags && typeof roleRow.module_flags === 'object') {
      moduleFlags = { ...roleRow.module_flags };
    }
    const granted = roleGrantMap(roleName);
    Object.keys(granted || {}).forEach((k) => {
      if (!Object.prototype.hasOwnProperty.call(moduleFlags, k)) moduleFlags[k] = granted[k];
    });
  } catch { /* grants optional */ }

  _ctx = {
    userId,
    email,
    fullName: profile?.full_name || email.split('@')[0],
    roleName,
    jobLabel,
    designation: profile?.designation || jobLabel,
    permissions,
    moduleFlags,
    isAdmin: permissions['*'] === true || isHqRole(roleName) || isOwnerRole(roleName),
    gated,
  };
  try {
    const { hydrateGrantsFromRows } = await import('./module-grants.js');
    let roles = [];
    let users = [];
    try { roles = JSON.parse(localStorage.getItem('df_roles') || '[]'); } catch { roles = []; }
    try { users = JSON.parse(localStorage.getItem('df_users') || '[]'); } catch { users = []; }
    if (roleRow) roles = [roleRow, ...roles];
    if (localUser) users = [localUser, ...users];
    hydrateGrantsFromRows(roles, users);
  } catch { /* grants stay on device */ }
  try { installActionGuard(); } catch { /* ignore */ }
  return _ctx;
}

function normalizePerms(p) {
  if (!p) return {};
  if (Array.isArray(p)) return Object.fromEntries(p.map(id => [id, true]));
  if (typeof p === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(p)) out[k] = !!v;
    return out;
  }
  return {};
}

export function getAccess() {
  return _ctx;
}

export function resetAccess() {
  _ctx = null;
}

const PERM_OVERLAY_KEY = 'df_role_perm_apply';

export function writePermOverlay(roleId, roleName, permissions) {
  try {
    sessionStorage.setItem(PERM_OVERLAY_KEY, JSON.stringify({
      roleId: String(roleId || ''),
      roleName: String(roleName || ''),
      permissions: permissions || {},
    }));
  } catch { /* ignore */ }
}

export function readPermOverlay() {
  try { return JSON.parse(sessionStorage.getItem(PERM_OVERLAY_KEY) || 'null'); } catch { return null; }
}

export function clearPermOverlay() {
  try { sessionStorage.removeItem(PERM_OVERLAY_KEY); } catch { /* ignore */ }
}

export function patchLivePerms(permissions, roleName) {
  if (!_ctx) return _ctx;
  const name = roleName || _ctx.roleName;
  _ctx.permissions = materializePerms(normalizePerms(permissions), name);
  _ctx.isAdmin = _ctx.permissions['*'] === true;
  return _ctx;
}

/** Leadership (Founder/Owner/HQ) is a full desk. Everyone else is ticks only. */
export function can(permId) {
  if (!_ctx) return false;
  if (_ctx.gated) return false;
  if (!permId) return false;
  if (permId.includes('|')) return permId.split('|').some((p) => can(p.trim()));
  if (isHqRole(_ctx.roleName) || isOwnerRole(_ctx.roleName) || _ctx.isAdmin) return true;
  if (_ctx.permissions[permId] === true) return true;
  if (permId.endsWith('.view')) {
    const stem = permId.slice(0, -5);
    return _ctx.permissions[stem + '.view_all'] === true
      || _ctx.permissions[stem + '.view_own'] === true;
  }
  return false;
}

/** Shop till duty — not HQ/Owner. Sales Associate gets this from the Cashier tick. */
export function isTillCashier() {
  if (!_ctx || _ctx.gated) return false;
  if (isHqRole(_ctx.roleName) || isOwnerRole(_ctx.roleName)) return false;
  return _ctx.permissions['cashier.role'] === true || _ctx.permissions['pos.add'] === true;
}

/** View (and menu ticks) = see. Add/Edit/Delete never grant seeing. */
export function canSee(permId) {
  if (!permId) return false;
  if (permId.includes('|')) return permId.split('|').some((p) => canSee(p.trim()));
  if (/\.(add|edit|update|delete)$/i.test(permId)) {
    const stem = permId.replace(/\.(add|edit|update|delete)$/i, '');
    return can(stem + '.view') || can(stem + '.view_all') || can(stem + '.view_own') || can(stem);
  }
  return can(permId);
}

export function canAdd(stemOrKey) {
  const stem = String(stemOrKey || '').replace(/\.(view_all|view_own|view|add|edit|update|delete)$/i, '');
  return can(stemOrKey) || can(stem + '.add');
}

export function canEdit(stemOrKey) {
  const stem = String(stemOrKey || '').replace(/\.(view_all|view_own|view|add|edit|update|delete)$/i, '');
  return can(stemOrKey) || can(stem + '.edit') || can(stem + '.update');
}

export function canDelete(stemOrKey) {
  const stem = String(stemOrKey || '').replace(/\.(view_all|view_own|view|add|edit|update|delete)$/i, '');
  return can(stemOrKey) || can(stem + '.delete');
}

export function isPendingStaff(roleName) {
  return /^pending$/i.test(String(roleName || '').replace(/[\s_-]/g, ''));
}

export function isOfficeStaff(roleName, adminFlag) {
  if (adminFlag || isHeadOfficeRole(roleName)) return true;
  return false;
}

export function isFrontlineStaff(roleName, adminFlag) {
  return false;
}

const FRONTLINE_PAGES = new Set([
  'dashboard.html', 'login.html', 'profile.html', 'go-home.html', 'calendar.html',
  'cashier-home.html', 'agent-home.html', 'customer-home.html', 'supplier-home.html',
  'pos.html', 'pos-open.html', 'pos-sessions.html', 'pos-sales.html', 'till-login.html',
  'repair-till.html', 'customer-display.html', 'custom-dashboard-view.html',
  'orientation.html', 'welcome-package.html', 'training.html', 'training-accounting.html',
  'manual.html',
  'field-ops.html', 'visit-form.html',
  'announcements.html', 'messages.html', 'calls.html', 'meetings.html', 'comm-groups.html', 'communications.html',
  'academy.html',
]);

const OPEN_PAGES = new Set([
  'dashboard.html', 'login.html', 'index.html', 'profile.html', 'go-home.html',
  'calendar.html', 'orientation.html', 'welcome-package.html', 'training.html',
  'training-accounting.html', 'manual-fiberkapp.html',
  'receipt.html', 'customer-display.html', 'catalogue-view.html',
]);

const COLOR_MOD_PERM = {
  ai: 'ai.access',
  accounting: 'accounting.access|account.access',
  assets: 'asset.view',
  qr: 'qr.view',
  connector: 'connector.access',
  callcentre: 'crm.leads_all|crm.leads_own',
  crm: 'crm.leads_all|crm.leads_own',
  dashboard: 'dashboard.manage|dashboard.view',
  academy: 'academy.access|home.view|essentials.kb',
  communications: 'comm.access|essentials.todo_add|essentials.todo_edit|essentials.docs|essentials.memos|essentials.reminders',
  essentials: 'essentials.todo_add|essentials.todo_edit|essentials.leave_all|essentials.leave_own',
  fieldops: 'field_ops.view_all|field_ops.view_own|field_ops.floor',
  hrm: 'hrm.view_all|hrm.view_own',
  mfg: 'manufacturing.access',
  project: 'project.view|project.create',
  repair: 'repair.invoice_all|repair.invoice_own|repair.job_all|repair.job_assigned',
  sheet: 'spreadsheet.access',
  wms: 'stock_transfer.view_all|stock_transfer.view_own|ops.access',
  woo: 'woo.api|woo.sync_products',
};

function parseHref(href) {
  const raw = String(href || '');
  try {
    const u = new URL(raw, (typeof location !== 'undefined' && location.origin) || 'https://erp.local');
    return {
      file: (u.pathname.split('/').pop() || 'dashboard.html').toLowerCase(),
      search: u.searchParams,
    };
  } catch {
    const [path, qs] = raw.split('?');
    return {
      file: (path.split('/').pop() || 'dashboard.html').toLowerCase(),
      search: new URLSearchParams(qs || ''),
    };
  }
}

export function canOpenPage(hrefOrFile) {
  const src = hrefOrFile || (typeof location !== 'undefined' ? location.pathname + location.search : '');
  const { file, search } = parseHref(src);
  const name = file || 'dashboard.html';
  if (OPEN_PAGES.has(name)) return true;
  if (!_ctx) return false;
  if (_ctx && _ctx.gated) {
    return name === 'orientation.html' || name === 'welcome-package.html' || name === 'training.html'
      || name === 'training-accounting.html' || name === 'manual.html'
      || name === 'profile.html' || name === 'login.html';
  }
  if (name === 'color-report.html' || name === 'color-setup.html') {
    const m = search.get('m') || '';
    const need = COLOR_MOD_PERM[m];
    return !!(need && canSee(need));
  }
  if (isHqRole(_ctx.roleName) || isOwnerRole(_ctx.roleName) || _ctx.isAdmin) return true;
  const need = ROUTE_PERM[name];
  if (need === undefined) return false;
  return canSee(need);
}

export function filterNav(items, depth = 0) {
  if (!_ctx) return [];
  if (_ctx && _ctx.gated) {
    return staffFoundationNav('/orientation.html');
  }
  const out = (items || [])
    .map((item) => {
      const color = !!(item.color || item.textColor);
      const children = item.children ? filterNav(item.children, depth + 1) : null;
      const pages = item.pages
        ? (color
          ? item.pages
          : item.pages.filter((p) => {
              const file = (p.href || '').split('/').pop()?.split('?')[0] || '';
              if (file === 'color-report.html' || file === 'color-setup.html') return canOpenPage(p.href);
              const need = p.perm || needForHref(p.href) || ROUTE_PERM[file];
              if (!need) return OPEN_PAGES.has(file);
              return canSee(need);
            }))
        : null;
      if (color) {
        return { ...item, ...(children ? { children } : {}), ...(pages ? { pages } : {}) };
      }
      if (children && children.length) return { ...item, children, ...(pages ? { pages } : {}) };
      if (pages && pages.length) return { ...item, pages };
      const file = (item.href || '').split('/').pop()?.split('?')[0] || '';
      const need = item.perm || needForHref(item.href) || ROUTE_PERM[file];
      if (!need) return OPEN_PAGES.has(file) ? item : null;
      if (!canSee(need)) return null;
      if (!item.href) return null;
      return item;
    })
    .filter(Boolean);
  if (depth === 0 && (isHqRole(_ctx.roleName) || isOwnerRole(_ctx.roleName))) {
    const door = [
      { href: '/settings.html', label: 'Business Settings' },
      { href: '/till-policy.html', label: 'Till & staff hours' },
      { href: '/roles.html', label: 'Roles' },
      { href: '/users.html', label: 'Users' },
    ];
    const i = out.findIndex((x) => /^system$/i.test(x.label));
    if (i < 0) {
      out.push({ label: 'System', icon: 'cog', children: door });
    } else {
      const kids = [...(out[i].children || [])];
      door.forEach((d) => {
        if (!kids.some((k) => (k.href || '') === d.href || (k.children || []).some((c) => c.href === d.href))) {
          kids.push(d);
        }
      });
      out[i] = { ...out[i], children: kids };
    }
  }
  return out;
}

export function enforcePageAccess() {
  if (!_ctx) return true;
  const here = (typeof location !== 'undefined' ? location.pathname + location.search : '');
  if (canOpenPage(here)) return true;
  const file = (here.split('/').pop() || 'dashboard.html').split('?')[0].toLowerCase();
  if (_ctx.gated) {
    if (file !== 'orientation.html') location.replace('/orientation.html');
    return false;
  }
  if (file === 'dashboard.html') return true;
  try { document.documentElement.dataset.rbacDenied = '1'; } catch { /* ignore */ }
  const app = document.getElementById('app');
  if (app) app.innerHTML = '';
  location.replace('/dashboard.html');
  return false;
}

/** Throw / redirect if missing permission. */
export function requirePerm(permId, redirectTo = '/dashboard.html') {
  if (can(permId)) return true;
  alert('Access denied: ' + permId + '\nYour role: ' + (_ctx?.roleName || '?'));
  if (redirectTo) location.href = redirectTo;
  return false;
}

/**
 * Hide elements with data-perm="product.view_purchase_price"
 * Show only if can(perm). data-perm-any="a|b"
 */
export function applyDomPermissions(root = document) {
  const hide = (el) => { el.style.display = 'none'; el.setAttribute('hidden', ''); };
  const show = (el) => { el.style.display = ''; el.removeAttribute('hidden'); };
  root.querySelectorAll('[data-perm]').forEach(el => {
    const need = el.getAttribute('data-perm');
    if (can(need)) show(el); else hide(el);
  });
  root.querySelectorAll('[data-perm-any]').forEach(el => {
    const need = el.getAttribute('data-perm-any');
    if (can(need)) show(el); else hide(el);
  });
  const page = (typeof location !== 'undefined' ? location.pathname : '').split('/').pop() || '';
  root.querySelectorAll('[data-act], [data-record-view], [data-del], [data-edit], [data-bulk-del], [data-bulk-edit], .btn-edit, .btn-del, .btn-view, .erp-add, .tbl-bulk-del').forEach((el) => {
    if (el.hasAttribute('data-perm') || el.hasAttribute('data-perm-any')) return;
    const act = el.getAttribute?.('data-act')
      || (el.hasAttribute?.('data-record-view') || el.classList?.contains('btn-view') ? 'view' : '')
      || (el.classList?.contains('btn-edit') || el.hasAttribute?.('data-bulk-edit') || el.hasAttribute?.('data-edit') ? 'edit' : '')
      || (el.classList?.contains('btn-del') || el.hasAttribute?.('data-bulk-del') || el.hasAttribute?.('data-del') || el.classList?.contains('tbl-bulk-del') ? 'delete' : '')
      || (el.classList?.contains('erp-add') ? 'add' : '');
    if (!act) return;
    const need = actionNeed(act, page);
    if (!need) return;
    if (!can(need)) hide(el);
  });
}

let _actGuard = false;
export function installActionGuard() {
  if (_actGuard) return;
  _actGuard = true;
  registerClickGuard({
    name: 'rbac-action',
    priority: PRIORITY.lock,
    match: (origin) => origin?.closest?.('[data-act], [data-record-view], a[href*="-form"], a[href*="-edit"], a[href*="new=1"], .btn-edit, .btn-del, .btn-view'),
    claim: (el, e) => {
      const origin = el.closest?.('[data-act], [data-record-view], a[href], .btn-edit, .btn-del, .btn-view') || el;
      const act = origin.getAttribute?.('data-act')
        || (origin.classList?.contains('btn-edit') ? 'edit' : '')
        || (origin.classList?.contains('btn-del') ? 'delete' : '')
        || (origin.classList?.contains('btn-view') || origin.hasAttribute?.('data-record-view') ? 'view' : '')
        || (/\bnew=1\b|-form\.html/i.test(origin.getAttribute?.('href') || '') ? 'add' : '')
        || (/-edit\.html/i.test(origin.getAttribute?.('href') || '') ? 'edit' : '');
      const file = (() => {
        const href = origin.getAttribute?.('href') || '';
        if (href) return href.split('?')[0].split('/').pop();
        return (typeof location !== 'undefined' ? location.pathname : '').split('/').pop();
      })();
      const marked = origin.getAttribute?.('data-perm') || origin.getAttribute?.('data-perm-any') || '';
      const need = marked || actionNeed(act, file);
      if (!need || !act) return 'pass';
      if (can(need)) return 'pass';
      e.preventDefault();
      e.stopPropagation();
      try { window.alert('This action is not allowed for your role.'); } catch { /* ignore */ }
      return 'claim';
    },
  });
}

/** Mask purchase/cost price cells when user lacks product.view_purchase_price */
export function maskPurchasePrices(root = document) {
  if (can('product.view_purchase_price')) return;
  root.querySelectorAll('[data-cost], .cost-price, .purchase-price, [data-field="cost_price"]').forEach(el => {
    el.textContent = '••••';
    el.title = 'Hidden — role cannot view purchase price';
  });
}

/**
 * Menu items: { href, label, perm?, children? }
 * Filters out entries the user cannot access.
 */
export function filterMenu(items) {
  return items
    .map(item => {
      if (item.children) {
        const children = filterMenu(item.children);
        if (!children.length && item.perm && !can(item.perm)) return null;
        if (!children.length && !item.href) return null;
        return { ...item, children };
      }
      if (item.perm && !can(item.perm)) return null;
      return item;
    })
    .filter(Boolean);
}

/** Default menu with permission tags */
export const MENU_WITH_PERMS = [
  { href: '/dashboard.html', label: 'Home', icon: '🏠' },
  {
    label: 'Contacts', icon: '📒', perm: 'contact.view',
    children: [
      { href: '/suppliers.html', label: 'Suppliers', perm: 'contact.view' },
      { href: '/supplier-groups.html', label: 'Supplier Groups', perm: 'contact.view' },
      { href: '/customers.html', label: 'Customers', perm: 'contact.view' },
      { href: '/customer-groups.html', label: 'Customer Groups', perm: 'contact.view' },
      { href: '/client-groups.html', label: 'Client Groups', perm: 'contact.view' },
      { href: '/investors.html', label: 'Investors', perm: 'contact.view' },
      { href: '/partners.html', label: 'Partners', perm: 'contact.view' },
      { href: '/consultants.html', label: 'Consultants', perm: 'contact.view' },
      { href: '/crm.html', label: 'CRM', perm: 'contact.view' },
    ],
  },
  {
    label: 'Products', icon: '📦', perm: 'product.view',
    children: [
      { href: '/products.html', label: 'List Products', perm: 'product.view' },
      { href: '/product-form.html', label: 'Add Product', perm: 'product.add' },
      { href: '/update-price.html', label: 'Update Price', perm: 'product.edit' },
      { href: '/stock.html', label: 'Stock', perm: 'stock.view' },
    ],
  },
  {
    label: 'Purchases', icon: '⬇️', perm: 'purchase.view',
    children: [
      { href: '/purchase-orders.html', label: 'List Purchases', perm: 'purchase.view' },
      { href: '/purchase-orders.html#add', label: 'Add Purchase', perm: 'purchase.add' },
    ],
  },
  {
    label: 'Sell', icon: '⬆️', perm: 'sell.view|sell.add',
    children: [
      { href: '/pos.html', label: 'POS', perm: 'sell.add' },
      { href: '/sales-orders.html', label: 'All Sales', perm: 'sell.view' },
    ],
  },
  {
    label: 'Reports', icon: '📊',
    children: [
      { href: '/reports.html', label: 'Reports', perm: 'report.profit_loss|report.stock' },
      { href: '/accounting.html', label: 'Accounting', perm: 'account.view|account.trial_balance' },
    ],
  },
  {
    label: 'Settings', icon: '⚙️', perm: 'settings.business',
    children: [
      { href: '/settings.html', label: 'Business Settings', perm: 'settings.business' },
      { href: '/till-policy.html', label: 'Till policy', perm: 'settings.business' },
      { href: '/profile.html', label: 'Profile' },
      {
        label: 'User Management', perm: 'user.view|settings.roles',
        children: [
          { href: '/users.html', label: 'Users', perm: 'user.view' },
          { href: '/roles.html', label: 'Roles', perm: 'settings.roles' },
          { href: '/commission-agents.html', label: 'Commission Agents', perm: 'user.view' },
        ],
      },
    ],
  },
  { href: '/payroll.html', label: 'Payroll', icon: '👷', perm: 'user.view' },
  { href: '/communications.html', label: 'Communications', icon: '📋' },
];

export async function requireAuthAndAccess() {
  const ctx = await loadAccess();
  return ctx;
}
