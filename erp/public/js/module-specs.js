/** One spec per permission group we are deepening. */
export const SPECS = {
  brands: {
    title: 'Brand', table: 'brands', view: 'brand.view', add: 'brand.add', edit: 'brand.edit', del: 'brand.delete',
    cols: [
      { key: 'name', label: 'Name', required: true },
      { key: 'description', label: 'Description' },
    ],
  },
  units: {
    title: 'Unit', table: 'units', view: 'unit.view', add: 'unit.add', edit: 'unit.edit', del: 'unit.delete',
    cols: [
      { key: 'name', label: 'Name', required: true },
      { key: 'short_name', label: 'Short name' },
      { key: 'allow_decimal', label: 'Allow decimal', type: 'checkbox' },
    ],
  },
  'tax-rates': {
    title: 'Tax rate', table: 'tax_rates', view: 'tax.view', add: 'tax.add', edit: 'tax.edit', del: 'tax.delete',
    cols: [
      { key: 'name', label: 'Name', required: true },
      { key: 'rate', label: 'Rate %', type: 'number' },
      { key: 'is_tax_group', label: 'Tax group', type: 'checkbox' },
    ],
  },
  categories: {
    title: 'Category', table: 'categories', view: 'category.view', add: 'category.add', edit: 'category.edit', del: 'category.delete',
    cols: [
      { key: 'name', label: 'Name', required: true },
      { key: 'short_code', label: 'Short code' },
      { key: 'parent_name', label: 'Parent' },
    ],
  },
  'selling-price-groups': {
    title: 'Selling price groups', table: 'selling_price_groups', view: 'spg.default', add: 'spg.default', edit: 'spg.default', del: 'spg.default',
    cols: [
      { key: 'name', label: 'Name', required: true },
      { key: 'description', label: 'Description' },
      { key: 'is_default', label: 'Default selling price', type: 'checkbox' },
    ],
  },
  drafts: {
    title: 'Drafts', table: 'sale_drafts', view: 'draft.view_all', add: 'draft.edit', edit: 'draft.edit', del: 'draft.delete',
    cols: [
      { key: 'ref_no', label: 'Ref' },
      { key: 'customer_name', label: 'Customer' },
      { key: 'total', label: 'Total', type: 'number' },
      { key: 'status', label: 'Status' },
      { key: 'note', label: 'Note' },
    ],
  },
  quotations: {
    title: 'Quotations', table: 'quotations', view: 'quotation.view_all', add: 'quotation.edit', edit: 'quotation.edit', del: 'quotation.delete',
    cols: [
      { key: 'ref_no', label: 'Ref' },
      { key: 'customer_name', label: 'Customer', required: true },
      { key: 'total', label: 'Total', type: 'number' },
      { key: 'status', label: 'Status' },
      { key: 'valid_until', label: 'Valid until', type: 'date' },
    ],
  },
  shipments: {
    title: 'Shipments', table: 'shipments', view: 'shipments.access_all', add: 'shipments.access_all', edit: 'shipments.access_all', del: 'shipments.access_all',
    cols: [
      { key: 'ref_no', label: 'Ref' },
      { key: 'customer_name', label: 'Customer' },
      { key: 'status', label: 'Status' },
      { key: 'shipped_on', label: 'Shipped on', type: 'date' },
      { key: 'note', label: 'Note' },
    ],
  },
  sells: {
    title: 'Sell', table: 'sells', view: 'sell.view_all', add: 'sell.add', edit: 'sell.update', del: 'sell.delete',
    cols: [
      { key: 'invoice_no', label: 'Invoice' },
      { key: 'customer_name', label: 'Customer', required: true },
      { key: 'status', label: 'Payment status' },
      { key: 'total', label: 'Total', type: 'number' },
      { key: 'paid', label: 'Paid', type: 'number' },
      { key: 'sale_date', label: 'Date', type: 'date' },
    ],
  },
  'sell-returns': {
    title: 'Sell return', table: 'sell_returns', view: 'sell.return_all', add: 'sell.return_all', edit: 'sell.return_all', del: 'sell.return_all',
    cols: [
      { key: 'ref_no', label: 'Ref' },
      { key: 'invoice_no', label: 'Original invoice' },
      { key: 'customer_name', label: 'Customer' },
      { key: 'total', label: 'Total', type: 'number' },
      { key: 'return_date', label: 'Date', type: 'date' },
    ],
  },
  purchases: {
    title: 'Purchase', table: 'purchases', view: 'purchase.view_all', add: 'purchase.add', edit: 'purchase.edit', del: 'purchase.delete',
    cols: [
      { key: 'ref_no', label: 'Ref' },
      { key: 'supplier_name', label: 'Supplier', required: true },
      { key: 'status', label: 'Status' },
      { key: 'total', label: 'Total', type: 'number' },
      { key: 'purchase_date', label: 'Date', type: 'date' },
    ],
  },
  expenses: {
    title: 'Expense', table: 'expenses', view: 'expense.access_all', add: 'expense.add', edit: 'expense.edit', del: 'expense.delete',
    cols: [
      { key: 'ref_no', label: 'Ref' },
      { key: 'category', label: 'Category' },
      { key: 'amount', label: 'Amount', type: 'number', required: true },
      { key: 'expense_date', label: 'Date', type: 'date' },
      { key: 'note', label: 'Note' },
    ],
  },
  journals: {
    title: 'Journal', table: 'journals', view: 'accounting.journal.view', add: 'accounting.journal.add', edit: 'accounting.journal.edit', del: 'accounting.journal.delete',
    cols: [
      { key: 'ref_no', label: 'Ref' },
      { key: 'journal_date', label: 'Date', type: 'date' },
      { key: 'narration', label: 'Narration', required: true },
      { key: 'total', label: 'Total', type: 'number' },
    ],
  },
  budgets: {
    title: 'Budget', table: 'budgets', view: 'accounting.budget', add: 'accounting.budget', edit: 'accounting.budget', del: 'accounting.budget',
    cols: [
      { key: 'name', label: 'Name', required: true },
      { key: 'period', label: 'Period' },
      { key: 'amount', label: 'Amount', type: 'number' },
      { key: 'note', label: 'Note' },
    ],
  },
  'cash-register': {
    title: 'Cash register', table: 'cash_registers', view: 'cash_register.view', add: 'cash_register.view', edit: 'cash_register.close', del: 'cash_register.close',
    cols: [
      { key: 'location_code', label: 'Location' },
      { key: 'opened_at', label: 'Opened' },
      { key: 'closed_at', label: 'Closed' },
      { key: 'opening_cash', label: 'Opening cash', type: 'number' },
      { key: 'closing_cash', label: 'Closing cash', type: 'number' },
      { key: 'status', label: 'Status' },
    ],
  },
  cheques: {
    title: 'Cheque', table: 'cheques', view: 'cheque.received', add: 'cheque.received', edit: 'cheque.received', del: 'cheque.issued',
    cols: [
      { key: 'cheque_number', label: 'Number', required: true },
      { key: 'bank_name', label: 'Bank' },
      { key: 'amount', label: 'Amount', type: 'number' },
      { key: 'direction', label: 'incoming / outgoing' },
      { key: 'status', label: 'Status' },
      { key: 'payee', label: 'Payee' },
    ],
  },
  'crm-leads': {
    title: 'CRM leads', table: 'crm_leads', view: 'crm.leads_all', add: 'crm.leads_all', edit: 'crm.leads_all', del: 'crm.leads_all',
    cols: [
      { key: 'name', label: 'Name', required: true },
      { key: 'company', label: 'Company' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
      { key: 'source', label: 'Source' },
      { key: 'status', label: 'Status' },
    ],
  },
  'crm-followups': {
    title: 'CRM follow up', table: 'crm_followups', view: 'crm.followup_all', add: 'crm.followup_all', edit: 'crm.followup_all', del: 'crm.followup_all',
    cols: [
      { key: 'subject', label: 'Subject', required: true },
      { key: 'contact_name', label: 'Contact' },
      { key: 'due_on', label: 'Due', type: 'date' },
      { key: 'status', label: 'Status' },
      { key: 'note', label: 'Note' },
    ],
  },
  'crm-campaigns': {
    title: 'CRM campaigns', table: 'crm_campaigns', view: 'crm.campaigns_all', add: 'crm.campaigns_all', edit: 'crm.campaigns_all', del: 'crm.campaigns_all',
    cols: [
      { key: 'name', label: 'Name', required: true },
      { key: 'channel', label: 'Channel' },
      { key: 'status', label: 'Status' },
      { key: 'start_date', label: 'Start', type: 'date' },
      { key: 'end_date', label: 'End', type: 'date' },
    ],
  },
  projects: {
    title: 'Project', table: 'projects', view: 'project.create', add: 'project.create', edit: 'project.edit', del: 'project.delete',
    cols: [
      { key: 'name', label: 'Name', required: true },
      { key: 'client_name', label: 'Client' },
      { key: 'status', label: 'Status' },
      { key: 'budget', label: 'Budget', type: 'number' },
      { key: 'start_date', label: 'Start', type: 'date' },
    ],
  },
  'repair-invoices': {
    title: 'Repair invoices', table: 'repair_invoices', view: 'repair.invoice_all', add: 'repair.invoice_add', edit: 'repair.invoice_edit', del: 'repair.invoice_delete',
    cols: [
      { key: 'invoice_no', label: 'Invoice' },
      { key: 'customer_name', label: 'Customer', required: true },
      { key: 'device', label: 'Device' },
      { key: 'status', label: 'Status' },
      { key: 'total', label: 'Total', type: 'number' },
    ],
  },
  'repair-jobs': {
    title: 'Job sheets', table: 'repair_jobs', view: 'repair.job_all', add: 'repair.job_add', edit: 'repair.job_edit', del: 'repair.job_delete',
    cols: [
      { key: 'job_no', label: 'Job no' },
      { key: 'customer_name', label: 'Customer' },
      { key: 'device', label: 'Device', required: true },
      { key: 'status', label: 'Status' },
      { key: 'assigned_to', label: 'Assigned to' },
    ],
  },
  spreadsheets: {
    title: 'Spreadsheet', table: 'spreadsheets', view: 'spreadsheet.access', add: 'spreadsheet.create', edit: 'spreadsheet.access', del: 'spreadsheet.access',
    cols: [
      { key: 'name', label: 'Name', required: true },
      { key: 'folder', label: 'Folder' },
      { key: 'shared_with', label: 'Shared with' },
    ],
  },
  woocommerce: {
    title: 'WooCommerce', table: 'woo_settings', view: 'woo.api', add: 'woo.api', edit: 'woo.api', del: 'woo.api',
    cols: [
      { key: 'store_url', label: 'Store URL', required: true },
      { key: 'consumer_key', label: 'Consumer key' },
      { key: 'last_sync', label: 'Last sync' },
      { key: 'note', label: 'Note' },
    ],
  },
};
