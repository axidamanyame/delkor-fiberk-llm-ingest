/**
 * SUPERSEDED — legacy Fiberkapp menu, kept for layout reference.
 *
 * The live menu is the MENU array in ultimate-shell.js. Nothing here is wired
 * to RBAC, so importing it would expose links the current role may not be
 * allowed to open.
 */
/** Fiberkapp left menu as scraped from /home sidebar (layout only). */
export const FIBERKAPP_NAV = [
  { label: 'Home', href: '/dashboard.html' },
  { label: 'Products', children: [
    'List Products|/products.html',
    'Add Product|/product-form.html',
    'Update Price|/update-price.html',
    'Print Labels|/print-labels.html',
    'Variations|/variations.html',
    'Import Products|/import-products.html',
    'Import Opening Stock|/opening-stock.html',
    'Selling Price Group|/price-groups.html',
    'Units|/units.html',
    'Categories|/categories.html',
    'Brands|/brands.html',
    'Warranties|/warranties.html',
  ] },
  { label: 'Sale', children: [
    'All sales|/pos-sales.html',
    'Add Sale|/sales-form.html',
    'List POS|/pos-sales.html',
    'POS|/till-login.html',
    'Add Draft|/draft-form.html',
    'List Drafts|/drafts.html',
    'Add Quotation|/quotation-form.html',
    'List quotations|/quotations.html',
    'List Sell Return|/sell-returns.html',
    'Shipments|/shipments.html',
    'Discounts|/discounts.html',
    'Import Sales|/import-sales.html',
  ] },
  { label: 'Purchases', children: [
    'List Purchases|/purchase-orders.html',
    'Add Purchase|/purchase-form.html',
    'List Purchase Return|/purchase-returns.html',
  ] },
  { label: 'Manufacturing', href: '/manufacturing.html' },
  { label: 'Repair', href: '/repair-till.html' },
  { label: 'Stock Transfers', children: [
    'List Stock Transfers|/stock-transfers.html',
    'Add Stock Transfer|/stock-transfer-form.html',
  ] },
  { label: 'Stock Adjustment', children: [
    'List Stock Adjustments|/stock-adjustments.html',
    'Add Stock Adjustment|/stock-adjustment-form.html',
  ] },
  { label: 'Contacts', children: [
    'Suppliers|/suppliers.html',
    'Customers|/customers.html',
    'Customer Groups|/customer-groups.html',
    'Import Contacts|/contacts-import.html',
  ] },
  { label: 'User Management', children: [
    'Users|/users.html',
    'Roles|/roles.html',
    'Sales Commission Agents|/commission-agents.html',
  ] },
  { label: 'Expenses', children: [
    'List Expenses|/expenses.html',
    'Add Expense|/expense-form.html',
    'Expense Categories|/expense-categories.html',
  ] },
  { label: 'Payment Accounts', children: [
    'List Accounts|/payment-accounts.html',
    'Balance Sheet|/account-balance-sheet.html',
    'Trial Balance|/account-trial-balance.html',
    'Cash Flow|/account-cash-flow.html',
    'Payment Account Report|/payment-account-report.html',
  ] },
  { label: 'Accounting', href: '/accounting.html' },
  { label: 'Reports', href: '/reports.html' },
  { label: 'Orders', href: '/sales-orders.html' },
  { label: 'Notification Templates', href: '/notifications.html' },
  { label: 'Settings', href: '/settings.html' },
  { label: 'CRM', href: '/crm.html' },
  { label: 'Project', href: '/projects.html' },
  { label: 'Asset Management', href: '/assets.html' },
  { label: 'HRM', href: '/hrm.html' },
  { label: 'Communications', href: '/communications.html' },
  { label: 'Spreadsheet', href: '/spreadsheet.html' },
];

function keepArchive(href) {
  if (!href || href.startsWith('http')) return href;
  if (/[?&]ws=/.test(href)) return href;
  return href.includes('?') ? `${href}&ws=archive` : `${href}?ws=archive`;
}

export function fiberkappMenu() {
  const clone = FIBERKAPP_NAV.map((item) => {
    if (item.children) {
      return {
        label: item.label,
        children: item.children.map((s) => {
          const [label, href] = String(s).split('|');
          return { label: label.trim(), href: keepArchive((href || '').trim()) };
        }),
      };
    }
    return { label: item.label, href: keepArchive(item.href) };
  });
  return [
    { href: '/dashboard.html?ws=live', label: 'DELKOR-FIBERK GROUP', icon: 'home' },
    ...clone,
  ];
}
