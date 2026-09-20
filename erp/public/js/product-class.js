/**
 * Product classification — one tree, toggled from Business Settings → Product.
 * Category / subcategory stay the merchandising tree. These layers sit on top.
 */
import { settingOn } from './settings-store.js';

export const PRODUCT_CLASSES = [
  ['finished_good', 'Finished good'],
  ['raw_material', 'Raw material'],
  ['spare', 'Spare / part'],
  ['consumable', 'Consumable'],
  ['service', 'Service'],
  ['kit', 'Kit / bundle'],
];

export const ITEM_KINDS = [
  ['stockable', 'Stockable'],
  ['service', 'Service'],
  ['kit', 'Kit'],
  ['variant', 'Variant'],
];

export const ITEM_GROUPS = [
  ['retail', 'Retail'],
  ['wholesale', 'Wholesale'],
  ['distributor', 'Distributor'],
  ['hire_purchase', 'Hire purchase'],
  ['agent', 'Agent'],
  ['internal', 'Internal / transfer'],
];

export const PRODUCT_FAMILIES = [
  'Galaxy', 'iPhone', 'Oraimo', 'Tecno', 'Infinix', 'Itel',
  'Hisense', 'Nasco', 'Midea', 'Bruhm', 'Binatone', 'Generic',
];

export const PRICING_CLASSES = [
  ['retail', 'Retail'],
  ['wholesale', 'Wholesale'],
  ['distributor', 'Distributor'],
  ['agent', 'Agent'],
];

export const TAX_CLASSES = [
  ['standard', 'Standard (VAT)'],
  ['zero', 'Zero-rated'],
  ['exempt', 'Exempt'],
];

export const COSTING_METHODS = [
  ['fifo', 'FIFO'],
  ['average', 'Average'],
  ['standard', 'Standard'],
  ['lifo', 'LIFO'],
];

export const INVENTORY_CLASSES = [
  ['plain', 'Quantity only'],
  ['serialized', 'Serialized'],
  ['batch', 'Batch'],
  ['expiry', 'Expiry / lot'],
];

export const PRODUCT_STATUSES = [
  ['active', 'Active'],
  ['inactive', 'Inactive'],
  ['discontinued', 'Discontinued'],
];

export const SELL_TYPES = [
  ['simple', 'Single'],
  ['variable', 'Variable'],
  ['combo', 'Combo'],
];

/** Layers HQ can turn on or off. Flag keys live on business_settings. */
export const PRODUCT_CLASS_FLAGS = [
  { group: 'Tree', flag: 'enable_categories', label: 'Category', help: 'Department on the catalogue tree.' },
  { group: 'Tree', flag: 'enable_sub_categories', label: 'Sub-category', help: 'Searchable type under a category. Never a brand name.' },
  { group: 'Tree', flag: 'enable_brands', label: 'Brand' },
  { group: 'Tree', flag: 'enable_product_family', label: 'Product family', help: 'Series — Galaxy, Oraimo Power, Hisense fridge line.' },
  { group: 'Identity', flag: 'enable_sku', label: 'SKU' },
  { group: 'Identity', flag: 'enable_barcode', label: 'Barcode' },
  { group: 'Identity', flag: 'enable_unit', label: 'Unit' },
  { group: 'Class', flag: 'enable_product_class', label: 'Product class', help: 'Finished good, spare, raw material, service.' },
  { group: 'Class', flag: 'enable_item_kind', label: 'Item kind', help: 'Stockable, service, kit, variant.' },
  { group: 'Class', flag: 'enable_item_group', label: 'Item group', help: 'Bucket for pricing and tax rules.' },
  { group: 'Commerce', flag: 'enable_price_group', label: 'Price group', help: 'Retail / wholesale / distributor / agent prices.' },
  { group: 'Commerce', flag: 'enable_cost', label: 'Cost' },
  { group: 'Commerce', flag: 'enable_price_tax', label: 'Price & tax' },
  { group: 'Stock', flag: 'enable_stock_tracking', label: 'Stock tracking' },
  { group: 'Stock', flag: 'enable_variants', label: 'Variants', help: 'Single / variable / combo on the till.' },
  { group: 'Support', flag: 'enable_supplier', label: 'Supplier' },
  { group: 'Support', flag: 'enable_warranty', label: 'Warranty' },
  { group: 'Support', flag: 'enable_status', label: 'Status' },
];

export function classLayerOn(biz, flag) {
  return settingOn(biz, flag, true);
}

export function optionHtml(list, selected) {
  return list.map((row) => {
    const v = Array.isArray(row) ? row[0] : row;
    const l = Array.isArray(row) ? row[1] : row;
    return `<option value="${esc(v)}" ${String(selected || '') === String(v) ? 'selected' : ''}>${esc(l)}</option>`;
  }).join('');
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;',
  }[c]));
}

export function labelOf(list, value) {
  const hit = (list || []).find((row) => (Array.isArray(row) ? row[0] : row) === value);
  if (!hit) return value || '—';
  return Array.isArray(hit) ? hit[1] : hit;
}
