/**
 * Shared business settings.
 * Live table has typed columns (business_name, currency, …) plus optional payload jsonb
 * for POS/tax/prefix/module flags. localStorage is the offline fallback.
 */
import { supabase } from './supabaseClient.js';

export const SETTINGS_KEY = 'ax_biz_settings';

export const BIZ_DEFAULTS = {
  business_name: 'Delkor-Fiberk',
  start_date: '2024-01-01',
  default_profit_percent: 25,
  currency: 'GHS',
  currency_symbol: 'GH₵',
  currency_placement: 'before',
  timezone: 'Africa/Accra',
  fy_start_month: '1',
  accounting_method: 'fifo',
  transaction_edit_days: 30,
  date_format: 'd/m/Y',
  time_format: '24',
  currency_precision: 2,
  quantity_precision: 2,
  logo_url: '',

  tax1_name: 'VAT',
  tax1_no: '',
  tax2_name: 'NHIL',
  tax2_no: '',
  tax_percent: 15,
  inline_tax: 'yes',
  enable_inline_tax: true,

  sku_prefix: 'DF',
  enable_product_expiry: false,
  on_product_expiry: 'add_expiry',
  enable_brands: true,
  enable_categories: true,
  enable_sub_categories: true,
  enable_price_tax: true,
  default_unit: '',
  enable_sub_units: false,
  enable_racks: false,
  enable_row: false,
  enable_position: false,
  enable_warranty: false,
  product_image_required: false,
  show_sku: true,
  enable_sku: true,
  enable_barcode: true,
  enable_unit: true,
  enable_product_family: true,
  enable_product_class: true,
  enable_item_kind: true,
  enable_item_group: true,
  enable_price_group: true,
  enable_cost: true,
  enable_stock_tracking: true,
  enable_variants: true,
  enable_supplier: true,
  enable_status: true,

  default_credit_limit: 0,
  default_customer_group: '',

  default_sale_discount: 10,
  default_sale_tax: '',
  item_addition_method: 'increment',
  amount_rounding: 'none',
  sales_price_is_min: false,
  allow_overselling: false,
  enable_sales_order: false,
  is_pay_term_required: false,
  sales_cmsn_agent: 'disable',
  cmsn_agent_type: 'logged_in',
  cmsn_calculation_type: 'invoice',
  cmsn_agent_required: false,
  enable_payment_link: false,
  paystack_public_key: '',
  paystack_secret_key: '',
  hubtel_merchant_account: '',
  hubtel_client_id: '',
  hubtel_client_secret: '',
  hubtel_api_key: '',
  momo_environment: 'sandbox',
  momo_subscription_key: '',
  momo_api_user: '',
  momo_api_key: '',
  momo_callback_url: '',

  pos_shortcut_express: 'shift+e',
  pos_shortcut_pay: 'shift+p',
  pos_shortcut_draft: 'shift+d',
  pos_shortcut_cancel: 'shift+c',
  pos_shortcut_qty: 'f2',
  pos_shortcut_weighing: '',
  pos_shortcut_discount: 'shift+i',
  pos_shortcut_order_tax: 'shift+t',
  pos_shortcut_add_payment: 'shift+r',
  pos_shortcut_finalize: 'shift+f',
  pos_shortcut_add_product: 'f4',
  pos_disable_multiple_pay: false,
  pos_disable_draft: false,
  pos_disable_express_checkout: false,
  pos_hide_product_suggestion: false,
  pos_hide_recent_trans: false,
  pos_disable_discount: false,
  pos_disable_order_tax: false,
  pos_subtotal_editable: false,
  pos_disable_suspend: false,
  pos_enable_transaction_date: false,
  pos_enable_service_staff: false,
  pos_service_staff_required: false,
  pos_disable_credit_sale: false,
  pos_enable_weighing: false,
  pos_show_invoice_scheme: false,
  pos_show_invoice_layout: false,
  pos_print_on_suspend: false,
  pos_show_pricing_tooltip: false,
  pos_disable_quotation: false,
  pos_credit_limit: 0,
  ws_prefix: '',
  ws_sku_length: 5,
  ws_qty_int_length: 4,
  ws_qty_frac_length: 3,

  enable_customer_display: false,
  display_screen_heading: 'Welcome',
  carousel_image_1: '',
  carousel_image_2: '',
  carousel_image_3: '',
  carousel_image_4: '',
  carousel_image_5: '',
  carousel_image_6: '',
  carousel_image_7: '',
  carousel_image_8: '',
  carousel_image_9: '',
  carousel_image_10: '',

  enable_editing_product_from_purchase: true,
  enable_purchase_status: true,
  enable_lot_number: false,
  enable_purchase_order: false,
  enable_purchase_requisition: false,

  cash_denoms: '1,2,5,10,20,50,100,200',
  enable_cash_denomination_on_pos: false,
  enable_cash_denomination_for_payment_methods: false,
  strict_check_on_denomination: false,

  till_policy_on: true,
  till_count_required: true,
  till_silent_alert: true,
  till_flash_bot: true,
  till_block_mismatch: false,
  till_attend_on: true,
  till_attend_alert: true,
  till_geofence_m: 60,

  staff_hours_on: true,
  staff_start: '08:00',
  staff_grace_min: 0,
  staff_late_alert: true,
  staff_absent_alert: true,
  staff_absent_after_min: 15,
  staff_hours_day: 8,
  staff_days_week: 5,
  staff_kpi_att_weight: 60,

  stock_expiry_alert_days: 30,
  view_stock_expiry_alert: true,
  datatable_page_entries: 25,
  enable_row_number: true,
  theme_color: 'blue',
  meet_code: '',

  prefix_purchase: 'PO',
  prefix_purchase_return: 'PR',
  prefix_purchase_requisition: 'PREQ',
  prefix_purchase_order: 'PO',
  prefix_stock_transfer: 'ST',
  prefix_stock_adjustment: 'SA',
  prefix_sell_return: 'CN',
  prefix_expense: 'EP',
  prefix_contacts: 'CO',
  prefix_purchase_payment: 'PP',
  prefix_sell_payment: 'SP',
  prefix_expense_payment: 'EXP',
  prefix_business_location: 'BL',
  prefix_username: '',
  prefix_subscription: '',
  prefix_draft: 'DR',
  prefix_sale_order: 'SO',
  prefix_quotation: 'QT',
  prefix_expense_report: 'N/A',

  enable_reward_points: false,
  rp_name: 'Reward Points',
  rp_earn_amount: 1,
  rp_min_order_earn: 1,
  rp_max_points_per_order: '',
  rp_redeem_amount: 1,
  rp_min_order: 1,
  rp_min_redeem: '',
  rp_max_redeem_per_order: '',
  rp_expiry: '',
  rp_expiry_unit: 'year',

  module_purchases: true,
  module_add_sale: true,
  module_pos: true,
  module_stock_transfers: true,
  module_stock_adjustment: true,
  module_expenses: true,
  module_account: true,
  module_ops_hub: true,
  module_collections: true,
  module_callcentre: true,
  module_home: true,
  module_records: true,
  module_sales: true,
  module_reports: true,
  module_system: true,
  module_tables: false,
  module_modifiers: false,
  module_service_staff: false,
  module_bookings: false,
  module_kitchen: false,
  module_subscription: false,
  module_types_of_service: false,
  module_repair: true,
  module_crm: true,
  module_hrm: true,
  module_manufacturing: false,
  module_woocommerce: true,
  module_project: true,
  module_essentials: true,
  module_communications: true,
  module_academy: true,
  module_fieldops: true,
  module_custom_dashboard: true,
  module_ai: true,
  module_accounting: true,
  module_assets: true,
  module_qr: true,
  module_connector: true,
  module_spreadsheet: true,
  module_wms: true,

  mail_driver: 'smtp',
  mail_host: '',
  mail_port: '587',
  mail_username: '',
  mail_password: '',
  mail_encryption: 'tls',
  mail_from_address: 'sales@delkorfiberk.com',
  mail_from_name: 'Delkor-Fiberk',
  use_superadmin_settings: false,
  email_from: 'sales@delkorfiberk.com',

  sms_settings_url: '',
  send_to_param_name: 'to',
  msg_param_name: 'message',
  request_method: 'post',
  sms_from: 'DelkorFBK',
  test_number: '',

  custom_label_1: 'Custom Field 1',
  custom_label_1_type: 'text',
  custom_label_1_options: '',
  custom_label_2: 'Custom Field 2',
  custom_label_2_type: 'text',
  custom_label_3: 'Custom Field 3',
  custom_label_3_type: 'text',
  custom_label_4: 'Custom Field 4',
  custom_label_4_type: 'text',

  field_flow_agents: true,
  field_flow_customers: true,
  field_flow_visits: true,
  field_flow_products: false,
  field_flow_prices: false,
  field_flow_stock: false,
  field_flow_sales: false,
  field_flow_collections: false,
  field_flow_leads: false,
  field_flow_suppliers: false,
  field_flow_purchases: false,
  field_flow_accounting: false,
  field_flow_hrm: false,

  /* Access key (orientation). Only ticked jobs must enter DF-XXXX-XXXX. */
  access_key_enabled: true,
  ak_role_pending: true,
};

export const FIELD_OPS_FLOWS = [
  { id: 'field_flow_agents', label: 'Field agents', group: 'People', def: true, help: 'Commission agents on BNPL Field Sales. Needed for the left-hand book.' },
  { id: 'field_flow_customers', label: 'Hire-purchase customers', group: 'People', def: true, help: 'Customers booked to Field Sales or a named agent.' },
  { id: 'field_flow_leads', label: 'CRM leads', group: 'People', def: false, help: 'Leads assigned to field agents.' },
  { id: 'field_flow_visits', label: 'Visits', group: 'Field work', def: true, help: 'Agent visit log.' },
  { id: 'field_flow_products', label: 'Product catalogue', group: 'Goods', def: false, help: 'SKUs agents may offer in the field. Day-zero hub stock does not flow unless this is on.' },
  { id: 'field_flow_prices', label: 'Prices and deposits', group: 'Goods', def: false, help: 'Selling price, deposit and installment terms.' },
  { id: 'field_flow_stock', label: 'Stock on hand', group: 'Goods', def: false, help: 'Quantities. Leave off unless agents must see remaining units.' },
  { id: 'field_flow_sales', label: 'Hire-purchase contracts', group: 'Money', def: false, help: 'Open HP sales for field customers.' },
  { id: 'field_flow_collections', label: 'Collections and balances', group: 'Money', def: false, help: 'Amounts due and collections on HP books.' },
  { id: 'field_flow_suppliers', label: 'Suppliers', group: 'Office (off by default)', def: false, help: 'Vendor records. Field Ops should not see these unless you tick this.' },
  { id: 'field_flow_purchases', label: 'Purchases', group: 'Office (off by default)', def: false, help: 'Purchase orders and GRNs.' },
  { id: 'field_flow_accounting', label: 'Accounting books', group: 'Office (off by default)', def: false, help: 'Ledgers, journals, trial balance. Keep off.' },
  { id: 'field_flow_hrm', label: 'HR / payroll', group: 'Office (off by default)', def: false, help: 'Employees, SNNIT, payslips. Keep off.' },
];

export function fieldOpsAllowed(settings, id) {
  const spec = FIELD_OPS_FLOWS.find((f) => f.id === id);
  const fallback = spec ? spec.def : false;
  const p = readModulePreview();
  if (Object.prototype.hasOwnProperty.call(p, id)) return !!p[id];
  if (!settings || settings[id] === undefined || settings[id] === null || settings[id] === '') return fallback;
  return !!settings[id];
}

export function fieldOpsOpenBooks(settings) {
  return FIELD_OPS_FLOWS.filter((f) => fieldOpsAllowed(settings, f.id));
}

export const CORE_MODULE_FLAGS = [
  { label: 'Home', flag: 'module_home' },
  { label: 'Records', flag: 'module_records' },
  { label: 'Operations', flag: 'module_ops_hub' },
  { label: 'Purchases', flag: 'module_purchases' },
  { label: 'Sales', flag: 'module_sales' },
  { label: 'Finance', flag: 'module_account' },
  { label: 'Collections', flag: 'module_collections' },
  { label: 'Reports', flag: 'module_reports' },
  { label: 'System', flag: 'module_system' },
];

/** Color-coded left-nav modules. Settings toggles + shell filter share this list. */
export const ADDON_MODULE_FLAGS = [
  { label: 'Academy', flag: 'module_academy' },
  { label: 'AI Assistance', flag: 'module_ai' },
  { label: 'Accounting', flag: 'module_accounting' },
  { label: 'Asset Management', flag: 'module_assets' },
  { label: 'Catalogue QR', flag: 'module_qr' },
  { label: 'Call Centre', flag: 'module_callcentre' },
  { label: 'Communications', flag: 'module_communications' },
  { label: 'Connector', flag: 'module_connector' },
  { label: 'CRM', flag: 'module_crm' },
  { label: 'Custom Dashboards', flag: 'module_custom_dashboard' },
  { label: 'Field Ops', flag: 'module_fieldops' },
  { label: 'HRM', flag: 'module_hrm' },
  { label: 'Manufacturing', flag: 'module_manufacturing' },
  { label: 'Project', flag: 'module_project' },
  { label: 'Repair', flag: 'module_repair' },
  { label: 'Spreadsheet', flag: 'module_spreadsheet' },
  { label: 'WMS', flag: 'module_wms' },
  { label: 'WooCommerce', flag: 'module_woocommerce' },
];

export const CORE_MENU_FLAGS = {
  Home: 'module_home',
  Records: 'module_records',
  Operations: 'module_ops_hub',
  'Operations Hub': 'module_ops_hub',
  Purchases: 'module_purchases',
  Procurement: 'module_purchases',
  Sales: 'module_sales',
  Sale: 'module_sales',
  Finance: 'module_account',
  Account: 'module_account',
  Collections: 'module_collections',
  Reports: 'module_reports',
  System: 'module_system',
};

const MODULE_PREVIEW_KEY = 'df_module_flags_apply';

export function readModulePreview() {
  try { return JSON.parse(sessionStorage.getItem(MODULE_PREVIEW_KEY) || '{}'); } catch { return {}; }
}

export function writeModulePreview(flags) {
  const cur = readModulePreview();
  try { sessionStorage.setItem(MODULE_PREVIEW_KEY, JSON.stringify({ ...cur, ...(flags || {}) })); } catch { /* ignore */ }
}

export function clearModulePreview() {
  try { sessionStorage.removeItem(MODULE_PREVIEW_KEY); } catch { /* ignore */ }
}

/** Applied (preview) flags win over saved settings until Update Settings. */
export function moduleOn(biz, key) {
  if (key === 'module_home' || key === 'module_system') return true;
  return settingOn(biz, key, true);
}

/** Generic tick: preview → saved → fallback. */
export function settingOn(biz, key, fallback = false) {
  const p = readModulePreview();
  if (Object.prototype.hasOwnProperty.call(p, key)) return !!p[key];
  if (biz && biz[key] !== undefined && biz[key] !== null && biz[key] !== '') return !!biz[key];
  if (BIZ_DEFAULTS[key] !== undefined && BIZ_DEFAULTS[key] !== null && BIZ_DEFAULTS[key] !== '') return !!BIZ_DEFAULTS[key];
  return !!fallback;
}

export const MODULES_CHANGED = 'df-modules-changed';

const TYPED = [
  'business_name',
  'currency',
  'currency_symbol',
  'timezone',
  'default_profit_percent',
];

export function readLocal() {
  try {
    return { ...BIZ_DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return { ...BIZ_DEFAULTS };
  }
}

export function writeLocal(payload) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload)); } catch { /* ignore */ }
}

function fromRow(row) {
  if (!row) return {};
  const blob = row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
    ? row.payload
    : {};
  const typed = {};
  TYPED.forEach((k) => { if (row[k] != null && row[k] !== '') typed[k] = row[k]; });
  if (row.financial_year_start_month != null) {
    typed.fy_start_month = String(row.financial_year_start_month);
  }
  return { ...blob, ...typed };
}

function toRow(next) {
  return {
    id: 1,
    business_name: next.business_name || 'Delkor-Fiberk',
    currency: next.currency || 'GHS',
    currency_symbol: next.currency_symbol || 'GH₵',
    timezone: next.timezone || 'Africa/Accra',
    default_profit_percent: Number(next.default_profit_percent) || 25,
    financial_year_start_month: Number(next.fy_start_month) || 1,
    payload: next,
    updated_at: new Date().toISOString(),
  };
}

export async function loadBizSettings() {
  const local = readLocal();
  try {
    const { data, error } = await supabase.from('business_settings').select('*').eq('id', 1).maybeSingle();
    if (error || !data) return local;
    const merged = { ...BIZ_DEFAULTS, ...fromRow(data) };
    writeLocal(merged);
    return merged;
  } catch {
    return local;
  }
}

export async function saveBizSettings(payload) {
  const next = { ...BIZ_DEFAULTS, ...payload };
  writeLocal(next);
  const row = toRow(next);
  const rls = (err) => /42501|row-level security|RLS|HQ Admin required/i.test(String(err?.message || err?.code || ''));
  const miss = (err) => /PGRST205|PGRST204|does not exist|schema cache|Could not find the table/i.test(String(err?.message || ''));

  async function tryWrite(body) {
    let { data, error } = await supabase.from('business_settings').update(body).eq('id', 1).select('id');
    if (!error && Array.isArray(data) && data.length) return { error: null };
    if (!error && data && !Array.isArray(data) && data.id) return { error: null };
    ({ error } = await supabase.from('business_settings').insert(body));
    if (!error) return { error: null };
    return { error };
  }

  let { error } = await tryWrite(row);
  if (error && /payload/i.test(error.message || '')) {
    const { payload: _drop, ...typedOnly } = row;
    ({ error } = await tryWrite(typedOnly));
  }
  if (error && (rls(error) || miss(error))) {
    const rpc = await supabase.rpc('df_upsert_business_settings', { p: { ...row, payload: next } });
    if (!rpc.error) return { error: null };
    error = rpc.error;
  }
  if (error && (rls(error) || miss(error))) {
    return {
      error: null,
      localOnly: true,
      hint: 'Saved on this device. Postgres blocked the company row. Run sql/84_business_settings.sql in Supabase, then Update Settings again.',
    };
  }
  return { error };
}
