/** Shared expense catalogues so list / form / import stay in sync. */

export const CAT_SEED = [
  { id: 'cat-rent', name: 'Rent', code: 'RENT', parent_id: null },
  { id: 'cat-util', name: 'Utilities', code: 'UTIL', parent_id: null },
  { id: 'cat-elec', name: 'Electricity', code: 'ELEC', parent_id: 'cat-util' },
  { id: 'cat-water', name: 'Water', code: 'WATR', parent_id: 'cat-util' },
  { id: 'cat-tran', name: 'Transport', code: 'TRAN', parent_id: null },
  { id: 'cat-fuel', name: 'Fuel', code: 'FUEL', parent_id: 'cat-tran' },
  { id: 'cat-welf', name: 'Staff Welfare', code: 'WELF', parent_id: null },
  { id: 'cat-sal', name: 'Salaries', code: 'SAL', parent_id: null },
  { id: 'cat-mkt', name: 'Marketing', code: 'MKT', parent_id: null },
  { id: 'cat-momo', name: 'MoMo Charges', code: 'MOMO', parent_id: null },
  { id: 'cat-rep', name: 'Repairs', code: 'REP', parent_id: null },
  { id: 'cat-off', name: 'Office Supplies', code: 'OFF', parent_id: null },
];

export const PAY_METHODS = [
  ['cash', 'Cash'],
  ['card', 'Card'],
  ['cheque', 'Cheque'],
  ['bank', 'Bank Transfer'],
  ['momo', 'MTN MoMo'],
  ['telecel', 'Telecel Cash'],
  ['atmoney', 'AirtelTigo'],
  ['other', 'Other'],
  ['custom_1', 'Custom Payment 1'],
  ['custom_2', 'Custom Payment 2'],
  ['custom_3', 'Custom Payment 3'],
  ['custom_4', 'Custom Payment 4'],
  ['custom_5', 'Custom Payment 5'],
  ['custom_6', 'Custom Payment 6'],
  ['custom_7', 'Custom Payment 7'],
];

export const ACCOUNT_SEED = [
  { id: 'none', name: 'None' },
];

export function parentsOf(cats) {
  return (cats || []).filter((c) => !c.parent_id);
}
export function childrenOf(cats, parentId) {
  return (cats || []).filter((c) => c.parent_id === parentId);
}
export function catByName(cats, name) {
  return (cats || []).find((c) => String(c.name).toLowerCase() === String(name || '').toLowerCase());
}

export function nextExpenseRef(rows) {
  const year = new Date().getFullYear();
  let max = 0;
  (rows || []).forEach((r) => {
    const m = String(r.reference_no || '').match(/EXP(\d{4})\/(\d+)/i);
    if (m && Number(m[1]) === year) max = Math.max(max, Number(m[2]));
  });
  return `EXP${year}/${String(max + 1).padStart(4, '0')}`;
}

export function payStatus(total, paid) {
  const t = Number(total || 0);
  const p = Number(paid || 0);
  if (p <= 0) return 'due';
  if (p + 0.009 < t) return 'partial';
  return 'paid';
}
