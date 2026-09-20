/** Delkor-Fiberk ERP permission catalog — source of truth for roles + later menu deepening. */
import { isOwnerRole } from './access-rules.js';
import { screenPermGroups, expandLegacyMenuPerms, FORM_ORDER } from './menu-perms.js';
export const PERM_GROUPS = [
  {
    code: 'cashier', label: 'Cashier',
    perms: [
      { key: 'cashier.role', label: 'Cashier role — may log in to the till (Sales Associate task)' },
      { key: 'cashier.line', label: 'Assign cashier staff on a product line' },
    ],
  },
  {
    code: 'others', label: 'Others',
    perms: [
      { key: 'others.export', label: 'View export to buttons (csv/excel/print/pdf) on tables' },
      { key: 'others.payment_received_notify', label: 'Send Payment Received Notification' },
      { key: 'others.payment_reminder_notify', label: 'Send Payment Reminder Notification' },
    ],
  },
  {
    code: 'user', label: 'User',
    perms: [
      { key: 'user.view', label: 'View user' },
      { key: 'user.add', label: 'Add user' },
      { key: 'user.edit', label: 'Edit user' },
      { key: 'user.delete', label: 'Delete user' },
    ],
  },
  {
    code: 'roles', label: 'Roles',
    perms: [
      { key: 'role.view', label: 'View role' },
      { key: 'role.add', label: 'Add Role' },
      { key: 'role.edit', label: 'Edit Role' },
      { key: 'role.delete', label: 'Delete role' },
    ],
  },
  {
    code: 'academy', label: 'Academy',
    perms: [
      { key: 'academy.access', label: 'Access Academy' },
      { key: 'academy.manuals', label: 'Staff user manuals' },
      { key: 'academy.kb', label: 'Knowledge base' },
      { key: 'academy.policies', label: 'Company policies' },
      { key: 'academy.view', label: 'View Academy articles' },
      { key: 'academy.add', label: 'Add Academy articles' },
      { key: 'academy.edit', label: 'Edit Academy articles' },
      { key: 'academy.delete', label: 'Delete Academy articles' },
    ],
  },
  {
    code: 'communications', label: 'Communications',
    perms: [
      { key: 'essentials.todo_assign', label: "Assign To Do's to others" },
      { key: 'essentials.todo_add', label: "Add To Do's" },
      { key: 'essentials.todo_edit', label: "Edit To Do's" },
      { key: 'essentials.todo_delete', label: "Delete To Do's" },
    ],
  },
  {
    code: 'ops_hub', label: 'Operations Hub',
    perms: [
      { key: 'ops.access', label: 'Access Operations Hub menu' },
      { key: 'ops.hub', label: 'Hub board' },
      { key: 'ops.receive', label: 'Receive stock' },
      { key: 'ops.putaway', label: 'Put away' },
      { key: 'ops.count', label: 'Stock count / audit' },
      { key: 'ops.opening', label: 'Opening stock' },
    ],
  },
  {
    code: 'collections', label: 'Collections',
    perms: [
      { key: 'collections.access', label: 'Access Collections menu' },
      { key: 'collections.operations', label: 'Operations (dashboard, floor, calls, PTP)' },
      { key: 'collections.accounts', label: 'Accounts & analysis' },
      { key: 'collections.workflow', label: 'Workflow & escalation' },
      { key: 'collections.strategy', label: 'Strategy & rules' },
    ],
  },
  {
    code: 'supplier', label: 'Supplier',
    radio: 'supplier.view_scope',
    radios: [
      { key: 'supplier.view_all', label: 'View all supplier' },
      { key: 'supplier.view_own', label: 'View own supplier' },
    ],
    perms: [
      { key: 'supplier.add', label: 'Add supplier' },
      { key: 'supplier.edit', label: 'Edit supplier' },
      { key: 'supplier.delete', label: 'Delete supplier' },
    ],
  },
  {
    code: 'customer', label: 'Customer', info: true,
    radio: 'customer.view_scope',
    radios: [
      { key: 'customer.view_all', label: 'View all customer' },
      { key: 'customer.view_own', label: 'View own customer' },
    ],
    radio2: 'customer.inactive_scope',
    radios2: [
      { key: 'customer.no_sell_1m', label: 'View customers with no sell from one month only' },
      { key: 'customer.no_sell_3m', label: 'View customers with no sell from three months only' },
      { key: 'customer.no_sell_6m', label: 'View customers with no sell from six months only' },
      { key: 'customer.no_sell_1y', label: 'View customers with no sell from one year only' },
      { key: 'customer.no_sell_any', label: 'View customers irrespective of their sell' },
    ],
    perms: [
      { key: 'customer.add', label: 'Add customer' },
      { key: 'customer.edit', label: 'Edit customer' },
      { key: 'customer.delete', label: 'Delete customer' },
    ],
  },
  {
    code: 'product', label: 'Product',
    perms: [
      { key: 'product.view', label: 'View product' },
      { key: 'product.add', label: 'Add product' },
      { key: 'product.edit', label: 'Edit product' },
      { key: 'product.delete', label: 'Delete product' },
      { key: 'product.opening_stock', label: 'Add Opening Stock' },
      { key: 'product.view_purchase_price', label: 'View Purchase Price', info: true },
    ],
  },
  {
    code: 'manufacturing', label: 'Manufacturing',
    perms: [
      { key: 'manufacturing.access', label: 'Access Manufacturing menu' },
    ],
  },
  {
    code: 'purchase', label: 'Purchase',
    radio: 'purchase.view_scope',
    radios: [
      { key: 'purchase.view_all', label: 'View all Purchase' },
      { key: 'purchase.view_own', label: 'View own Purchase' },
    ],
    perms: [
      { key: 'purchase.add', label: 'Add purchase' },
      { key: 'purchase.edit', label: 'Edit purchase' },
      { key: 'purchase.delete', label: 'Delete purchase' },
      { key: 'purchase.add_payment', label: 'Add purchase payment' },
      { key: 'purchase.edit_payment', label: 'Edit purchase payment' },
      { key: 'purchase.delete_payment', label: 'Delete purchase payment' },
      { key: 'purchase.update_status', label: 'Update Status' },
      { key: 'purchase.hide_price', label: 'Hide Price Details', info: true },
    ],
  },
  {
    code: 'stock_adjustment', label: 'Stock Adjustment',
    radio: 'stock_adjustment.view_scope',
    radios: [
      { key: 'stock_adjustment.view_all', label: 'View all stock adjustment' },
      { key: 'stock_adjustment.view_own', label: 'View own stock adjustment' },
    ],
    perms: [
      { key: 'stock_adjustment.add', label: 'Add stock adjustment' },
      { key: 'stock_adjustment.edit', label: 'Edit stock adjustment' },
      { key: 'stock_adjustment.delete', label: 'Delete stock adjustment' },
    ],
  },
  {
    code: 'stock_transfer', label: 'Stock Transfer',
    radio: 'stock_transfer.view_scope',
    radios: [
      { key: 'stock_transfer.view_all', label: 'View all stock transfer' },
      { key: 'stock_transfer.view_own', label: 'View own stock transfer' },
    ],
    perms: [
      { key: 'stock_transfer.add', label: 'Add stock transfer' },
      { key: 'stock_transfer.edit', label: 'Edit stock transfer' },
      { key: 'stock_transfer.delete', label: 'Delete stock transfer' },
    ],
  },
  {
    code: 'pos', label: 'POS',
    perms: [
      { key: 'pos.view', label: 'View POS sell' },
      { key: 'pos.add', label: 'Add POS sell' },
      { key: 'pos.edit', label: 'Edit POS sell' },
      { key: 'pos.delete', label: 'Delete POS sell' },
      { key: 'pos.edit_price', label: 'Edit product price from POS screen' },
      { key: 'pos.edit_discount', label: 'Edit product discount from POS screen' },
      { key: 'pos.payment.view', label: 'View POS payment' },
      { key: 'pos.payment.add', label: 'Add POS payment' },
      { key: 'pos.payment.edit', label: 'Edit POS payment' },
      { key: 'pos.payment.delete', label: 'Delete POS payment' },
      { key: 'pos.print', label: 'Print Invoice' },
      { key: 'pos.disable_multiple_pay', label: 'Disable Multiple Pay' },
      { key: 'pos.disable_draft', label: 'Disable Draft' },
      { key: 'pos.disable_express', label: 'Disable Express Checkout' },
      { key: 'pos.disable_discount', label: 'Disable Discount' },
      { key: 'pos.disable_suspend', label: 'Disable Suspend Sale' },
      { key: 'pos.disable_credit', label: 'Disable credit sale button' },
      { key: 'pos.disable_quotation', label: 'Disable Quotation' },
      { key: 'pos.disable_card', label: 'Disable Card' },
    ],
  },
  {
    code: 'sell', label: 'Sell', info: true,
    radio: 'sell.view_scope',
    radios: [
      { key: 'sell.view_all', label: 'View all sell' },
      { key: 'sell.view_own', label: 'View own sell only' },
    ],
    perms: [
      { key: 'sell.view_paid', label: 'View paid sells only' },
      { key: 'sell.view_due', label: 'View due sells only' },
      { key: 'sell.view_partial', label: 'View partially paid sells only' },
      { key: 'sell.view_overdue', label: 'View overdue sells only' },
      { key: 'sell.add', label: 'Add Sell' },
      { key: 'sell.update', label: 'Update Sell' },
      { key: 'sell.delete', label: 'Delete Sell' },
      { key: 'sell.commission_own', label: 'Commission agent can view their own sell' },
      { key: 'sell.add_payment', label: 'Add sell payment' },
      { key: 'sell.edit_payment', label: 'Edit sell payment' },
      { key: 'sell.delete_payment', label: 'Delete sell payment' },
      { key: 'sell.edit_price', label: 'Edit product price from sales screen' },
      { key: 'sell.edit_discount', label: 'Edit product discount from Sale screen' },
      { key: 'sell.discount.view', label: 'View discount' },
      { key: 'sell.discount.add', label: 'Add discount' },
      { key: 'sell.discount.edit', label: 'Edit discount' },
      { key: 'sell.discount.delete', label: 'Delete discount' },
      { key: 'sell.return_all', label: 'Access all sell return' },
      { key: 'sell.return_own', label: 'Access own sell return' },
      { key: 'sell.invoice_no.view', label: 'View invoice number' },
      { key: 'sell.invoice_no.add', label: 'Add invoice number' },
      { key: 'sell.invoice_no.edit', label: 'Edit invoice number' },
    ],
  },
  {
    code: 'draft', label: 'Draft',
    radio: 'draft.view_scope',
    radios: [
      { key: 'draft.view_all', label: 'View all drafts' },
      { key: 'draft.view_own', label: 'View own drafts' },
    ],
    perms: [
      { key: 'draft.edit', label: 'Edit draft' },
      { key: 'draft.delete', label: 'Delete draft' },
    ],
  },
  {
    code: 'quotation', label: 'Quotation',
    radio: 'quotation.view_scope',
    radios: [
      { key: 'quotation.view_all', label: 'View all quotations' },
      { key: 'quotation.view_own', label: 'View own quotations' },
    ],
    perms: [
      { key: 'quotation.edit', label: 'Edit quotation' },
      { key: 'quotation.delete', label: 'Delete quotation' },
    ],
  },
  {
    code: 'shipments', label: 'Shipments',
    radio: 'shipments.view_scope',
    radios: [
      { key: 'shipments.access_all', label: 'Access all shipments' },
      { key: 'shipments.access_own', label: 'Access own shipments' },
    ],
    perms: [
      { key: 'shipments.pending_only', label: 'Access pending shipments only' },
      { key: 'shipments.commission_own', label: 'Commission agent can access their own shipments' },
    ],
  },
  {
    code: 'cash_register', label: 'Cash Register',
    perms: [
      { key: 'cash_register.view', label: 'View cash register' },
      { key: 'cash_register.close', label: 'Close cash register' },
    ],
  },
  {
    code: 'brand', label: 'Brand',
    perms: [
      { key: 'brand.view', label: 'View brand' },
      { key: 'brand.add', label: 'Add brand' },
      { key: 'brand.edit', label: 'Edit brand' },
      { key: 'brand.delete', label: 'Delete brand' },
    ],
  },
  {
    code: 'tax_rate', label: 'Tax rate',
    perms: [
      { key: 'tax.view', label: 'View tax rate' },
      { key: 'tax.add', label: 'Add tax rate' },
      { key: 'tax.edit', label: 'Edit tax rate' },
      { key: 'tax.delete', label: 'Delete tax rate' },
    ],
  },
  {
    code: 'unit', label: 'Unit',
    perms: [
      { key: 'unit.view', label: 'View unit' },
      { key: 'unit.add', label: 'Add unit' },
      { key: 'unit.edit', label: 'Edit unit' },
      { key: 'unit.delete', label: 'Delete unit' },
    ],
  },
  {
    code: 'category', label: 'Category',
    perms: [
      { key: 'category.view', label: 'View category' },
      { key: 'category.add', label: 'Add category' },
      { key: 'category.edit', label: 'Edit category' },
      { key: 'category.delete', label: 'Delete category' },
    ],
  },
  {
    code: 'report', label: 'Report',
    perms: [
      { key: 'report.purchase_sell', label: 'View purchase & sell report' },
      { key: 'report.tax', label: 'View Tax report' },
      { key: 'report.supplier_customer', label: 'View Supplier & Customer report' },
      { key: 'report.expense', label: 'View expense report' },
      { key: 'report.profit_loss', label: 'View profit/loss report' },
      { key: 'report.stock', label: 'View stock report, stock adjustment report & stock expiry report' },
      { key: 'report.trending', label: 'View trending product report' },
      { key: 'report.register', label: 'View register report' },
      { key: 'report.sales_rep', label: 'View sales representative report' },
      { key: 'report.stock_value', label: 'View product stock value' },
      { key: 'report.stock_history', label: 'View stock history' },
      { key: 'report.z', label: 'View Z report' },
      { key: 'report.activity', label: 'View activity log' },
    ],
  },
  {
    code: 'settings', label: 'Settings',
    perms: [
      { key: 'settings.business', label: 'Access business settings' },
      { key: 'settings.barcode', label: 'Access barcode settings' },
      { key: 'settings.invoice', label: 'Access invoice settings' },
      { key: 'settings.printers', label: 'Access printers' },
      { key: 'settings.locations', label: 'Access business locations' },
      { key: 'settings.notifications', label: 'Access notification templates' },
      { key: 'settings.backup', label: 'Access backup' },
      { key: 'settings.field_ops', label: 'Access Field Ops data-flow settings' },
      { key: 'settings.roles', label: 'Access roles from settings' },
    ],
  },
  {
    code: 'expense', label: 'Expense',
    radio: 'expense.view_scope',
    radios: [
      { key: 'expense.access_all', label: 'Access all expenses' },
      { key: 'expense.view_own', label: 'View own expense only' },
    ],
    perms: [
      { key: 'expense.add', label: 'Add Expense' },
      { key: 'expense.edit', label: 'Edit Expense' },
      { key: 'expense.delete', label: 'Delete Expense' },
    ],
  },
  {
    code: 'home', label: 'Home',
    perms: [{ key: 'home.view', label: 'View Home data' }],
  },
  {
    code: 'account', label: 'Finance',
    perms: [
      { key: 'finance.access', label: 'Access Finance menu' },
      { key: 'finance.hub', label: 'Finance hub' },
      { key: 'finance.treasury', label: 'Treasury & Cash' },
      { key: 'finance.cash_position', label: 'Cash position' },
      { key: 'finance.wallets', label: 'Bank & wallets' },
      { key: 'finance.banks', label: 'Banks' },
      { key: 'finance.uba', label: 'UBA Fiberk' },
      { key: 'finance.transfers', label: 'Fund transfers' },
      { key: 'finance.budgeting', label: 'Budgeting' },
      { key: 'finance.budget_vs_actual', label: 'Budget vs actual' },
      { key: 'finance.annual_budget', label: 'Annual budget' },
      { key: 'finance.dept_budget', label: 'Department budgets' },
      { key: 'finance.controls', label: 'Financial controls' },
      { key: 'finance.capital', label: 'Capital management' },
      { key: 'finance.vendors', label: 'Vendor payments' },
      { key: 'finance.revenue', label: 'Revenue & collections' },
      { key: 'finance.kpis', label: 'Finance KPIs' },
      { key: 'account.view', label: 'View accounts' },
      { key: 'account.access', label: 'Access Accounts' },
      { key: 'account.edit_txn', label: 'Edit account transaction' },
      { key: 'account.delete_txn', label: 'Delete account transaction' },
      { key: 'account.banking', label: 'Access banking' },
      { key: 'account.balance_sheet', label: 'View balance sheet' },
      { key: 'account.trial_balance', label: 'View trial balance' },
      { key: 'account.cash_flow', label: 'View cash flow' },
    ],
  },
  {
    code: 'selling_price_group', label: 'Access selling price groups',
    perms: [{ key: 'spg.default', label: 'Default Selling Price' }],
  },
  {
    code: 'accounting', label: 'Accounting',
    perms: [
      { key: 'accounting.access', label: 'Access Accounting Module' },
      { key: 'accounting.manage', label: 'Manage Accounts' },
      { key: 'accounting.journal.view', label: 'View Journal' },
      { key: 'accounting.journal.add', label: 'Add Journal' },
      { key: 'accounting.journal.edit', label: 'Edit Journal' },
      { key: 'accounting.journal.delete', label: 'Delete Journal' },
      { key: 'accounting.map', label: 'Map Transactions' },
      { key: 'accounting.transfer.view', label: 'View Transfer' },
      { key: 'accounting.transfer.add', label: 'Add Transfer' },
      { key: 'accounting.transfer.edit', label: 'Edit Transfer' },
      { key: 'accounting.transfer.delete', label: 'Delete Transfer' },
      { key: 'accounting.budget', label: 'Manage Budget' },
      { key: 'accounting.reports', label: 'View Reports' },
    ],
  },
  {
    code: 'asset', label: 'AssetManagement',
    radio: 'asset.maint_scope',
    radios: [
      { key: 'asset.maint_all', label: 'View all maintenance' },
      { key: 'asset.maint_own', label: 'View own maintenance' },
    ],
    perms: [
      { key: 'asset.view', label: 'View Asset' },
      { key: 'asset.add', label: 'Add asset' },
      { key: 'asset.edit', label: 'Edit asset' },
      { key: 'asset.delete', label: 'Delete asset' },
      { key: 'asset.allocate', label: 'Allocate asset' },
      { key: 'asset.revoke', label: 'Revoke asset' },
      { key: 'asset.category.view', label: 'View asset categories' },
      { key: 'asset.category.add', label: 'Add asset categories' },
      { key: 'asset.category.edit', label: 'Edit asset categories' },
      { key: 'asset.category.delete', label: 'Delete asset categories' },
      { key: 'asset.settings', label: 'Access asset settings' },
    ],
  },
  {
    code: 'cheque', label: 'Cheque',
    perms: [
      { key: 'cheque.received', label: 'View Received Cheques' },
      { key: 'cheque.issued', label: 'View Issued Cheques' },
    ],
  },
  {
    code: 'crm', label: 'Crm',
    radio: 'crm.followup_scope',
    radios: [
      { key: 'crm.followup_all', label: 'Access all follow up' },
      { key: 'crm.followup_own', label: 'Access own follow up' },
    ],
    radio2: 'crm.leads_scope',
    radios2: [
      { key: 'crm.leads_all', label: 'Access all leads' },
      { key: 'crm.leads_own', label: 'Access own leads' },
    ],
    radio3: 'crm.campaigns_scope',
    radios3: [
      { key: 'crm.campaigns_all', label: 'Access all campaigns' },
      { key: 'crm.campaigns_own', label: 'Access own campaigns' },
    ],
    perms: [
      { key: 'crm.contact_login', label: 'Access contact login' },
      { key: 'crm.sources', label: 'Access sources' },
      { key: 'crm.life_stage', label: 'Access life stage' },
      { key: 'crm.proposal', label: 'Access proposal' },
      { key: 'crm.reports', label: 'View reports' },
      { key: 'crm.leads_add', label: 'Add lead' },
      { key: 'crm.followup_add', label: 'Add follow up' },
      { key: 'crm.campaigns_add', label: 'Add campaign' },
      { key: 'crm.settings', label: 'Access CRM settings' },
    ],
  },
  {
    code: 'custom_dashboard', label: 'Custom Dashboards',
    perms: [{ key: 'dashboard.manage', label: 'Manage Dashboard' }, { key: 'dashboard.view', label: 'View custom dashboard' }],
  },
  {
    code: 'essentials', label: 'HRM',
    radio: 'essentials.leave_scope',
    radios: [
      { key: 'essentials.leave_all', label: 'View all leave' },
      { key: 'essentials.leave_own', label: 'View own leave' },
    ],
    radio2: 'essentials.attendance_scope',
    radios2: [
      { key: 'essentials.attendance_all', label: 'View all attendance' },
      { key: 'essentials.attendance_own', label: 'View own attendance' },
    ],
    perms: [
      { key: 'essentials.leave.view', label: 'View leave' },
      { key: 'essentials.leave.add', label: 'Add leave' },
      { key: 'essentials.leave.edit', label: 'Edit leave' },
      { key: 'essentials.leave.delete', label: 'Delete leave' },
      { key: 'essentials.leave_type.view', label: 'View leave type' },
      { key: 'essentials.leave_type.add', label: 'Add leave type' },
      { key: 'essentials.leave_type.edit', label: 'Edit leave type' },
      { key: 'essentials.leave_type.delete', label: 'Delete leave type' },
      { key: 'essentials.approve_leave', label: 'Approve Leave' },
      { key: 'essentials.attendance.view', label: 'View attendance' },
      { key: 'essentials.attendance.add', label: 'Add attendance' },
      { key: 'essentials.attendance.edit', label: 'Edit attendance' },
      { key: 'essentials.attendance.delete', label: 'Delete attendance' },
      { key: 'essentials.attendance_web', label: 'Allow users to enter their own attendance from web' },
      { key: 'essentials.attendance_api', label: 'Allow users to enter their own attendance from api' },
      { key: 'essentials.pay_view', label: 'View Pay Component' },
      { key: 'essentials.pay_add', label: 'Add Pay Component' },
      { key: 'essentials.department.view', label: 'View department' },
      { key: 'essentials.department.add', label: 'Add department' },
      { key: 'essentials.department.edit', label: 'Edit department' },
      { key: 'essentials.department.delete', label: 'Delete department' },
      { key: 'essentials.designation.view', label: 'View designation' },
      { key: 'essentials.designation.add', label: 'Add designation' },
      { key: 'essentials.designation.edit', label: 'Edit designation' },
      { key: 'essentials.designation.delete', label: 'Delete designation' },
      { key: 'essentials.payroll_view', label: 'View all Payroll' },
      { key: 'essentials.payroll_add', label: 'Add Payroll' },
      { key: 'essentials.payroll_edit', label: 'Edit Payroll' },
      { key: 'essentials.payroll_delete', label: 'Delete Payroll' },
    ],
  },
  {
    code: 'hrm', label: 'HRM',
    radio: 'hrm.view_scope',
    radios: [
      { key: 'hrm.view_all', label: 'View all HRM' },
      { key: 'hrm.view_own', label: 'View own HRM' },
    ],
    perms: [
      { key: 'hrm.holiday.view', label: 'View holiday' },
      { key: 'hrm.holiday.add', label: 'Add holiday' },
      { key: 'hrm.holiday.edit', label: 'Edit holiday' },
      { key: 'hrm.holiday.delete', label: 'Delete holiday' },
      { key: 'hrm.induction', label: 'Staff induction' },
      { key: 'hrm.targets', label: 'Sales targets' },
      { key: 'hrm.snnit', label: 'SNNIT / NHIA contributions' },
      { key: 'hrm.orientation', label: 'Orientation & welcome package' },
      { key: 'hrm.training', label: 'Training' },
      { key: 'hrm.settings', label: 'Access HRM settings' },
    ],
  },
  {
    code: 'field_ops', label: 'Field Ops',
    radio: 'field_ops.view_scope',
    radios: [
      { key: 'field_ops.view_all', label: 'View all Field Ops' },
      { key: 'field_ops.view_own', label: 'View own Field Ops' },
    ],
    perms: [
      { key: 'field_ops.floor', label: 'Access Floor' },
      { key: 'field_ops.visits_add', label: 'Add visit' },
      { key: 'field_ops.visits_edit', label: 'Edit visit' },
      { key: 'field_ops.visits_delete', label: 'Delete visit' },
      { key: 'field_ops.agents', label: 'View agents' },
      { key: 'field_ops.agents.add', label: 'Add agents' },
      { key: 'field_ops.agents.edit', label: 'Edit agents' },
      { key: 'field_ops.agents.delete', label: 'Delete agents' },
      { key: 'field_ops.join', label: 'View join applications' },
      { key: 'field_ops.join_review', label: 'Approve/reject join applications' },
      { key: 'field_ops.stock', label: 'Access Field Stock Hub' },
      { key: 'field_ops.stock_pick', label: 'Pick stock for agents' },
      { key: 'field_ops.sync', label: 'Publish / sync public Field Ops' },
      { key: 'field_ops.settings', label: 'Access Field Ops settings' },
    ],
  },
  {
    code: 'bnpl', label: 'Hire Purchase',
    radio: 'bnpl.view_scope',
    radios: [
      { key: 'bnpl.view_all', label: 'View all hire purchase' },
      { key: 'bnpl.view_own', label: 'View own hire purchase' },
    ],
    perms: [
      { key: 'bnpl.plans.view', label: 'View hire purchase plans' },
      { key: 'bnpl.plans.add', label: 'Add hire purchase plans' },
      { key: 'bnpl.plans.edit', label: 'Edit hire purchase plans' },
      { key: 'bnpl.plans.delete', label: 'Delete hire purchase plans' },
      { key: 'bnpl.deposits', label: 'Record deposits' },
      { key: 'bnpl.collections', label: 'Record collections' },
      { key: 'bnpl.writeoff', label: 'Write off / close plan' },
    ],
  },
  {
    code: 'ai', label: 'AI Assistance',
    perms: [
      { key: 'ai.access', label: 'Access AI Assistance' },
      { key: 'ai.history', label: 'View AI history' },
    ],
  },
  {
    code: 'qr', label: 'Catalogue QR',
    perms: [
      { key: 'qr.view', label: 'View catalogue QR' },
      { key: 'qr.generate', label: 'Generate catalogue QR' },
    ],
  },
  {
    code: 'connector', label: 'Connector',
    perms: [
      { key: 'connector.access', label: 'Access Connector' },
      { key: 'connector.manage', label: 'Manage Connector' },
    ],
  },
  {
    code: 'audit', label: 'Audit',
    perms: [
      { key: 'audit.view', label: 'View audit log' },
      { key: 'audit.error_codes', label: 'View error codes' },
    ],
  },
  {
    code: 'warranty', label: 'Warranty',
    perms: [
      { key: 'warranty.view', label: 'View warranty' },
      { key: 'warranty.add', label: 'Add warranty' },
      { key: 'warranty.edit', label: 'Edit warranty' },
      { key: 'warranty.delete', label: 'Delete warranty' },
    ],
  },
  {
    code: 'commission', label: 'Sales Commission Agent',
    perms: [
      { key: 'commission.view', label: 'View commission agents' },
      { key: 'commission.add', label: 'Add commission agent' },
      { key: 'commission.edit', label: 'Edit commission agent' },
      { key: 'commission.delete', label: 'Delete commission agent' },
    ],
  },
  {
    code: 'project', label: 'Project',
    perms: [
      { key: 'project.view', label: 'View Project' },
      { key: 'project.create', label: 'Create Project' },
      { key: 'project.edit', label: 'Edit Project' },
      { key: 'project.delete', label: 'Delete Project' },
      { key: 'project.tasks', label: 'Access my tasks' },
      { key: 'project.reports', label: 'View project reports' },
      { key: 'project.category.view', label: 'View project categories' },
      { key: 'project.category.add', label: 'Add project categories' },
      { key: 'project.category.edit', label: 'Edit project categories' },
      { key: 'project.category.delete', label: 'Delete project categories' },
    ],
  },
  {
    code: 'repair', label: 'Repair',
    radio: 'repair.invoice_scope',
    radios: [
      { key: 'repair.invoice_all', label: 'View all invoice' },
      { key: 'repair.invoice_own', label: 'View own invoice' },
    ],
    radio2: 'repair.job_scope',
    radios2: [
      { key: 'repair.job_assigned', label: 'View Only Assigned Job Sheet' },
      { key: 'repair.job_all', label: 'View All Job Sheets' },
    ],
    perms: [
      { key: 'repair.invoice_add', label: 'Add Invoice' },
      { key: 'repair.invoice_edit', label: 'Edit Invoice' },
      { key: 'repair.invoice_delete', label: 'Delete Invoice' },
      { key: 'repair.invoice_status', label: 'Change Invoice Status' },
      { key: 'repair.job_status.view', label: 'View job sheet status' },
      { key: 'repair.job_status.add', label: 'Add job sheet status' },
      { key: 'repair.job_status.edit', label: 'Edit job sheet status' },
      { key: 'repair.job_status.delete', label: 'Delete job sheet status' },
      { key: 'repair.job_add', label: 'Add job sheet' },
      { key: 'repair.job_edit', label: 'Edit Job Sheet' },
      { key: 'repair.job_delete', label: 'Delete Job Sheet' },
      { key: 'repair.catalog', label: 'Access repair catalog' },
    ],
  },
  {
    code: 'spreadsheet', label: 'Spreadsheet',
    perms: [
      { key: 'spreadsheet.access', label: 'Access spreadsheet' },
      { key: 'spreadsheet.create', label: 'Create spreadsheet' },
    ],
  },
  {
    code: 'superadmin', label: 'Superadmin',
    ownerOnly: true,
    perms: [{ key: 'superadmin.packages', label: 'Access package subscriptions' }],
  },
  {
    code: 'woocommerce', label: 'Woocommerce',
    perms: [
      { key: 'woo.sync_categories', label: 'Sync Product Categories' },
      { key: 'woo.sync_products', label: 'Sync Products' },
      { key: 'woo.sync_orders', label: 'Sync Orders' },
      { key: 'woo.map_tax', label: 'Map Tax Rates' },
      { key: 'woo.api', label: 'Access Woocommerce API settings' },
    ],
  },
];

/** Every category gets View / Add / Edit / Delete as separate boxes. Combined UPOS keys are gone. */
function groupKeys(g) {
  const out = [];
  for (const list of [g.perms, g.radios, g.radios2, g.radios3]) {
    (list || []).forEach((p) => { if (p?.key) out.push(p.key); });
  }
  return out;
}
PERM_GROUPS.forEach((g) => {
  const keys = groupKeys(g);
  const has = (re) => keys.some((k) => re.test(k));
  g.perms = g.perms || [];
  const noun = String(g.label || g.code).replace(/Management$/i, '').trim();
  if (!has(/\.(view|view_all|view_own|access)$/i) && !has(/\.view\./i)) {
    g.perms.unshift({ key: `${g.code}.view`, label: `View ${noun}` });
  }
  if (!has(/\.(add|create)$/i)) {
    g.perms.push({ key: `${g.code}.add`, label: `Add ${noun}` });
  }
  if (!has(/\.(edit|update)$/i)) {
    g.perms.push({ key: `${g.code}.edit`, label: `Edit ${noun}` });
  }
  if (!has(/\.delete$/i)) {
    g.perms.push({ key: `${g.code}.delete`, label: `Delete ${noun}` });
  }
});

export function allPermKeys() {
  const keys = [];
  for (const g of [...screenPermGroups(), ...PERM_GROUPS]) {
    for (const list of [g.radios, g.radios2, g.radios3, g.perms]) {
      if (list) for (const p of list) keys.push(p.key);
    }
  }
  return keys;
}

export function emptyPerms() {
  const o = {};
  for (const k of allPermKeys()) o[k] = false;
  return o;
}

export function countOn(perms) {
  return Object.values(perms || {}).filter(Boolean).length;
}

/** Superadmin / package subscriptions — Owner and Founder. */
const ATTACH = {
  others: 'System · Settings',
  cashier: 'Cashier',
  academy: 'Academy',
  user: 'System · Users',
  roles: 'System · Users',
  communications: 'Communications',
  ops_hub: null,
  collections: null,
  supplier: 'Records · Contacts',
  customer: 'Records · Contacts',
  product: 'Records · Products',
  manufacturing: 'Manufacturing',
  purchase: 'Purchases',
  stock_adjustment: 'Operations',
  stock_transfer: 'Operations',
  pos: 'POS',
  sell: 'Sales',
  draft: 'Sales',
  quotation: 'Sales',
  shipments: 'Sales',
  cash_register: 'POS',
  brand: 'Records · Products',
  tax_rate: 'System · Settings',
  unit: 'Records · Products',
  category: 'Records · Products',
  report: 'Reports',
  settings: 'System · Settings',
  expense: 'Finance',
  home: null,
  account: 'Finance',
  selling_price_group: 'Records · Products',
  accounting: 'Accounting',
  asset: 'Asset Management',
  cheque: 'Finance',
  crm: 'CRM',
  custom_dashboard: 'Custom Dashboards',
  essentials: 'HRM',
  hrm: 'HRM',
  field_ops: 'Field Ops',
  bnpl: 'Field Ops',
  ai: 'AI Assistance',
  qr: 'Catalogue QR',
  connector: 'Connector',
  audit: 'System · Users',
  warranty: 'Records · Products',
  commission: 'System · Users',
  project: 'Project',
  repair: 'Repair',
  spreadsheet: 'Spreadsheet',
  superadmin: 'System · Settings',
  woocommerce: 'WooCommerce',
};

function mergeGroup(into, extra) {
  into.radioSets = into.radioSets || [];
  if (extra.radios?.length) {
    into.radioSets.push({ name: extra.radio || extra.code + '-r1', items: extra.radios });
  }
  if (extra.radios2?.length) {
    into.radioSets.push({ name: extra.radio2 || extra.code + '-r2', items: extra.radios2 });
  }
  if (extra.radios3?.length) {
    into.radioSets.push({ name: extra.radio3 || extra.code + '-r3', items: extra.radios3 });
  }
  if (extra.radioSets) into.radioSets.push(...extra.radioSets);
  if (extra.perms?.length) into.perms = [...(into.perms || []), ...extra.perms];
}

export function visiblePermGroups(role) {
  const buckets = new Map();
  const ensure = (label) => {
    if (!buckets.has(label)) {
      buckets.set(label, { code: 'menu_' + label.toLowerCase().replace(/[^a-z0-9]+/g, '_'), label, perms: [] });
    }
    return buckets.get(label);
  };
  screenPermGroups().forEach((g) => mergeGroup(ensure(g.label), g));
  PERM_GROUPS.forEach((g) => {
    if (g.ownerOnly && !isOwnerRole(role)) return;
    const label = ATTACH[g.code];
    if (!label) return;
    mergeGroup(ensure(label), g);
  });
  const seen = new Set();
  const dedupe = (list) => (list || []).filter((p) => {
    if (!p?.key || seen.has(p.key)) return false;
    seen.add(p.key);
    return true;
  });
  return FORM_ORDER.map((label) => {
    const g = buckets.get(label);
    if (!g) return null;
    return {
      ...g,
      radioSets: (g.radioSets || []).filter((s) => s?.items?.length),
      radios: dedupe(g.radios),
      radios2: dedupe(g.radios2),
      radios3: dedupe(g.radios3),
      perms: dedupe(g.perms),
    };
  }).filter((g) => g && ((g.perms && g.perms.length) || (g.radioSets && g.radioSets.length) || g.radios || g.radios2 || g.radios3));
}

/** Stored ticks only. A leftover '*' does not fill the form. */
export function materializePerms(raw, roleName) {
  const base = emptyPerms();
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  for (const k of Object.keys(base)) {
    if (k === '*') continue;
    base[k] = !!src[k];
  }
  for (const k of Object.keys(src)) {
    if (k !== '*' && src[k]) base[k] = true;
  }
  if (!isOwnerRole(roleName)) base['superadmin.packages'] = !!src['superadmin.packages'];
  if (src['cashier.role'] == null && (src['pos.add'] || src['menu.pos.till'])) {
    base['cashier.role'] = true;
  }
  if (src['menu.sales.pos_list']) base['menu.pos.list'] = true;
  if (src['menu.sales.registers']) base['menu.pos.registers'] = true;
  if (src['menu.sales.till_alerts']) base['menu.pos.till_alerts'] = true;
  if (src['menu.comm.kb'] || src['essentials.kb']) {
    base['academy.kb'] = true;
    base['academy.access'] = true;
    base['menu.academy.kb'] = true;
  }
  const explode = (from, onto) => {
    if (!src[from]) return;
    onto.forEach((k) => { base[k] = true; });
  };
  explode('pos.edit_payment', ['pos.payment.view', 'pos.payment.add', 'pos.payment.edit']);
  explode('sell.manage_discount', ['sell.discount.view', 'sell.discount.add', 'sell.discount.edit', 'sell.discount.delete']);
  explode('sell.edit_invoice_no', ['sell.invoice_no.view', 'sell.invoice_no.add', 'sell.invoice_no.edit']);
  explode('asset.categories', ['asset.category.view', 'asset.category.add', 'asset.category.edit', 'asset.category.delete']);
  explode('essentials.leave_all', ['essentials.leave.view', 'essentials.leave.add', 'essentials.leave.edit', 'essentials.leave.delete']);
  explode('essentials.leave_own', ['essentials.leave.view', 'essentials.leave.add']);
  explode('essentials.attendance_all', ['essentials.attendance.view', 'essentials.attendance.add', 'essentials.attendance.edit', 'essentials.attendance.delete']);
  explode('essentials.leave_type', ['essentials.leave_type.view', 'essentials.leave_type.add', 'essentials.leave_type.edit', 'essentials.leave_type.delete']);
  explode('essentials.department', ['essentials.department.view', 'essentials.department.add', 'essentials.department.edit', 'essentials.department.delete']);
  explode('essentials.designation', ['essentials.designation.view', 'essentials.designation.add', 'essentials.designation.edit', 'essentials.designation.delete']);
  explode('hrm.holiday', ['hrm.holiday.view', 'hrm.holiday.add', 'hrm.holiday.edit', 'hrm.holiday.delete']);
  explode('field_ops.agents_edit', ['field_ops.agents.add', 'field_ops.agents.edit']);
  explode('bnpl.plans', ['bnpl.plans.view', 'bnpl.plans.add', 'bnpl.plans.edit']);
  explode('project.categories', ['project.category.view', 'project.category.add', 'project.category.edit', 'project.category.delete']);
  explode('repair.job_status', ['repair.job_status.view', 'repair.job_status.add', 'repair.job_status.edit', 'repair.job_status.delete']);
  explode('academy.edit', ['academy.view', 'academy.add', 'academy.edit']);
  expandLegacyMenuPerms(base);
  return base;
}
