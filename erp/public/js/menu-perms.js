/**
 * Left-menu screens → role ticks. One checkbox per child on the sidebar.
 * Table add/edit/delete stay in perm-catalog. Legacy UPOS keys still expand
 * onto the screens that job actually used (not the whole UPOS family).
 */
export const MENU_LEAVES = [
  { group: 'Home', label: 'Home', key: 'menu.home', href: '/dashboard.html', legacy: ['home.view'] },
  { group: 'Home', label: 'KPI cards (sales, net, dues, expenses)', key: 'home.kpis' },
  { group: 'Home', label: 'Sales chart (selected dates)', key: 'home.chart_range' },
  { group: 'Home', label: 'Sales chart (financial year)', key: 'home.chart_year' },
  { group: 'Home', label: 'Sales Payment Due table', key: 'home.sales_due' },
  { group: 'Home', label: 'Purchase Payment Due table', key: 'home.purch_due' },
  { group: 'Home', label: 'Product Stock Alert table', key: 'home.stock_alert' },
  { group: 'Home', label: 'Sales Order table', key: 'home.orders' },
  { group: 'Home', label: 'Pending Shipments table', key: 'home.shipments' },

  { group: 'Records · Contacts', label: 'Suppliers', key: 'menu.records.suppliers', href: '/suppliers.html', legacy: ['supplier.view_all', 'supplier.view_own'] },
  { group: 'Records · Contacts', label: 'Supplier Groups', key: 'menu.records.supplier_groups', href: '/supplier-groups.html', legacy: ['supplier.view_all', 'supplier.view_own'] },
  { group: 'Records · Contacts', label: 'Customers', key: 'menu.records.customers', href: '/customers.html', legacy: ['customer.view_all', 'customer.view_own'] },
  { group: 'Records · Contacts', label: 'Customer Groups', key: 'menu.records.customer_groups', href: '/customer-groups.html', legacy: ['customer.view_all', 'customer.view_own'] },
  { group: 'Records · Contacts', label: 'Client Groups', key: 'menu.records.client_groups', href: '/client-groups.html', legacy: ['customer.view_all'] },
  { group: 'Records · Contacts', label: 'Investors', key: 'menu.records.investors', href: '/investors.html', legacy: ['customer.view_all'] },
  { group: 'Records · Contacts', label: 'Partners', key: 'menu.records.partners', href: '/partners.html', legacy: ['customer.view_all'] },
  { group: 'Records · Contacts', label: 'Consultants', key: 'menu.records.consultants', href: '/consultants.html', legacy: ['customer.view_all'] },
  { group: 'Records · Contacts', label: 'Loyalty Cards', key: 'menu.records.loyalty', href: '/loyalty-cards.html', legacy: ['customer.view_all'] },
  { group: 'Records · Contacts', label: 'Import Contacts', key: 'menu.records.import_contacts', href: '/import-contacts.html', legacy: ['customer.add'] },
  { group: 'Records · Contacts', label: 'Import Suppliers', key: 'menu.records.import_suppliers', href: '/import-contacts.html?contact_type=supplier', legacy: ['supplier.add'] },

  { group: 'Records · Products', label: 'Product Catalog', key: 'menu.records.catalog', href: '/product-catalog.html', legacy: ['product.view'] },
  { group: 'Records · Products', label: 'Product Inventory', key: 'menu.records.inventory', href: '/products.html?view=inventory', legacy: ['product.view'] },
  { group: 'Records · Products', label: 'List Products', key: 'menu.records.products', href: '/products.html', legacy: ['product.view'] },
  { group: 'Records · Products', label: 'Add Product', key: 'menu.records.product_add', href: '/product-form.html', legacy: ['product.add'] },
  { group: 'Records · Products', label: 'Update Price', key: 'menu.records.update_price', href: '/update-price.html', legacy: ['product.edit'] },
  { group: 'Records · Products', label: 'Print Labels', key: 'menu.records.labels', href: '/print-labels.html', legacy: ['product.view'] },
  { group: 'Records · Products', label: 'Variations', key: 'menu.records.variations', href: '/variations.html', legacy: ['product.view'] },
  { group: 'Records · Products', label: 'Selling Price Group', key: 'menu.records.price_groups', href: '/price-groups.html', legacy: ['product.view'] },
  { group: 'Records · Products', label: 'Units', key: 'menu.records.units', href: '/units.html', legacy: ['unit.view'] },
  { group: 'Records · Products', label: 'Categories', key: 'menu.records.categories', href: '/categories.html', legacy: ['category.view'] },
  { group: 'Records · Products', label: 'Brands', key: 'menu.records.brands', href: '/brands.html', legacy: ['brand.view'] },
  { group: 'Records · Products', label: 'Warranties', key: 'menu.records.warranties', href: '/warranties.html', legacy: ['warranty.view'] },
  { group: 'Records · Products', label: 'Media Sync', key: 'menu.records.media', href: '/media-sync.html', legacy: ['product.edit'] },
  { group: 'Records · Products', label: 'Franko photos', key: 'menu.records.franko', href: '/franko-sync.html', legacy: ['product.edit'] },
  { group: 'Records · Products', label: 'Missing images', key: 'menu.records.missing_images', href: '/missing-images.html', legacy: ['product.view'] },
  { group: 'Records · Products', label: 'Import Products', key: 'menu.records.import_products', href: '/import-products.html', legacy: ['product.add'] },

  { group: 'Purchases', label: 'List Purchases', key: 'menu.purchases.list', href: '/purchase-orders.html', legacy: ['purchase.view_all', 'purchase.view_own'] },
  { group: 'Purchases', label: 'Purchases catch-up', key: 'menu.purchases.catchup', href: '/purchase-catchup.html', legacy: ['purchase.add'] },
  { group: 'Purchases', label: 'Add Purchase', key: 'menu.purchases.add', href: '/purchase-form.html', legacy: ['purchase.add'] },
  { group: 'Purchases', label: 'List Purchase Return', key: 'menu.purchases.returns', href: '/purchase-returns.html', legacy: ['purchase.view_all', 'purchase.view_own'] },
  { group: 'Purchases', label: 'Add Purchase Return', key: 'menu.purchases.return_add', href: '/purchase-return-form.html', legacy: ['purchase.add'] },
  { group: 'Purchases', label: 'Purchase Invoices', key: 'menu.purchases.invoices', href: '/purchase-invoices.html', legacy: ['purchase.view_all', 'purchase.view_own'] },
  { group: 'Purchases', label: 'Add Purchase Invoice', key: 'menu.purchases.invoice_add', href: '/purchase-invoice-form.html', legacy: ['purchase.add'] },
  { group: 'Purchases', label: 'Paper invoices', key: 'menu.purchases.paper', href: '/paper-purchase.html', legacy: ['purchase.add'] },

  { group: 'Operations', label: 'Hub board', key: 'menu.ops.hub', href: '/virtual-warehouse.html', legacy: ['ops.hub', 'ops.access'] },
  { group: 'Operations', label: 'Receive Stock', key: 'menu.ops.receive', href: '/receive-stock.html', legacy: ['ops.receive', 'ops.access'] },
  { group: 'Operations', label: 'Put Away', key: 'menu.ops.putaway', href: '/put-away.html', legacy: ['ops.putaway', 'ops.access'] },
  { group: 'Operations', label: 'List Transfers', key: 'menu.ops.transfers', href: '/stock-transfers.html', legacy: ['stock_transfer.view_all', 'stock_transfer.view_own'] },
  { group: 'Operations', label: 'Add Transfer', key: 'menu.ops.transfer_add', href: '/stock-transfer-form.html', legacy: ['stock_transfer.add'] },
  { group: 'Operations', label: 'List Stock Adjustments', key: 'menu.ops.adjustments', href: '/stock-adjustments.html', legacy: ['stock_adjustment.view_all', 'stock_adjustment.view_own'] },
  { group: 'Operations', label: 'Add Stock Adjustment', key: 'menu.ops.adjustment_add', href: '/stock-adjustment-form.html', legacy: ['stock_adjustment.add'] },
  { group: 'Operations', label: 'Stock Count / Audit', key: 'menu.ops.count', href: '/stock-count.html', legacy: ['ops.count', 'ops.access'] },
  { group: 'Operations', label: 'Opening Stock', key: 'menu.ops.opening', href: '/opening-stock.html', legacy: ['ops.opening', 'product.opening_stock'] },
  { group: 'Operations', label: 'Import Opening Stock', key: 'menu.ops.import_stock', href: '/import-stock.html', legacy: ['ops.opening', 'product.opening_stock'] },

  { group: 'Sales', label: 'All sales', key: 'menu.sales.list', href: '/sales-orders.html', legacy: ['sell.view_all', 'sell.view_own'] },
  { group: 'Sales', label: 'Add Sale', key: 'menu.sales.add', href: '/sales-form.html', legacy: ['sell.add'] },
  { group: 'Sales', label: 'Add Draft', key: 'menu.sales.draft_add', href: '/draft-form.html', legacy: ['sell.add'] },
  { group: 'Sales', label: 'List Drafts', key: 'menu.sales.drafts', href: '/drafts.html', legacy: ['draft.view_all', 'draft.view_own', 'sell.view_own'] },
  { group: 'Sales', label: 'Add Quotation', key: 'menu.sales.quote_add', href: '/quotation-form.html', legacy: ['quotation.edit'] },
  { group: 'Sales', label: 'List Quotations', key: 'menu.sales.quotes', href: '/quotations.html', legacy: ['quotation.view_all', 'quotation.view_own'] },
  { group: 'Sales', label: 'List Sell Return', key: 'menu.sales.returns', href: '/sell-returns.html', legacy: ['sell.return_all', 'sell.return_own'] },
  { group: 'Sales', label: 'Shipments', key: 'menu.sales.shipments', href: '/shipments.html', legacy: ['shipments.access_all', 'shipments.access_own'] },
  { group: 'Sales', label: 'Import Sales', key: 'menu.sales.import', href: '/import-sales.html', legacy: ['sell.add'] },
  { group: 'Sales', label: 'Discounts', key: 'menu.sales.discounts', href: '/discounts.html', legacy: ['sell.discount.view', 'sell.manage_discount'] },

  { group: 'POS', label: 'Open till', key: 'menu.pos.till', href: '/till-login.html', legacy: ['cashier.role', 'pos.add'] },
  { group: 'POS', label: 'List POS Sales', key: 'menu.pos.list', href: '/pos-sales.html', legacy: ['pos.view'] },
  { group: 'POS', label: 'Opened Registers', key: 'menu.pos.registers', href: '/pos-sessions.html', legacy: ['pos.view', 'cash_register.view'] },
  { group: 'POS', label: 'Till discrepancies', key: 'menu.pos.till_alerts', href: '/till-alerts.html', legacy: ['cash_register.view', 'cash_register.close'] },

  { group: 'Finance', label: 'Finance hub', key: 'menu.finance.hub', href: '/finance.html', legacy: ['finance.access', 'finance.hub'] },
  { group: 'Finance', label: 'Cash position', key: 'menu.finance.cash', href: '/finance.html?tab=treasury', legacy: ['finance.cash_position', 'finance.treasury'] },
  { group: 'Finance', label: 'Bank & wallets', key: 'menu.finance.wallets', href: '/payment-accounts.html', legacy: ['finance.wallets', 'account.banking'] },
  { group: 'Finance', label: 'Banks', key: 'menu.finance.banks', href: '/banking.html', legacy: ['finance.banks'] },
  { group: 'Finance', label: 'UBA Fiberk', key: 'menu.finance.uba', href: '/uba-fiberk.html', legacy: ['finance.uba'] },
  { group: 'Finance', label: 'Fund transfers', key: 'menu.finance.transfers', href: '/accounting-transfer.html', legacy: ['finance.transfers'] },
  { group: 'Finance', label: 'Budget vs actual', key: 'menu.finance.budget_vs', href: '/finance.html?tab=budget', legacy: ['finance.budget_vs_actual'] },
  { group: 'Finance', label: 'Annual budget', key: 'menu.finance.annual', href: '/accounting-budget.html', legacy: ['finance.annual_budget'] },
  { group: 'Finance', label: 'Department budgets', key: 'menu.finance.dept', href: '/budgets.html', legacy: ['finance.dept_budget'] },
  { group: 'Finance', label: 'Financial controls', key: 'menu.finance.controls', href: '/finance.html?tab=controls', legacy: ['finance.controls'] },
  { group: 'Finance', label: 'Capital management', key: 'menu.finance.capital', href: '/finance.html?tab=capital', legacy: ['finance.capital'] },
  { group: 'Finance', label: 'Vendor payments', key: 'menu.finance.vendors', href: '/finance.html?tab=vendors', legacy: ['finance.vendors'] },
  { group: 'Finance', label: 'Revenue & collections', key: 'menu.finance.revenue', href: '/finance.html?tab=revenue', legacy: ['finance.revenue'] },
  { group: 'Finance', label: 'Finance KPIs', key: 'menu.finance.kpis', href: '/finance.html?tab=kpis', legacy: ['finance.kpis'] },
  { group: 'Finance', label: 'List Expenses', key: 'menu.finance.expenses', href: '/expenses.html', legacy: ['expense.access_all', 'expense.view_own'] },
  { group: 'Finance', label: 'Add Expense', key: 'menu.finance.expense_add', href: '/expense-form.html', legacy: ['expense.add'] },
  { group: 'Finance', label: 'Expense Categories', key: 'menu.finance.expense_cats', href: '/expense-categories.html', legacy: ['expense.access_all'] },
  { group: 'Finance', label: 'Import Expenses', key: 'menu.finance.expense_import', href: '/expense-import.html', legacy: ['expense.add'] },

  { group: 'Collections', label: 'Dashboard', key: 'menu.col.home', href: '/collections-home.html', legacy: ['collections.operations', 'collections.access'] },
  { group: 'Collections', label: 'Floor', key: 'menu.col.floor', href: '/collections-floor.html', legacy: ['collections.operations'] },
  { group: 'Collections', label: 'Call Diary', key: 'menu.col.diary', href: '/collections-desk.html?pane=diary', legacy: ['collections.operations'] },
  { group: 'Collections', label: 'Call Logs', key: 'menu.col.calls', href: '/collections-calls.html', legacy: ['collections.operations'] },
  { group: 'Collections', label: 'Promise to Pay', key: 'menu.col.ptp', href: '/collections-desk.html?pane=ptp', legacy: ['collections.operations'] },
  { group: 'Collections', label: 'Payment Plans', key: 'menu.col.plans', href: '/collections-plans.html', legacy: ['collections.operations'] },
  { group: 'Collections', label: 'Accounts', key: 'menu.col.accounts', href: '/collections-desk.html', legacy: ['collections.accounts'] },
  { group: 'Collections', label: 'Aging', key: 'menu.col.aging', href: '/collections-aging.html', legacy: ['collections.accounts'] },
  { group: 'Collections', label: 'Escalations', key: 'menu.col.escalations', href: '/collections-escalations.html', legacy: ['collections.workflow'] },
  { group: 'Collections', label: 'Publish Live Book', key: 'menu.col.publish', href: '/collections-publish.html', legacy: ['collections.workflow'] },
  { group: 'Collections', label: 'Allocation Rules', key: 'menu.col.rules', href: '/collections-desk.html?pane=rules', legacy: ['collections.strategy'] },
  { group: 'Collections', label: 'Contact Strategy', key: 'menu.col.strategy', href: '/collections-desk.html?pane=strategy', legacy: ['collections.strategy'] },

  { group: 'Reports', label: 'All Reports', key: 'menu.reports.all', href: '/reports.html', legacy: ['report.profit_loss', 'report.stock'] },
  { group: 'Reports · Purchase', label: 'Purchase & Sale', key: 'menu.reports.purchase_sell', href: '/report-purchase-sell.html', legacy: ['report.purchase_sell'] },
  { group: 'Reports · Inventory', label: 'Stock Report', key: 'menu.reports.stock', href: '/report-stock.html', legacy: ['report.stock'] },
  { group: 'Operations', label: 'Stock History', key: 'menu.ops.stock_history', href: '/product-stock-history.html', legacy: ['report.stock_history', 'product.view'] },
  { group: 'Reports · Inventory', label: 'Trending Products', key: 'menu.reports.trending', href: '/trending-products.html', legacy: ['report.trending'] },
  { group: 'Reports · Sales', label: 'Sales Representative Report', key: 'menu.reports.sales_rep', href: '/report-sales-rep.html', legacy: ['report.sales_rep'] },
  { group: 'Reports · Sales', label: 'Sell Payment Report', key: 'menu.reports.sell_pay', href: '/sell-payments.html', legacy: ['sell.view_all', 'sell.view_own'] },
  { group: 'Reports · Sales', label: 'POS Register Report', key: 'menu.reports.register', href: '/report-register.html', legacy: ['report.register'] },
  { group: 'Reports · Finance', label: 'Profit / Loss Report', key: 'menu.reports.pl', href: '/report-profit-loss.html', legacy: ['report.profit_loss'] },
  { group: 'Reports · Finance', label: 'Tax Report', key: 'menu.reports.tax', href: '/report-tax.html', legacy: ['report.tax'] },
  { group: 'Reports · Finance', label: 'Expense Report', key: 'menu.reports.expense', href: '/report-expense.html', legacy: ['report.expense'] },
  { group: 'Reports · System', label: 'Customers & Suppliers', key: 'menu.reports.contacts', href: '/report-contacts.html', legacy: ['report.supplier_customer'] },
  { group: 'Reports · Collections', label: 'Collections reports', key: 'menu.reports.collections', href: '/reports.html?t=col-age', legacy: ['report.collections', 'collections.access'] },

  { group: 'System · Settings', label: 'Technical documentation', key: 'menu.system.manual', href: '/manual.html', legacy: ['home.view', 'settings.business'] },
  { group: 'System · Settings', label: 'Business Settings', key: 'menu.system.business', href: '/settings.html', legacy: ['settings.business'] },
  { group: 'System · Settings', label: 'Till & staff hours', key: 'menu.system.till_policy', href: '/till-policy.html', legacy: ['settings.business'] },
  { group: 'System · Settings', label: 'Accounting map', key: 'menu.system.acct_map', href: '/accounting-settings.html', legacy: ['settings.business'] },
  { group: 'System · Settings', label: 'Business Locations', key: 'menu.system.locations', href: '/business-locations.html', legacy: ['settings.locations', 'settings.business'] },
  { group: 'System · Settings', label: 'Invoice Schemes', key: 'menu.system.invoice_schemes', href: '/invoice-schemes.html', legacy: ['settings.invoice', 'settings.business'] },
  { group: 'System · Settings', label: 'Location Price Groups', key: 'menu.system.price_groups', href: '/selling-price-groups.html', legacy: ['settings.business'] },
  { group: 'System · Settings', label: 'Invoice Settings', key: 'menu.system.invoice', href: '/invoice-settings.html', legacy: ['settings.invoice'] },
  { group: 'System · Settings', label: 'Barcode Settings', key: 'menu.system.barcode', href: '/barcode-settings.html', legacy: ['settings.barcode'] },
  { group: 'System · Settings', label: 'Receipt Printers', key: 'menu.system.printers', href: '/printers.html', legacy: ['settings.printers'] },
  { group: 'System · Settings', label: 'Tax Rates', key: 'menu.system.tax', href: '/tax-rates.html', legacy: ['tax.view'] },
  { group: 'System · Settings', label: 'Payment Gateways', key: 'menu.system.pay', href: '/payment-settings.html', legacy: ['settings.business'] },
  { group: 'System · Settings', label: 'Notification Templates', key: 'menu.system.notify', href: '/notifications.html', legacy: ['settings.notifications'] },
  { group: 'System · Settings', label: 'SMS gateway', key: 'menu.system.sms', href: '/sms-settings.html', legacy: ['settings.notifications'] },
  { group: 'System · Settings', label: 'Backup', key: 'menu.system.backup', href: '/backup.html', legacy: ['settings.backup'] },

  { group: 'System · Users', label: 'Users', key: 'menu.system.users', href: '/users.html', legacy: ['user.view'] },
  { group: 'System · Users', label: 'Import Users', key: 'menu.system.import_users', href: '/import-users.html', legacy: ['user.add', 'user.edit'] },
  { group: 'System · Users', label: 'Roles', key: 'menu.system.roles', href: '/roles.html', legacy: ['role.view'] },
  { group: 'System · Users', label: 'Sales Commission Agents', key: 'menu.system.commission', href: '/commission-agents.html', legacy: ['commission.view'] },
  { group: 'System · Users', label: 'Audit log', key: 'menu.system.audit', href: '/audit-log.html', legacy: ['audit.view'] },
  { group: 'System · Users', label: 'Notification log', key: 'menu.system.notify_log', href: '/notification-log.html', legacy: ['audit.view'] },
];

const FILE_STEM = {
  'products.html': 'product', 'product-form.html': 'product', 'product-view.html': 'product',
  'product-catalog.html': 'product', 'update-price.html': 'product',
  'customers.html': 'customer', 'customer-form.html': 'customer', 'customer-view.html': 'customer',
  'customer-groups.html': 'customer', 'client-groups.html': 'customer',
  'suppliers.html': 'supplier', 'supplier-form.html': 'supplier', 'supplier-groups.html': 'supplier',
  'users.html': 'user', 'user-edit.html': 'user', 'user-view.html': 'user',
  'roles.html': 'role', 'roles-edit.html': 'role',
  'brands.html': 'brand', 'brand-edit.html': 'brand',
  'units.html': 'unit', 'unit-edit.html': 'unit',
  'categories.html': 'category', 'category-edit.html': 'category',
  'warranties.html': 'warranty', 'warranty-edit.html': 'warranty',
  'purchase-orders.html': 'purchase', 'purchase-form.html': 'purchase',
  'purchase-returns.html': 'purchase', 'purchase-invoices.html': 'purchase',
  'sales-orders.html': 'sell', 'sales-form.html': 'sell', 'pos-sales.html': 'pos',
  'drafts.html': 'draft', 'draft-form.html': 'draft',
  'quotations.html': 'quotation', 'quotation-form.html': 'quotation',
  'sell-returns.html': 'sell', 'shipments.html': 'shipments',
  'stock-transfers.html': 'stock_transfer', 'stock-transfer-form.html': 'stock_transfer',
  'stock-adjustments.html': 'stock_adjustment', 'stock-adjustment-form.html': 'stock_adjustment',
  'expenses.html': 'expense', 'expense-form.html': 'expense',
  'pos-sessions.html': 'cash_register', 'till-alerts.html': 'cash_register', 'cash-register.html': 'cash_register',
  'projects.html': 'project', 'project-form.html': 'project',
  'assets.html': 'asset', 'asset-form.html': 'asset',
  'hrm.html': 'hrm', 'holidays.html': 'hrm.holiday', 'departments.html': 'essentials.department',
  'designations.html': 'essentials.designation',
  'commission-agents.html': 'commission', 'commission-agent-edit.html': 'commission',
  'loyalty-cards.html': 'customer', 'investors.html': 'customer', 'partners.html': 'customer',
  'consultants.html': 'customer',
  'accounting.html': 'accounting',
  'call-centre.html': 'crm',
  'collections-desk.html': 'collections',
  'collections.html': 'collections',
  'field-ops.html': 'field_ops',
  'wms.html': 'stock_transfer',
  'spreadsheet.html': 'spreadsheet',
  'academy.html': 'academy',
  'communications.html': 'essentials',
  'todos.html': 'essentials', 'documents.html': 'essentials',
  'price-groups.html': 'product', 'variations.html': 'product',
  'discounts.html': 'sell.discount',
};

function normHref(href) {
  const s = String(href || '');
  try {
    const u = new URL(s, 'https://erp.local');
    const file = '/' + (u.pathname.split('/').pop() || '');
    const q = u.search || '';
    return file + q;
  } catch {
    return s;
  }
}

export function allLeaves() {
  return [...MENU_LEAVES, ...COLOR_LEAVES];
}

export const COLOR_LEAVES = [
  { group: 'Accounting', label: 'Accounting', key: 'menu.acct.home', href: '/accounting.html', legacy: ['accounting.access', 'account.access'] },
  { group: 'Accounting', label: 'Chart of accounts', key: 'menu.acct.coa', href: '/accounting.html?tab=coa', legacy: ['accounting.access'] },
  { group: 'Accounting', label: 'Journal Entry', key: 'menu.acct.je', href: '/accounting.html?tab=je', legacy: ['accounting.journal.view'] },
  { group: 'Accounting', label: 'Transfer', key: 'menu.acct.xfer', href: '/accounting.html?tab=xfer', legacy: ['accounting.transfer.view'] },
  { group: 'Accounting', label: 'Transactions', key: 'menu.acct.tx', href: '/accounting.html?tab=tx', legacy: ['accounting.access'] },
  { group: 'Accounting', label: 'Budget', key: 'menu.acct.budget', href: '/accounting.html?tab=budget', legacy: ['accounting.budget'] },
  { group: 'Accounting', label: 'Reports', key: 'menu.acct.reports', href: '/accounting.html?tab=reports', legacy: ['accounting.reports'] },
  { group: 'AI Assistance', label: 'AI Assistance', key: 'menu.ai.home', href: '/ai-assistance.html', legacy: ['ai.access'] },
  { group: 'AI Assistance', label: 'History', key: 'menu.ai.history', href: '/ai-assistance.html?tab=history', legacy: ['ai.history'] },
  { group: 'Asset Management', label: 'Assets', key: 'menu.assets.home', href: '/assets.html', legacy: ['asset.view'] },
  { group: 'Asset Management', label: 'Asset allocated', key: 'menu.assets.alloc', href: '/assets.html?tab=allocated', legacy: ['asset.allocate'] },
  { group: 'Asset Management', label: 'Asset maintenance', key: 'menu.assets.maint', href: '/assets.html?tab=maint', legacy: ['asset.maint_all', 'asset.maint_own'] },
  { group: 'Call Centre', label: 'Inbox', key: 'menu.cc.inbox', href: '/call-centre.html', legacy: ['crm.leads_all', 'crm.leads_own'] },
  { group: 'Call Centre', label: 'Missed / callback', key: 'menu.cc.missed', href: '/call-centre.html?pane=missed', legacy: ['crm.leads_all', 'crm.leads_own'] },
  { group: 'Call Centre', label: 'Queues', key: 'menu.cc.queues', href: '/call-centre.html?pane=queues', legacy: ['crm.leads_all'] },
  { group: 'Call Centre', label: 'Campaigns', key: 'menu.cc.campaigns', href: '/call-centre.html?pane=campaigns', legacy: ['crm.campaigns_all'] },
  { group: 'Call Centre', label: 'Agents', key: 'menu.cc.agents', href: '/call-centre.html?pane=agents', legacy: ['crm.leads_all'] },
  { group: 'Catalogue QR', label: 'Catalogue QR', key: 'menu.qr.home', href: '/catalogue-qr.html', legacy: ['qr.view'] },
  { group: 'Communications', label: 'Floor', key: 'menu.comm.floor', href: '/communications.html', legacy: ['comm.access'] },
  { group: 'Communications', label: 'Announcements', key: 'menu.comm.announce', href: '/communications.html?tab=announce', legacy: ['comm.announcements'] },
  { group: 'Communications', label: 'Messages', key: 'menu.comm.msg', href: '/communications.html?tab=msg', legacy: ['comm.messages'] },
  { group: 'Communications', label: 'Calls', key: 'menu.comm.calls', href: '/communications.html?tab=calls', legacy: ['comm.calls'] },
  { group: 'Communications', label: 'Meetings', key: 'menu.comm.meet', href: '/communications.html?tab=meet', legacy: ['comm.meetings'] },
  { group: 'Communications', label: 'Groups', key: 'menu.comm.groups', href: '/communications.html?tab=groups', legacy: ['comm.groups'] },
  { group: 'Communications', label: 'To Do', key: 'menu.comm.todo', href: '/communications.html?tab=todo', legacy: ['essentials.todo_add'] },
  { group: 'Communications', label: 'Documents', key: 'menu.comm.docs', href: '/communications.html?tab=docs', legacy: ['essentials.docs'] },
  { group: 'Communications', label: 'Memos', key: 'menu.comm.memos', href: '/communications.html?tab=memos', legacy: ['essentials.memos'] },
  { group: 'Communications', label: 'Reminders', key: 'menu.comm.remind', href: '/communications.html?tab=remind', legacy: ['essentials.reminders'] },
  { group: 'Academy', label: 'Academy', key: 'menu.academy.home', href: '/academy.html', legacy: ['academy.access', 'home.view'] },
  { group: 'Academy', label: 'User Manual', key: 'menu.academy.manuals', href: '/academy.html?tab=manuals', legacy: ['academy.manuals', 'home.view'] },
  { group: 'Academy', label: 'Knowledge Base', key: 'menu.academy.kb', href: '/academy.html?tab=kb', legacy: ['academy.kb', 'essentials.kb'] },
  { group: 'Academy', label: 'Policies', key: 'menu.academy.policies', href: '/academy.html?tab=policies', legacy: ['academy.policies'] },
  { group: 'Connector', label: 'Connector', key: 'menu.connector.home', href: '/connector.html', legacy: ['connector.access'] },
  { group: 'CRM', label: 'CRM', key: 'menu.crm.home', href: '/crm.html', legacy: ['crm.leads_all', 'crm.leads_own'] },
  { group: 'CRM', label: 'Follow ups', key: 'menu.crm.followups', href: '/crm.html?tab=followups', legacy: ['crm.followup_all', 'crm.followup_own'] },
  { group: 'CRM', label: 'Leads', key: 'menu.crm.leads', href: '/crm.html?tab=leads', legacy: ['crm.leads_all', 'crm.leads_own'] },
  { group: 'CRM', label: 'Campaigns', key: 'menu.crm.campaigns', href: '/crm.html?tab=campaigns', legacy: ['crm.campaigns_all'] },
  { group: 'Custom Dashboards', label: 'Manage', key: 'menu.dash.manage', href: '/custom-dashboards.html', legacy: ['dashboard.manage'] },
  { group: 'Custom Dashboards', label: 'Create', key: 'menu.dash.create', href: '/custom-dashboards.html?tab=create', legacy: ['dashboard.manage'] },
  { group: 'Field Ops', label: 'Floor', key: 'menu.fo.floor', href: '/field-ops.html', legacy: ['field_ops.floor'] },
  { group: 'Field Ops', label: 'Order List', key: 'menu.fo.orders', href: '/field-ops.html?tab=orders', legacy: ['field_ops.orders', 'field_ops.view_all'] },
  { group: 'Field Ops', label: 'Visits', key: 'menu.fo.visits', href: '/field-ops.html?tab=visits', legacy: ['field_ops.view_all', 'field_ops.view_own'] },
  { group: 'HRM', label: 'People', key: 'menu.hrm.people', href: '/hrm.html?tab=people', legacy: ['hrm.view_all', 'hrm.view_own'] },
  { group: 'HRM', label: 'Leave', key: 'menu.hrm.leave', href: '/hrm.html?tab=leave', legacy: ['essentials.leave_all', 'essentials.leave_own'] },
  { group: 'HRM', label: 'Attendance', key: 'menu.hrm.att', href: '/hrm.html?tab=att', legacy: ['essentials.attendance_all', 'essentials.attendance_own'] },
  { group: 'HRM', label: 'Payroll', key: 'menu.hrm.payroll', href: '/hrm.html?tab=payroll', legacy: ['essentials.payroll_view'] },
  { group: 'HRM', label: 'Departments', key: 'menu.hrm.dept', href: '/hrm.html?tab=dept', legacy: ['essentials.department.view', 'essentials.department'] },
  { group: 'HRM', label: 'Designations', key: 'menu.hrm.desig', href: '/hrm.html?tab=desig', legacy: ['essentials.designation.view', 'essentials.designation'] },
  { group: 'HRM', label: 'Holiday', key: 'menu.hrm.holiday', href: '/hrm.html?tab=holiday', legacy: ['hrm.holiday.view', 'hrm.holiday'] },
  { group: 'Manufacturing', label: 'Manufacturing', key: 'menu.mfg.home', href: '/manufacturing.html', legacy: ['manufacturing.access'] },
  { group: 'Project', label: 'Projects', key: 'menu.proj.home', href: '/projects.html', legacy: ['project.view'] },
  { group: 'Project', label: 'My Tasks', key: 'menu.proj.tasks', href: '/projects.html?tab=tasks', legacy: ['project.tasks'] },
  { group: 'Repair', label: 'Repair', key: 'menu.repair.home', href: '/repair.html', legacy: ['repair.job_all', 'repair.invoice_all'] },
  { group: 'Repair', label: 'Job Sheets', key: 'menu.repair.jobs', href: '/repair.html?tab=jobs', legacy: ['repair.job_all', 'repair.job_assigned'] },
  { group: 'Repair', label: 'List Invoices', key: 'menu.repair.inv', href: '/repair.html?tab=inv', legacy: ['repair.invoice_all', 'repair.invoice_own'] },
  { group: 'Spreadsheet', label: 'Spreadsheet', key: 'menu.sheet.home', href: '/spreadsheet.html', legacy: ['spreadsheet.access'] },
  { group: 'WMS', label: 'Floor', key: 'menu.wms.floor', href: '/wms.html', legacy: ['ops.access', 'stock_transfer.view_all'] },
  { group: 'WMS', label: 'Receiving', key: 'menu.wms.recv', href: '/wms.html?tab=recv', legacy: ['ops.receive'] },
  { group: 'WMS', label: 'Put Away', key: 'menu.wms.putaway', href: '/wms.html?tab=putaway', legacy: ['ops.putaway'] },
  { group: 'WMS', label: 'Transfers', key: 'menu.wms.xfer', href: '/wms.html?tab=xfer', legacy: ['stock_transfer.view_all'] },
  { group: 'WooCommerce', label: 'WooCommerce', key: 'menu.woo.home', href: '/woocommerce.html', legacy: ['woo.api'] },
  { group: 'WooCommerce', label: 'Sync Log', key: 'menu.woo.log', href: '/woocommerce.html?tab=log', legacy: ['woo.sync_products'] },
];

export const FORM_ORDER = [
  'Cashier',
  'Home',
  'Records · Contacts', 'Records · Products',
  'Operations', 'Purchases', 'Sales', 'POS', 'Finance', 'Collections',
  'Reports', 'Reports · Purchase', 'Reports · Inventory', 'Reports · Sales', 'Reports · Finance', 'Reports · Collections', 'Reports · System',
  'System · Settings', 'System · Users',
  'Accounting', 'Academy', 'AI Assistance', 'Asset Management', 'Call Centre', 'Catalogue QR',
  'Communications', 'Connector', 'CRM', 'Custom Dashboards', 'Field Ops', 'HRM',
  'Manufacturing', 'Project', 'Repair', 'Spreadsheet', 'WMS', 'WooCommerce',
];

export function screenPermGroups() {
  const by = new Map();
  allLeaves().forEach((l) => {
    if (!by.has(l.group)) by.set(l.group, []);
    by.get(l.group).push({ key: l.key, label: l.label });
  });
  return FORM_ORDER.filter((label) => by.has(label)).map((label) => ({
    code: 'menu_' + label.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    label,
    perms: by.get(label),
  }));
}

export function expandLegacyMenuPerms(perms) {
  if (!perms || typeof perms !== 'object') return perms;
  allLeaves().forEach((l) => {
    if (!perms[l.key]) return;
    (l.legacy || []).forEach((k) => { perms[k] = true; });
  });
  return perms;
}

export function needForHref(href) {
  const n = normHref(href);
  const leaves = allLeaves();
  const hit = leaves.find((l) => normHref(l.href) === n)
    || leaves.find((l) => normHref(l.href).split('?')[0] === n.split('?')[0]);
  if (!hit) return '';
  return hit.key;
}

export function applyToMenu(menu) {
  if (!Array.isArray(menu)) return menu;
  const walk = (items) => {
    (items || []).forEach((item) => {
      if (item.href) {
        const need = needForHref(item.href);
        if (need) item.perm = need;
      }
      if (item.children) walk(item.children);
      if (item.pages) walk(item.pages);
    });
  };
  walk(menu);
  return menu;
}

export function actionNeed(act, file) {
  const name = String(file || '').split('?')[0].split('/').pop().toLowerCase();
  const stem = FILE_STEM[name];
  const a = String(act || '').toLowerCase();
  if (!stem) {
    if (a === 'edit' || a === 'update' || a === 'del' || a === 'delete' || a === 'remove' || a === 'add' || a === 'new' || a === 'create') {
      return '__crud_unmapped__';
    }
    return '';
  }
  if (a === 'view' || a === 'open') {
    return [stem + '.view', stem + '.view_all', stem + '.view_own'].join('|');
  }
  if (a === 'edit' || a === 'update') return stem + '.edit|' + stem + '.update';
  if (a === 'del' || a === 'delete' || a === 'remove') return stem + '.delete';
  if (a === 'add' || a === 'new' || a === 'create') return stem + '.add|' + stem + '.create';
  if (a === 'print') return 'pos.print|others.export';
  return '';
}

export function routePermMap() {
  const out = {};
  allLeaves().forEach((l) => {
    const file = String(l.href).split('?')[0].replace(/^\//, '').toLowerCase();
    if (!out[file]) out[file] = l.key;
    else if (!String(out[file]).split('|').includes(l.key)) out[file] = out[file] + '|' + l.key;
  });
  return out;
}
