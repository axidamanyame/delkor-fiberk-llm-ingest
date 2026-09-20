/**
 * Where each detail belongs on the view card.
 *
 * The card standard is settled: a facts grid, then a green band for money, a
 * blue band for movement. What was not settled is *which* detail goes where —
 * so every desk decided for itself and they drifted. This is that decision,
 * written once.
 *
 * Two layers, in order:
 *
 *   1. A schema for the entity, when we know it (customer, supplier, product,
 *      sale, purchase, expense, payment, user, stock, payroll, repair).
 *   2. Field-name classification for anything else — a new desk, a migrated
 *      table, a report row. An unrecognised record still lands in sensible
 *      sections rather than as one undifferentiated list.
 *
 * Usage from any desk, in one line:
 *
 *   import { autoViewCard } from './js/view-schema.js';
 *   app.innerHTML = autoViewCard('supplier', row, {
 *     movement: purchaseRows,          // optional, pre-built blue rows
 *     actions: [{ label: 'Edit', href: … , tone: 'primary' }],
 *   });
 */
import { viewCard } from './view-card.js';

/* ------------------------------------------------------------------ *
 * Field classification — the fallback, and the rule the schemas follow
 * ------------------------------------------------------------------ */

/** Money: anything denominated in currency. Goes in the green band. */
const MONEY = /(price|cost|amount|total|balance|due|paid|payable|receivable|margin|profit|discount|tax|vat|levy|fee|charge|credit|debit|subtotal|grand|deposit|advance|salary|basic|allowance|deduction|net|gross|commission|snnit|ssnit)/i;

/** Movement: quantities, dates and references — the blue band. */
/* "count" needs anchoring: unanchored it matched ac-count-_code and sent an
   account identifier into the movement band. */
const MOVEMENT = /(qty|quantity|stock|on_hand|committed|available|reorder|alert_quantity|transfer|received|issued|returned|sold|purchased|^count$|_count$|opening_stock|closing)/i;

/** Identity and classification — the facts grid. */
const IDENTITY = /(^id$|_id$|^name$|title|sku|code|barcode|ref|reference|invoice_no|phone|mobile|email|address|city|region|country|tin|tax_number|group|category|brand|unit|type|kind|status|role|department|designation|office|location|subsidiary|company|warehouse|supplier|customer|agent|assigned|pay_term|credit_limit)/i;

/** Never shown: plumbing, not information. */
const HIDDEN = /(^id$|_id$|password|token|secret|hash|created_at|updated_at|deleted_at|synced|dirty|raw|payload|meta$|__|legacy_label|source$)/i;

/**
 * Identifiers that merely contain a money word. Without this, `tax_number`
 * matched MONEY on the word "tax" and rendered as "GH₵ NaN"; `invoice_no` and
 * `account_code` would do the same. A name ending in number, no, code or ref is
 * an identifier whatever else it says.
 */
const NOT_MONEY = /(number$|_no$|_code$|code$|_ref$|ref$|_id$|tin$|vat_no|tax_number|tax_id|account_name)/i;

export function isMoneyField(key) {
  const k = String(key || '');
  return !NOT_MONEY.test(k) && MONEY.test(k);
}

export function classifyField(key) {
  const k = String(key || '');
  if (HIDDEN.test(k)) return 'hidden';
  if (isMoneyField(k)) return 'money';
  if (MOVEMENT.test(k)) return 'movement';
  if (IDENTITY.test(k)) return 'fact';
  return 'fact';
}

/** customer_group → Customer group */
export function humanise(key) {
  return String(key || '')
    .replace(/_/g, ' ')
    /* The column is spelled snnit_* in the database; the institution is SSNIT.
       Render it correctly without renaming the field. */
    .replace(/\b(snnit|ssnit)\b/gi, 'SSNIT')
    .replace(/\b(id|tin|vat|sku|imei|hp|po|grn)\b/gi, (m) => m.toUpperCase())
    .replace(/^./, (c) => c.toUpperCase())
    /* "SSNIT employee" reads better as "SSNIT (employee)" in a column head */
    .replace(/SSNIT (employee|employer)/i, (m, w) => 'SSNIT (' + w.toLowerCase() + ')');
}

/* ------------------------------------------------------------------ *
 * Schemas — the agreed placement per entity
 * ------------------------------------------------------------------ */

/**
 * facts   three arrays, one per column of the grid
 * money   the green band, in order
 * image   field holding a photo, if the entity has one
 */
export const VIEW_SCHEMAS = {
  customer: {
    facts: [
      ['phone', 'mobile', 'email', 'group_name', 'customer_group'],
      ['subsidiary_code', 'location_name', 'location_code', 'assigned_to'],
      ['tax_number', 'credit_limit', 'pay_term', 'address', 'city'],
    ],
    money: ['opening_balance', 'sale_due', 'ret_due', 'advance_balance'],
    /* A view card shows one record. Group-wide roll-ups — every company this
       customer has ever bought from, totals across subsidiaries — are a report,
       and putting them here made the card long and the useful part hard to
       find. Movement is only this record's own transactions, and only when the
       desk passes them. */
    movementTitle: 'Recent transactions',
  },
  supplier: {
    facts: [
      ['mobile', 'phone', 'email', 'supplier_group'],
      ['subsidiary_code', 'location_name', 'location_code'],
      ['tax_number', 'pay_term', 'address', 'city'],
    ],
    money: ['opening_balance', 'purchase_due', 'purchase_return_due', 'advance_balance'],
    movementTitle: 'Purchases from this supplier',
  },
  product: {
    image: ['image_url', 'photo', 'image'],
    facts: [
      ['sku', 'barcode', 'brand'],
      ['category', 'unit', 'product_class'],
      ['tax', 'alert_quantity', 'status'],
    ],
    money: ['cost_price', 'selling_price', 'margin'],
    movementTitle: 'Stock by location',
  },
  user: {
    facts: [
      ['email', 'role', 'mobile'],
      ['department', 'designation', 'office'],
      ['start_date', 'status', 'subsidiary_code'],
    ],
    money: ['salary', 'basic', 'allowance', 'snnit_employee', 'net_pay'],
    movementTitle: 'Recent activity',
  },
  sale: {
    facts: [
      ['ref_no', 'invoice_no', 'date'],
      ['customer_name', 'subsidiary_code', 'location_code'],
      ['status', 'payment_status', 'cashier'],
    ],
    money: ['subtotal', 'tax', 'discount', 'total', 'paid', 'due'],
    movementTitle: 'Lines',
  },
  purchase: {
    facts: [
      ['ref_no', 'date', 'supplier_name'],
      ['subsidiary_code', 'location_code', 'warehouse'],
      ['status', 'payment_status'],
    ],
    money: ['subtotal', 'tax', 'discount', 'total', 'paid', 'due'],
    movementTitle: 'Lines received',
  },
  expense: {
    facts: [
      ['ref_no', 'date', 'category'],
      ['subsidiary_code', 'location_code', 'paid_to'],
      ['status', 'payment_method'],
    ],
    money: ['amount', 'tax', 'total', 'paid', 'due'],
    movementTitle: 'Payments',
  },
  payment: {
    facts: [
      ['ref_no', 'date', 'method'],
      ['account', 'subsidiary_code', 'location_code'],
      ['status', 'received_by'],
    ],
    money: ['amount', 'charge', 'net'],
    movementTitle: 'Applied to',
  },
  stock: {
    facts: [
      ['sku', 'product_name', 'barcode'],
      ['location_code', 'warehouse', 'lot'],
      ['expiry', 'status'],
    ],
    money: ['cost_price', 'selling_price'],
    movementTitle: 'Movement',
  },
  /**
   * Payroll has two staff types today and a third planned, and they do not
   * share a money band. A commission-only earner is paid direct with no
   * deductions, so SSNIT and deduction columns on their card are not zeroes —
   * they are nonsense. A salaried worker has no commission. Showing all seven
   * columns to both produced the sideways-scrolling band you saw.
   *
   * The variant is chosen by pay_type on the row: 'commission', 'salary', or
   * 'salary_commission' for the mix when you introduce it. Anything else falls
   * back to the full set, so an unlabelled legacy row still shows everything
   * rather than hiding a figure.
   */
  payroll: {
    facts: [
      ['ref_no', 'employee_name', 'month'],
      ['department', 'designation', 'office'],
      ['pay_type', 'status', 'paid_on'],
    ],
    money: ['basic', 'allowance', 'sales_target_commission', 'deduction', 'snnit_employee', 'snnit_employer', 'net_pay'],
    movementTitle: 'History',
    /* Shorter heads keep the salary band on one line at desk width. */
    labels: { sales_target_commission: 'Commission', net_pay: 'Net pay' },
    variantKey: 'pay_type',
    variants: {
      /* paid direct on sales; no statutory deductions */
      commission: {
        money: ['sales_target_commission', 'net_pay'],
        note: 'Commission only — paid direct, no SSNIT deduction.',
      },
      /* full salary, no commission */
      salary: {
        money: ['basic', 'allowance', 'deduction', 'snnit_employee', 'snnit_employer', 'net_pay'],
      },
      /* planned: both */
      salary_commission: {
        money: ['basic', 'allowance', 'sales_target_commission', 'deduction', 'snnit_employee', 'snnit_employer', 'net_pay'],
      },
    },
  },
  repair: {
    facts: [
      ['ref_no', 'date', 'customer_name'],
      ['device', 'imei', 'technician'],
      ['status', 'warranty', 'promised_on'],
    ],
    money: ['labour', 'parts', 'total', 'paid', 'due'],
    movementTitle: 'Status history',
  },
};

/** Aliases so a desk can pass whatever it calls the thing. */
const KIND_ALIASES = {
  contact: 'customer', customers: 'customer', client: 'customer',
  suppliers: 'supplier', vendor: 'supplier',
  products: 'product', item: 'product', catalogue: 'product', catalog: 'product',
  users: 'user', staff: 'user', employee: 'user',
  sales: 'sale', sell: 'sale', order: 'sale', invoice: 'sale',
  purchases: 'purchase', po: 'purchase', grn: 'purchase',
  expenses: 'expense',
  payments: 'payment', receipt: 'payment',
  stocks: 'stock', inventory: 'stock',
  payrolls: 'payroll', salary: 'payroll',
  repairs: 'repair', job: 'repair',
};

export function schemaFor(kind) {
  const k = String(kind || '').toLowerCase();
  return VIEW_SCHEMAS[k] || VIEW_SCHEMAS[KIND_ALIASES[k]] || null;
}

/** cash_only, Commission Only, commission-only → commission */
function variantKeyOf(raw) {
  const s = String(raw || '').toLowerCase().replace(/[\s-]+/g, '_');
  if (!s) return '';
  if (/(salary|basic).*(commission)|commission.*(salary|basic)/.test(s)) return 'salary_commission';
  if (/commission/.test(s)) return 'commission';
  if (/salary|salaried|fixed/.test(s)) return 'salary';
  return s;
}

/**
 * A schema may vary by a field on the record — today only payroll does, keyed
 * on pay_type. Returns the schema with the variant's overrides folded in, so
 * callers never handle the two cases separately.
 *
 * @param {string} kind
 * @param {object} row
 * @param {string} [force] override the row's own value
 */
export function resolveSchema(kind, row, force) {
  const base = schemaFor(kind);
  if (!base || !base.variants) return base;
  const raw = force !== undefined ? force : (row || {})[base.variantKey];
  const hit = base.variants[variantKeyOf(raw)];
  if (!hit) return base;
  return { ...base, ...hit, variantName: variantKeyOf(raw) };
}

/* ------------------------------------------------------------------ *
 * Building the card
 * ------------------------------------------------------------------ */

const has = (row, k) => row && row[k] !== undefined && row[k] !== null && row[k] !== '';

/** A money field can still hold text — tax: "VAT 15%", margin: "30.8%". */
const isNumeric = (v) => v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v));

function money(fmt, k, v) {
  return fmt && isMoneyField(k) && isNumeric(v) ? fmt(v) : v;
}

/**
 * Database names are not English. "Subsidiary code", "Location name" and
 * "Ret due" are what the columns are called, not what a person reads, so the
 * card renames them centrally rather than each desk doing it.
 */
const LABELS = {
  subsidiary_code: 'Company',
  location_code: 'Location',
  location_name: 'Location',
  customer_group: 'Group',
  supplier_group: 'Group',
  group_name: 'Group',
  tax_number: 'TIN',
  ret_due: 'Returns due',
  sale_due: 'Sales due',
  purchase_due: 'Purchase due',
  purchase_return_due: 'Return due',
  advance_balance: 'Advance',
  opening_balance: 'Opening',
  sales_target_commission: 'Commission',
  alert_quantity: 'Reorder at',
  cost_price: 'Cost',
  selling_price: 'Selling',
  net_pay: 'Net pay',
  pay_type: 'Pay type',
  on_hand: 'On hand',
  product_name: 'Product',
  employee_name: 'Employee',
  ref_no: 'Reference',
  invoice_no: 'Invoice',
  pay_term: 'Pay term',
  credit_limit: 'Credit limit',
};

export function headLabel(schema, k) {
  return (schema && schema.labels && schema.labels[k]) || LABELS[k] || humanise(k);
}

function pick(row, keys, fmt, format, used, schemaRef) {
  return (keys || [])
    .filter((k) => has(row, k))
    .map((k) => {
      if (used) used.add(k);
      const label = headLabel(schemaRef, k);
      if (format && typeof format[k] === 'function') return [label, format[k](row[k], row)];
      return [label, money(fmt, k, row[k])];
    });
}

/** Fields the schema did not mention, so nothing silently disappears. */
function leftovers(row, schema) {
  const claimed = new Set([
    ...(schema?.facts || []).flat(),
    ...(schema?.money || []),
    ...(schema?.image || []),
  ]);
  return Object.keys(row || {})
    .filter((k) => !claimed.has(k) && has(row, k))
    .filter((k) => classifyField(k) !== 'hidden')
    .filter((k) => typeof row[k] !== 'object');
}

/**
 * @param {string} kind        entity name or alias
 * @param {object} row         the record
 * @param {object} [opts]
 *   fmt         money formatter, default GH₵
 *   title       overrides the derived title
 *   movement    pre-built rows for the blue band, [[…], …]
 *   movementColumns
 *   movementTitle
 *   extraSections  appended after the standard bands
 *   actions
 *   showOther   include unmapped fields in a plain section (default true)
 *   format      per-field renderers, e.g. { subsidiary_code: subsidiaryLabel }
 *   variant     force a schema variant instead of reading it off the row
 */
export function autoViewCard(kind, row, opts = {}) {
  const schema = resolveSchema(kind, row, opts.variant);
  const fmt = opts.fmt || ((n) => 'GH₵ ' + Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 }));
  const r = row || {};

  const title = opts.title
    || r.business_name || r.full_name || r.name || r.product_name
    || r.employee_name || r.ref_no || r.invoice_no || 'Record';

  const format = opts.format || {};
  /* Everything already on the card, so the catch-all section cannot repeat it.
     The title and subtitle come from the record too, so their source fields
     count as rendered. */
  const used = new Set(['business_name', 'full_name', 'name', 'product_name', 'employee_name', 'ref_no', 'sku', 'contact_id', 'id']);
  const facts = schema
    ? schema.facts.map((col) => pick(r, col, fmt, format, used, schema))
    : chunk(pick(r, leftovers(r, null).filter((k) => classifyField(k) === 'fact'), fmt, format, used, null), 3);

  const moneyKeys = schema
    ? schema.money.filter((k) => has(r, k))
    : Object.keys(r).filter((k) => isMoneyField(k) && has(r, k));

  const sections = [];

  if (moneyKeys.length) {
    moneyKeys.forEach((k) => used.add(k));
    sections.push({
      tone: 'green',
      title: schema?.moneyTitle,
      note: schema?.note,
      columns: moneyKeys.map((k) => headLabel(schema, k)),
      rows: [moneyKeys.map((k) => money(fmt, k, r[k]))],
    });
    /* Fields the variant excludes are deliberately off the card, not missing —
       mark them used so "Other details" does not smuggle them back in. */
    (schema?.money || []).forEach((k) => used.add(k));
    Object.values(schema?.variants || {}).forEach((v) => (v.money || []).forEach((k) => used.add(k)));
  }

  /* A card is not a report: show the most recent handful, not the history. */
  const moveRows = (opts.movement || []).slice(0, opts.movementLimit || 12);
  const moveKeys = schema ? [] : Object.keys(r).filter((k) => classifyField(k) === 'movement' && has(r, k));
  if (moveRows.length || opts.movementColumns) {
    sections.push({
      tone: 'blue',
      title: opts.movementTitle || schema?.movementTitle || 'Movement',
      columns: opts.movementColumns || ['Date', 'Book', 'Ref', 'Company', 'Location', 'Amount'],
      rows: moveRows,
    });
  } else if (moveKeys.length) {
    moveKeys.forEach((k) => used.add(k));
    sections.push({
      tone: 'blue',
      title: opts.movementTitle || schema?.movementTitle || 'Quantities',
      columns: moveKeys.map((k) => headLabel(schema, k)),
      rows: [moveKeys.map((k) => r[k])],
    });
  }

  /* Off unless a desk asks for it. When a schema exists it has already said
     what matters, and the catch-all just padded the card with plumbing —
     exactly the "details I don't need" problem. Desks with no schema still get
     it, since there it is the only thing showing the record. */
  const wantOther = opts.showOther === true || (!schema && opts.showOther !== false);
  if (wantOther) {
    const other = leftovers(r, schema).filter((k) => classifyField(k) === 'fact' && !used.has(k));
    if (other.length) {
      sections.push({
        tone: 'plain',
        title: 'Other details',
        columns: other.map((k) => headLabel(schema, k)),
        rows: [other.map((k) => money(fmt, k, r[k]))],
      });
    }
  }

  for (const s of opts.extraSections || []) sections.push(s);

  const imageKey = (schema?.image || []).find((k) => has(r, k));

  return viewCard({
    title,
    subtitle: opts.subtitle ?? (r.ref_no || r.sku || r.contact_id || r.id || ''),
    image: imageKey ? r[imageKey] : (schema?.image ? '' : undefined),
    facts,
    sections,
    actions: opts.actions || [],
  });
}

function chunk(arr, n) {
  const size = Math.ceil(arr.length / n) || 1;
  return Array.from({ length: n }, (_, i) => arr.slice(i * size, (i + 1) * size)).filter((c) => c.length);
}
