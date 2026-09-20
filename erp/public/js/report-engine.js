/**
 * Delkor-Fiberk report engine — HTML + JS + JSON.
 * Templates live here (not a second Supabase table). Callers fetch live rows,
 * this file builds the JSON contract and KPIs/charts from numbers, not from
 * painted HTML cells.
 */
import { fmt } from './supabaseClient.js';
import { getAccess } from './rbac.js';
import { dateRange, locOptions } from './report-data.js';

const TONES = ['blue', 'green', 'amber', 'teal', 'red', 'slate'];

export const TEMPLATES = {
  'sales.sales_rep': {
    code: 'sales.sales_rep',
    name: 'Sales Representative Report',
    module: 'Sales',
    description: 'Who sold how much in this range — invoices, sales, returns, commission.',
    kpis: [
      { key: 'count', label: 'Staff on the book', format: 'number', color: 'slate' },
      { key: 'sum:sales', label: 'Total sales', format: 'currency', color: 'green' },
      { key: 'sum:invoices', label: 'Invoices', format: 'number', color: 'blue' },
      { key: 'sum:commission_amt', label: 'Commission due', format: 'currency', color: 'amber' },
    ],
    charts: [
      { type: 'bar', title: 'Sales by staff', labelKey: 'staff', valueKey: 'sales' },
      { type: 'donut', title: 'Share of sales', labelKey: 'staff', valueKey: 'sales' },
    ],
    table: {
      columns: [
        { key: 'staff', label: 'Staff' },
        { key: 'loc', label: 'Location' },
        { key: 'invoices', label: 'Invoices', format: 'number' },
        { key: 'sales', label: 'Sales', format: 'currency' },
        { key: 'returns', label: 'Returns', format: 'currency' },
        { key: 'commission', label: 'Commission %', format: 'percent' },
        { key: 'commission_amt', label: 'Commission', format: 'currency' },
      ],
    },
  },
  'sales.product_sell': {
    code: 'sales.product_sell',
    name: 'Product Sell Report',
    module: 'Sales',
    description: 'Invoices by SKU and customer.',
    kpis: [
      { key: 'count', label: 'Lines', format: 'number', color: 'slate' },
      { key: 'sum:qty', label: 'Qty sold', format: 'number', color: 'blue' },
      { key: 'sum:amount', label: 'Sales', format: 'currency', color: 'green' },
    ],
    charts: [
      { type: 'bar', title: 'Top products', labelKey: 'name', valueKey: 'amount' },
      { type: 'donut', title: 'Share of sales', labelKey: 'name', valueKey: 'amount' },
    ],
    table: {
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'sku', label: 'SKU' },
        { key: 'name', label: 'Product' },
        { key: 'customer', label: 'Customer' },
        { key: 'staff', label: 'Staff' },
        { key: 'loc', label: 'Location' },
        { key: 'qty', label: 'Qty', format: 'number' },
        { key: 'amount', label: 'Amount', format: 'currency' },
      ],
    },
  },
  'sales.sell_grouped': {
    code: 'sales.sell_grouped',
    name: 'Product Sell (Grouped)',
    module: 'Sales',
    description: 'Sales rolled up by brand and category.',
    kpis: [
      { key: 'count', label: 'Groups', format: 'number', color: 'slate' },
      { key: 'sum:qty', label: 'Qty sold', format: 'number', color: 'blue' },
      { key: 'sum:amount', label: 'Sales', format: 'currency', color: 'green' },
    ],
    charts: [
      { type: 'bar', title: 'By brand', labelKey: 'brand', valueKey: 'amount' },
      { type: 'donut', title: 'Share', labelKey: 'brand', valueKey: 'amount' },
    ],
    table: {
      columns: [
        { key: 'brand', label: 'Brand' },
        { key: 'cat', label: 'Category' },
        { key: 'qty', label: 'Qty sold', format: 'number' },
        { key: 'amount', label: 'Amount', format: 'currency' },
      ],
    },
  },
  'sales.sell_payments': {
    code: 'sales.sell_payments',
    name: 'Sell Payment Report',
    module: 'Sales',
    description: 'Customer receipts by method.',
    kpis: [
      { key: 'count', label: 'Receipts', format: 'number', color: 'slate' },
      { key: 'sum:amount', label: 'Collected', format: 'currency', color: 'green' },
    ],
    charts: [
      { type: 'donut', title: 'By method', labelKey: 'method', valueKey: 'amount' },
      { type: 'bar', title: 'Receipts', labelKey: 'customer', valueKey: 'amount' },
    ],
    table: {
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'invoice', label: 'Invoice' },
        { key: 'customer', label: 'Customer' },
        { key: 'loc', label: 'Location' },
        { key: 'method', label: 'Method' },
        { key: 'amount', label: 'Amount', format: 'currency' },
      ],
    },
  },
  'purchase.product': {
    code: 'purchase.product',
    name: 'Product Purchase Report',
    module: 'Purchase',
    description: 'Supplier purchases by SKU.',
    kpis: [
      { key: 'count', label: 'Lines', format: 'number', color: 'slate' },
      { key: 'sum:qty', label: 'Qty bought', format: 'number', color: 'blue' },
      { key: 'sum:amount', label: 'Purchase value', format: 'currency', color: 'amber' },
    ],
    charts: [
      { type: 'bar', title: 'By product', labelKey: 'name', valueKey: 'amount' },
    ],
    table: {
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'sku', label: 'SKU' },
        { key: 'name', label: 'Product' },
        { key: 'supplier', label: 'Supplier' },
        { key: 'loc', label: 'Location' },
        { key: 'qty', label: 'Qty', format: 'number' },
        { key: 'amount', label: 'Amount', format: 'currency' },
      ],
    },
  },
  'purchase.payments': {
    code: 'purchase.payments',
    name: 'Purchase Payment Report',
    module: 'Purchase',
    description: 'Supplier receipts by method.',
    kpis: [
      { key: 'count', label: 'Payments', format: 'number', color: 'slate' },
      { key: 'sum:amount', label: 'Paid out', format: 'currency', color: 'amber' },
    ],
    charts: [
      { type: 'donut', title: 'By method', labelKey: 'method', valueKey: 'amount' },
    ],
    table: {
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'ref', label: 'Ref' },
        { key: 'supplier', label: 'Supplier' },
        { key: 'loc', label: 'Location' },
        { key: 'method', label: 'Method' },
        { key: 'amount', label: 'Amount', format: 'currency' },
      ],
    },
  },
  'finance.expense': {
    code: 'finance.expense',
    name: 'Expense Report',
    module: 'Finance',
    description: 'Operating expenses for the selected date range.',
    kpis: [
      { key: 'count', label: 'Entries', format: 'number', color: 'slate' },
      { key: 'sum:amount', label: 'Total expense', format: 'currency', color: 'red' },
    ],
    charts: [
      { type: 'donut', title: 'By category', labelKey: 'cat', valueKey: 'amount' },
      { type: 'bar', title: 'Spend', labelKey: 'cat', valueKey: 'amount' },
    ],
    table: {
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'ref', label: 'Ref' },
        { key: 'cat', label: 'Category' },
        { key: 'to', label: 'Paid to' },
        { key: 'loc', label: 'Location' },
        { key: 'method', label: 'Method' },
        { key: 'amount', label: 'Amount', format: 'currency' },
      ],
    },
  },
  'inventory.adjustments': {
    code: 'inventory.adjustments',
    name: 'Stock Adjustment Report',
    module: 'Inventory',
    description: 'Stock in / out for the selected date range.',
    kpis: [
      { key: 'count', label: 'Adjustments', format: 'number', color: 'slate' },
      { key: 'sum:qty', label: 'Qty moved', format: 'number', color: 'blue' },
    ],
    charts: [
      { type: 'bar', title: 'By reason', labelKey: 'reason', valueKey: 'qty' },
    ],
    table: {
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'ref', label: 'Ref' },
        { key: 'sku', label: 'SKU' },
        { key: 'name', label: 'Product' },
        { key: 'loc', label: 'Location' },
        { key: 'type', label: 'Type' },
        { key: 'qty', label: 'Qty', format: 'number' },
        { key: 'reason', label: 'Reason' },
      ],
    },
  },
};

function n(v) { const x = Number(v); return Number.isFinite(x) ? x : 0; }

export function formatCell(value, format) {
  if (value == null || value === '') return '—';
  if (format === 'currency') return fmt(n(value));
  if (format === 'percent') return n(value).toFixed(2) + '%';
  if (format === 'number') return String(n(value));
  return String(value);
}

function kpiValue(spec, rows) {
  if (spec.key === 'count') return rows.length;
  const [op, field] = String(spec.key).split(':');
  if (op === 'sum') return rows.reduce((s, r) => s + n(r[field]), 0);
  if (op === 'avg') {
    if (!rows.length) return 0;
    return rows.reduce((s, r) => s + n(r[field]), 0) / rows.length;
  }
  if (op === 'max') return rows.reduce((m, r) => Math.max(m, n(r[field])), 0);
  if (op === 'top') {
    const sorted = [...rows].sort((a, b) => n(b[field]) - n(a[field]));
    return sorted[0]?.[spec.labelKey || 'name'] || '—';
  }
  return 0;
}

function series(rows, labelKey, valueKey, limit = 8) {
  const map = new Map();
  rows.forEach((r) => {
    const k = String(r[labelKey] || '—');
    map.set(k, (map.get(k) || 0) + n(r[valueKey]));
  });
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
    .map((it, i) => ({ ...it, tone: TONES[i % TONES.length] }));
}

export function generateReport(templateCode, rawRows = [], filters = {}) {
  const template = TEMPLATES[templateCode];
  if (!template) throw new Error('Unknown report ' + templateCode);
  const rows = Array.isArray(rawRows) ? rawRows : [];
  const who = getAccess() || {};
  const { from, to } = dateRange();
  const loc = filters.loc || new URLSearchParams(location.search).get('loc') || '';
  const branch = locOptions().find((l) => l.code === loc)?.name || (loc || 'All locations');
  const generatedOn = new Date().toLocaleString('en-GB', {
    timeZone: 'Africa/Accra',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
  const generatedBy = who.fullName || who.name || (who.email || '').split('@')[0] || 'Staff';

  const summary = (template.kpis || []).map((k) => ({
    label: k.label,
    value: kpiValue(k, rows),
    format: k.format,
    color: k.color || 'blue',
  }));

  const charts = (template.charts || []).map((c) => ({
    type: c.type,
    title: c.title,
    items: series(rows, c.labelKey, c.valueKey, c.limit || 8),
  }));

  const report = {
    header: {
      title: template.name,
      filters: { dateFrom: from, dateTo: to, branchId: loc },
      generatedBy,
      generatedOn,
      branchName: branch,
    },
    summary,
    charts,
    table: {
      columns: template.table.columns,
      rows,
      exportable: true,
    },
    footer: {
      timestamp: generatedOn,
      user: generatedBy,
      branch,
      notes: template.description,
    },
    _template: template,
  };

  try {
    const runs = JSON.parse(localStorage.getItem('df_report_runs') || '[]');
    runs.unshift({
      code: template.code,
      at: new Date().toISOString(),
      by: generatedBy,
      filters: report.header.filters,
      kpis: summary,
    });
    localStorage.setItem('df_report_runs', JSON.stringify(runs.slice(0, 40)));
  } catch { /* quota */ }

  return report;
}
