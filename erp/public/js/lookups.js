/**
 * SUPERSEDED — duplicate seed lists.
 *
 * catalog-seed.js already exports SEED_UNITS, SEED_WARRANTIES, SEED_VARIATIONS
 * and SEED_GROUPS, and units.html, warranties.html, variations.html and
 * customer-groups.html already pass those into loadRows(). Wiring this file in
 * would give those pages a second, competing seed source. Kept for reference.
 */
/** Structural lookups. Brands and categories come from the live catalog. */

export const SEED_UNITS = [
  { id: 'u-pc', name: 'Pieces', short_name: 'Pc(s)', allow_decimal: false },
  { id: 'u-kg', name: 'Kilogram', short_name: 'Kg', allow_decimal: true },
  { id: 'u-ctn', name: 'Carton', short_name: 'Ctn', allow_decimal: false },
  { id: 'u-pk', name: 'Pack', short_name: 'Pk', allow_decimal: false },
  { id: 'u-set', name: 'Set', short_name: 'Set', allow_decimal: false },
  { id: 'u-m', name: 'Metre', short_name: 'm', allow_decimal: true },
  { id: 'u-l', name: 'Litre', short_name: 'L', allow_decimal: true },
];

export const SEED_BRANDS = [];

export const SEED_CATS = [];

export const SEED_WARS = [
  { id: 'w-12', name: '12 months', duration: 12, description: 'Standard Ghana retail' },
  { id: 'w-24', name: '24 months', duration: 24, description: 'Electronics extended' },
];

export const SEED_VARS = [
  { id: 'v-color', name: 'Color', values: 'Black, White, Navy, Grey' },
  { id: 'v-size', name: 'Size', values: 'S, M, L, XL' },
];

export const SEED_GROUPS = [
  { id: 'g-retail', name: 'Retail walk-in', price_group: 'Retail', amount: 0 },
  { id: 'g-ws', name: 'Wholesale', price_group: 'Wholesale', amount: -12 },
  { id: 'g-bnpl', name: 'BNPL hire-purchase', price_group: 'Retail', amount: 0 },
  { id: 'g-corp', name: 'Corporate', price_group: 'VIP', amount: -8 },
  { id: 'g-staff', name: 'Staff', price_group: 'Staff', amount: -20 },
];
