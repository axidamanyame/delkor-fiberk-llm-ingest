import { registerClickGuard, PRIORITY } from './click-router.js';
/** Map Fiberkapp-style paths onto ERP pages so the rail does not 404. */
const MAP = {
  '/sells.html': '/pos-sales.html',
  '/sells': '/pos-sales.html',
  '/purchases.html': '/purchase-orders.html',
  '/purchases': '/purchase-orders.html',
  '/products/create': '/product-form.html',
  '/sells/create': '/sales-form.html',
  '/purchases/create': '/purchase-form.html',
  '/accounting/dashboard': '/accounting.html',
  '/accounting/chart-of-accounts': '/accounting-coa.html',
  '/accounting/journal-entry': '/accounting-journal.html',
  '/accounting/journal-entry/create': '/accounting-journal-form.html',
  '/accounting/transfer': '/accounting-transfer.html',
  '/accounting/transactions': '/accounting-transactions.html',
  '/accounting/budget': '/accounting-budget.html',
  '/accounting/reports': '/accounting-reports.html',
  '/account/account': '/payment-accounts.html',
  '/account/balance-sheet': '/account-balance-sheet.html',
  '/account/trial-balance': '/account-trial-balance.html',
  '/account/cash-flow': '/account-cash-flow.html',
  '/hrm/dashboard': '/hrm.html',
  '/hrm/leave': '/hrm.html?tab=leave',
  '/hrm/leave-type': '/hrm.html?tab=types',
  '/hrm/attendance': '/hrm.html?tab=att',
  '/hrm/payroll': '/hrm.html?tab=payroll',
  '/hrm/holiday': '/hrm.html?tab=holiday',
  '/hrm/sales-target': '/hrm.html?tab=targets',
  '/hrm/my-payrolls': '/hrm.html?tab=mypay',
  '/home': '/dashboard.html',
};

export function rewriteAppHref(href) {
  if (!href) return href;
  try {
    const u = new URL(href, location.origin);
    const key = u.pathname.replace(/\/$/, '') || '/';
    const mapped = MAP[key] || MAP[key + '.html'];
    if (mapped) {
      if (mapped.includes('?')) return mapped + (u.search ? '&' + u.search.slice(1) : '') + u.hash;
      return mapped + u.search + u.hash;
    }
    return href;
  } catch {
    return href;
  }
}

export function bindLinkGuard() {
  if (document.documentElement.dataset.linkGuard === '1') return;
  document.documentElement.dataset.linkGuard = '1';
  /* Runs before every routing guard and only corrects the destination, so the
     guards below route on the right href instead of a retired one. It used to
     preventDefault and location.assign, which meant any guard registered after
     it never saw the click at all. */
  registerClickGuard({
    name: 'link-normalise',
    priority: PRIORITY.normalise,
    match: (origin) => origin?.closest?.('a[href]'),
    claim: (a) => {
      const next = rewriteAppHref(a.getAttribute('href'));
      if (!next || next === a.getAttribute('href')) return 'pass';
      a.setAttribute('href', next);
      return 'observe';
    },
  });
}
