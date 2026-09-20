/** Fiberk UBA book + spec APIs (in-browser). Role: finance | payroll | ops */
import { SUPABASE_URL } from './supabaseClient.js';
import { buildPublicReceiptHtml } from './public-receipt-html.js';

export const ACC = {
  bank: 'UBA Ghana',
  number: '03216347302516',
  name: 'ODA - FIBERK (GHS)',
  open: 10,
  close: 37.72,
  from: '2025-09-09',
  to: '2026-09-08',
};

export const CATS = [
  { key: 'salary', label: 'Salary', module: 'payroll' },
  { key: 'phone_inventory', label: 'Phone inventory', module: 'inventory' },
  { key: 'rent', label: 'Rent', module: 'ops_hub' },
  { key: 'charges', label: 'Bank charges', module: 'ops_hub' },
  { key: 'loan', label: 'Loan', module: 'loan' },
  { key: 'imprest', label: 'Imprest', module: 'ops_hub' },
  { key: 'momo', label: 'MoMo', module: 'momo' },
  { key: 'collection', label: 'Collections', module: 'ops_hub' },
  { key: 'transfer', label: 'Transfers', module: 'transfer' },
  { key: 'uncategorized', label: 'Uncategorized', module: '' },
];

export function categorize(description) {
  const d = String(description || '').toLowerCase();
  if (d.includes('cot') || d.includes('ebundle')) return 'charges';
  if (d.includes('loan')) return 'loan';
  if (/\brent\b/.test(d)) return 'rent';
  if (d.includes('imprest') || d.includes('petty')) return 'imprest';
  if (/spark|smart|\bpop\b|phones|creditor/.test(d)) return 'phone_inventory';
  if (
    d.includes('salary')
    || /phoebe|eugenia|emmanuella|kwodwo|kwadwo|samuel|martins/.test(d)
    || /parts (payment|july|august|may|june)/.test(d)
  ) return 'salary';
  if (d.includes('mm/wtb') || d.includes('mm/btw')) return 'momo';
  if (d.includes('hala')) return 'collection';
  if (/^ft\d/.test(d) || d.startsWith('r/ibg')) return 'transfer';
  return 'uncategorized';
}

function payee(remarks, cat) {
  const r = String(remarks || '');
  if (cat !== 'salary') return '';
  const m = r.match(/Phoebe|Eugenia|Emmanuella|Kwodwo|Kwadwo|Samuel|Martins/i);
  return m ? m[0] : 'Staff';
}

function monthOf(iso, remarks) {
  const m = String(remarks || '').match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2}/i);
  if (m) return m[0];
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
}

/** Official Fiberk UBA statement rows (PDF 08 Sep 2026). */
const RAW = [
  ['2026-09-02','MM/BTW IFO 233541093516',1100,0,37.72],
  ['2026-08-31','COT/ACCT MAINT.CE CHARGE31-08-2026',40,0,1137.72],
  ['2026-08-31','IBG/GIP/7745533/Payment of cleaner for August 2026',505,0,1177.72],
  ['2026-08-31','IBG/GIP/7745525/Payment to Phoebe/7745525',404,0,1682.72],
  ['2026-08-31','IBG/GIP/7745512/Payment 2 Spark 50 and 1pop 20/774',5156,0,2086.72],
  ['2026-08-31','IBG/GIP/7745497/Payment of August Salary 2026/7745',1510,0,7242.72],
  ['2026-08-31','IBG/GIP/7745465/Payment of August 2026/7745465',1510,0,8752.72],
  ['2026-08-31','EBUNDLE. AUGUST, 2026',20,0,10262.72],
  ['2026-08-31','MM/WTB IFO 233541093516',0,4200,10282.72],
  ['2026-08-28','IBG/GIP/7735720/Parts August payment for Samuel A/',1510,0,6082.72],
  ['2026-08-28','MM/BTW IFO 233541093516',3670,0,7592.72],
  ['2026-08-27','IBG/GIP/7732604/Payment of Spark 50 2/7732604',3680,0,11262.72],
  ['2026-08-27','MM/WTB IFO 233541093516',0,13700,14942.72],
  ['2026-08-24','IBG/GIP/7717808/Payment for imprest/7717808',1010,0,1242.72],
  ['2026-08-24','MM/BTW IFO 233541093516',1835,0,2252.72],
  ['2026-08-21','IBG/GIP/7710369/Parts payment of martins july sal/',757.5,0,4087.72],
  ['2026-08-21','IBG/GIP/7710362/Payment of spark 50/7710362',1845,0,4845.22],
  ['2026-08-21','MM/WTB IFO 233541093516',0,5500,6690.22],
  ['2026-08-18','IBG/GIP/7696862/Payment of 2 Spark50/7696862',3680,0,1190.22],
  ['2026-08-18','MM/WTB IFO 233541093516',0,4392,4870.22],
  ['2026-08-13','IBG/GIP/7677714/Payment for Spark50 1 Pop20 4 Sma/',9919,0,478.22],
  ['2026-08-13','MM/WTB IFO 233541093516',0,6000,10397.22],
  ['2026-08-12','IBG/GIP/7675155/Imprest and Mtn advert payment/767',4010,0,4397.22],
  ['2026-08-10','IBG/GIP/7661139/Payment for 5spark50 2smart20 5po/',18614,0,8407.22],
  ['2026-08-10','IBG/GIP/7660395/Payment of July 2026 Salary/766039',1410,0,27021.22],
  ['2026-08-10','IBG/GIP/7660393/Payment of July 2026 Salary/766039',1510,0,28431.22],
  ['2026-08-10','IBG/GIP/7660389/Parts July salary for Kwodwo Ntre/',757.5,0,29941.22],
  ['2026-08-10','IBG/GIP/7660382/Payment of July 2026 salary/766038',3010,0,30698.72],
  ['2026-08-10','IBG/GIP/7660380/July payment 2026/7660380',3010,0,33708.72],
  ['2026-08-07','IBG/GIP/7658717/Payment of creditor/7658717',30180,0,36718.72],
  ['2026-08-07','IBG/GIP/7658708/Payment for creditor/7658708',63459,0,66898.72],
  ['2026-08-07','0020107660001FIAGBEYBERNARDBLUELOAN 000',0,130000,130357.72],
  ['2026-08-06','IBG/GIP/7656748/Payment of July and August 2026/76',2200,0,357.72],
  ['2026-08-06','MM/WTB IFO 233541093516',0,2009,2557.72],
  ['2026-08-05','IBG/GIP/7654427/Parts payment of July salary/76544',707,0,548.72],
  ['2026-08-05','IBG/GIP/7654424/parts july salary kwadwo ntrebi/76',707,0,1255.72],
  ['2026-08-05','IBG/GIP/7654422/July Salary 2026/7654422',1010,0,1962.72],
  ['2026-08-05','IBG/GIP/7654416/July Salary 2026 Eugenia larbi/765',1010,0,2972.72],
  ['2026-08-05','IBG/GIP/7654411/July salary 2026 Emmanuella Duro/7',1010,0,3982.72],
  ['2026-08-05','IBG/GIP/7654407/July 2026 Salary payment/7654407',4010,0,4992.72],
  ['2026-08-05','IBG/GIP/7654399/July 2026 payment/7654399',4010,0,9002.72],
  ['2026-08-05','IBG/GIP/7654274/July 2026 payment/7654274',4010,0,13012.72],
  ['2026-08-05','MM/WTB IFO 233541093516',0,15040,17022.72],
  ['2026-08-03','IBG/GIP/7645466/July Salary/7645466',1510,0,1982.72],
  ['2026-07-31','COT/ACCT MAINT.CE CHARGE31-07-2026',26.55,0,3492.72],
  ['2026-07-31','HALA GH W30 PAYMENTS028//CIB000855679',0,3440,3519.27],
  ['2026-07-22','EBUNDLE JULY, 2026',20,0,79.27],
  ['2026-07-16','IBG/GIP/7580808/June Salary/7580808',2010,0,99.27],
  ['2026-07-16','IBG/GIP/7580806/June Salary/7580806',3010,0,2109.27],
  ['2026-07-16','MM/WTB IFO 233541093516',0,5000,5119.27],
  ['2026-07-14','MM/BTW IFO 233541093516',1000,0,119.27],
  ['2026-07-10','HALA GH W27 PAYMENTS038//CIB000812185',0,1100,1119.27],
  ['2026-07-01','MM/BTW IFO 233541093516',8250,0,19.27],
  ['2026-07-01','FT26182R2GKN-1_03216347302516',0,800,8269.27],
  ['2026-07-01','IBG/GIP/7528799/Parts of Samuel June 2026 Salary/7',253.5,0,7469.27],
  ['2026-07-01','IBG/GIP/7528787/Parts payment of May and June 202/',3175,0,7722.77],
  ['2026-06-30','COT/ACCT MAINT.CE CHARGE30-06-2026',40,0,9308.77],
  ['2026-06-30','IBG/GIP/7525139/Payment for imprest for petty cash',2010,0,10560.77],
  ['2026-06-30','IBG/GIP/7525116/Payment of June 2026 Salary/752511',4010,0,12570.77],
  ['2026-06-30','IBG/GIP/7524984/Payment of Salary for June 2026/75',1010,0,26145.27],
  ['2026-06-24','IBG/GIP/7502703/Parts payment of Rent/7502703',14010,0,4128.97],
  ['2026-06-24','MM/WTB IFO 233541093516',0,14594,18138.97],
  ['2026-06-23','IBG/GIP/7501021/imprest/7501021',101,0,3544.97],
  ['2026-06-15','IBG/GIP/7473610/Payment of Various Phones/7473610',57672,0,58],
  ['2026-06-15','IBG/GIP/7473459/Payment of Twenty Spark 50 Phones/',32910,0,57580],
  ['2026-06-15','MM/WTB IFO 233541093516',0,83440,83490],
];

const LINK_KEY = 'df_txn_links_v1';
const CAT_KEY = 'df_txn_cats_v1';
const ROLE_KEY = 'df_bank_role';

export function getRole() {
  try { return localStorage.getItem(ROLE_KEY) || 'finance'; } catch { return 'finance'; }
}
export function setRole(r) {
  try { localStorage.setItem(ROLE_KEY, r); } catch { /* ignore */ }
}

function loadOverrides() {
  try { return JSON.parse(localStorage.getItem(CAT_KEY) || '{}'); } catch { return {}; }
}
function loadLinks() {
  try { return JSON.parse(localStorage.getItem(LINK_KEY) || '[]'); } catch { return []; }
}

export function rows() {
  const ov = loadOverrides();
  const links = loadLinks();
  return RAW.map((r, i) => {
    const id = 'uba-' + String(i + 1).padStart(3, '0');
    const description = r[1];
    const category = ov[id] || categorize(description);
    const link = links.find((l) => l.transaction_id === id);
    const auto = ['salary', 'charges', 'rent', 'imprest', 'momo', 'loan', 'collection', 'transfer'].includes(category);
    return {
      id,
      transaction_date: r[0],
      description,
      debit: r[2] || null,
      credit: r[3] || null,
      balance: r[4],
      category,
      module: link?.module || CATS.find((c) => c.key === category)?.module || '',
      link_label: link?.label || (auto ? category : ''),
      matched: !!(link || auto),
      payee: payee(description, category),
      payroll_month: monthOf(r[0], description),
    };
  });
}

export function visible(list, role = getRole()) {
  if (role === 'payroll') return list.filter((r) => r.category === 'salary');
  if (role === 'ops') return list.filter((r) => ['phone_inventory', 'rent', 'imprest', 'charges'].includes(r.category));
  return list;
}

export function ledger({ search = '', category = '', from = '', to = '', role } = {}) {
  let list = visible(rows(), role);
  if (category) list = list.filter((r) => r.category === category);
  if (from) list = list.filter((r) => r.transaction_date >= from);
  if (to) list = list.filter((r) => r.transaction_date <= to);
  const q = search.toLowerCase();
  if (q) list = list.filter((r) => r.description.toLowerCase().includes(q) || (r.payee || '').toLowerCase().includes(q));
  return list;
}

export function setCategory(id, category) {
  const ov = loadOverrides();
  ov[id] = category;
  localStorage.setItem(CAT_KEY, JSON.stringify(ov));
}

export function linkTransaction(id, module, label) {
  const links = loadLinks().filter((l) => l.transaction_id !== id);
  links.push({ transaction_id: id, module, label, created_at: new Date().toISOString() });
  localStorage.setItem(LINK_KEY, JSON.stringify(links));
}

export function categorySummary(list = rows()) {
  const out = {};
  list.forEach((r) => {
    const k = r.category || 'uncategorized';
    out[k] = (out[k] || 0) + Number(r.debit || r.credit || 0);
  });
  return out;
}

export function statementSummary() {
  const list = rows();
  const total_debits = list.reduce((s, r) => s + Number(r.debit || 0), 0);
  const total_credits = list.reduce((s, r) => s + Number(r.credit || 0), 0);
  return {
    opening_balance: ACC.open,
    closing_balance: ACC.close,
    total_debits,
    total_credits,
    net_movement: +(total_credits - total_debits).toFixed(2),
    bank_transactions: list.length,
  };
}

export function reconOverview() {
  const list = rows();
  const matched = list.filter((r) => r.matched).length;
  return {
    bank_transactions: list.length,
    matched,
    unmatched: list.length - matched,
    match_rate: list.length ? +(100 * matched / list.length).toFixed(1) : 0,
    rows: list,
  };
}

export function salaryBankTxns(month = '') {
  return rows().filter((r) => r.category === 'salary' && (!month || r.transaction_date.startsWith(month) || (r.payroll_month || '').includes(month)));
}

export function payrollRecon(month = '') {
  const list = salaryBankTxns(month);
  const total_paid = list.reduce((s, r) => s + Number(r.debit || 0), 0);
  const matched = list.filter((r) => r.matched).length;
  return {
    transactions: list,
    matched,
    unmatched: list.length - matched,
    total_paid,
    total_expected: total_paid,
    status: list.length && matched === list.length ? 'balanced' : 'open',
  };
}

export function opsActivity() {
  return rows().filter((r) => ['phone_inventory', 'rent', 'imprest', 'charges'].includes(r.category));
}

export function dashboardAccounting() {
  const s = statementSummary();
  const cats = categorySummary();
  const by = {};
  rows().forEach((r) => {
    const m = r.transaction_date.slice(0, 7);
    by[m] = by[m] || { month: m, debits: 0, credits: 0 };
    by[m].debits += Number(r.debit || 0);
    by[m].credits += Number(r.credit || 0);
  });
  return { ...s, top_categories: cats, monthly_trend: Object.values(by).sort((a, b) => a.month.localeCompare(b.month)) };
}

export function fmt(n) {
  return 'GH₵ ' + Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function ymd(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export const RECEIPTS_KEY = 'df_receipts_v1';
export function listReceipts() {
  try { return JSON.parse(localStorage.getItem(RECEIPTS_KEY) || '[]'); } catch { return []; }
}
export function saveReceipt(r) {
  const all = listReceipts().filter((x) => x.receipt_code !== r.receipt_code);
  all.unshift(r);
  try { localStorage.setItem(RECEIPTS_KEY, JSON.stringify(all.slice(0, 200))); } catch { /* quota */ }
}
export function getReceipt(code) {
  return listReceipts().find((r) => r.receipt_code === code);
}
export const LIVE_ERP_ORIGIN = 'https://delkorfiberk.vercel.app';
export function receiptPublicOrigin() {
  try {
    let custom = String(localStorage.getItem('df_receipt_public_origin') || '').trim();
    if (/axidigetek-erp\.vercel\.app/i.test(custom)) {
      custom = LIVE_ERP_ORIGIN;
      try { localStorage.setItem('df_receipt_public_origin', custom); } catch { /* ignore */ }
    }
    if (custom && !isPrivateReceiptHost(custom)) return custom.replace(/\/$/, '');
  } catch { /* ignore */ }
  try {
    const here = String(location.origin || '').replace(/\/$/, '');
    if (here && !isPrivateReceiptHost(here) && !/axidigetek-erp\.vercel\.app/i.test(here)) return here;
  } catch { /* ignore */ }
  return LIVE_ERP_ORIGIN;
}
export function isPrivateReceiptHost(url) {
  try {
    const host = url.includes('://') ? new URL(url).host : url;
    return /grok\.me$|localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(host);
  } catch {
    return true;
  }
}
export function publicReceiptFileUrl(code, bucket = 'product-images') {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/receipts/${encodeURIComponent(code)}.html`;
}
export function receiptUrl(code) {
  const origin = receiptPublicOrigin();
  if (origin) return `${origin}/r/${encodeURIComponent(code)}`;
  return publicReceiptFileUrl(code);
}
function money(n) {
  return Number(n || 0);
}
export async function createReceipt(opts = {}) {
  const items = (opts.items || []).map((i) => {
    const qty = Number(i.qty || i.quantity || 1);
    const price = Number(i.price || i.unit_price || 0);
    return {
      description: i.description || i.name || i.product_name || 'Item',
      sku: i.sku || '',
      qty,
      price,
      total: qty * price,
    };
  });
  const gross = items.reduce((s, i) => s + i.total, 0);
  const discount = money(opts.discount);
  const tax = money(opts.tax_amount || opts.tax);
  const grand = money(opts.grand_total != null ? opts.grand_total : (gross - discount + (opts.tax_included ? 0 : tax)));
  const code = String(opts.receipt_code || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())).replace(/-/g, '').slice(0, 18));
  const now = new Date();
  const rec = {
    receipt_code: code,
    reference: opts.reference || code,
    transaction_date: opts.transaction_date || now.toISOString(),
    customer_name: opts.customer_name || opts.customer || 'Walk-In Customer',
    customer_phone: opts.customer_phone || opts.phone || '',
    customer_email: opts.customer_email || opts.email || '',
    payment_method: String(opts.payment_method || opts.payLabel || 'CASH').toUpperCase(),
    items,
    gross_total: money(opts.gross_total != null ? opts.gross_total : gross),
    discount,
    tax_amount: tax,
    tax_label: opts.tax_label || '',
    grand_total: grand,
    shop_name: opts.shop_name || 'Delkor-Fiberk',
    shop_tag: opts.shop_tag || '',
    shop_city: opts.shop_city || 'Accra',
    shop_phone: opts.shop_phone || '054 644 3323',
    shop_email: opts.shop_email || 'social.delkorfiberk@gmail.com',
    tin: opts.tin || 'C0001234567',
    location_name: opts.location_name || '',
    subsidiary_code: opts.subsidiary_code || '',
    expires_at: opts.expires_at || new Date(now.getTime() + 7 * 864e5).toISOString(),
    receipt_url: receiptUrl(code),
  };
  rec.sms_preview = whatsappReceiptText(rec);
  rec.sms_status = 'preview';
  saveReceipt(rec);
  const published = await publishReceipt(rec);
  if (published) {
    rec.receipt_url = published;
    rec.sms_preview = whatsappReceiptText(rec);
    saveReceipt(rec);
  }
  return rec;
}
export const RECEIPT_WA_LINE =
  'Thank you for your transaction with us. Please click the link below to view your receipt.';
export function whatsappReceiptText(r) {
  const url = r.receipt_url || receiptUrl(r.receipt_code);
  return [RECEIPT_WA_LINE, url].filter(Boolean).join('\n');
}
async function uploadReceiptHtml(code, html) {
  const { supabase } = await import('./supabaseClient.js');
  const file = new File([html], `${code}.html`, { type: 'text/html' });
  const path = `receipts/${code}.html`;
  for (const bucket of ['receipts', 'product-images']) {
    try { await supabase.storage.from(bucket).remove([path]); } catch { /* first write */ }
    const up = await supabase.storage.from(bucket).upload(path, file, {
      upsert: true,
      contentType: 'text/html',
      cacheControl: '3600',
    });
    if (!up.error) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return data?.publicUrl || publicReceiptFileUrl(code, bucket);
    }
  }
  return '';
}
async function publishReceipt(rec) {
  try {
    const { supabase } = await import('./supabaseClient.js');
    await supabase.from('customer_receipts').upsert({
      receipt_code: rec.receipt_code,
      payload: rec,
      customer_name: rec.customer_name,
      grand_total: rec.grand_total,
      expires_at: rec.expires_at,
    });
  } catch { /* table not live yet */ }
  try {
    const branded = receiptPublicOrigin();
    rec.receipt_url = branded
      ? `${branded}/r/${encodeURIComponent(rec.receipt_code)}`
      : publicReceiptFileUrl(rec.receipt_code);
    const html = buildPublicReceiptHtml({ ...rec, receipt_url: rec.receipt_url });
    await uploadReceiptHtml(rec.receipt_code, html);
    return rec.receipt_url;
  } catch (e) {
    console.warn('public receipt publish', e);
  }
  const origin = receiptPublicOrigin();
  return origin ? `${origin}/r/${encodeURIComponent(rec.receipt_code)}` : rec.receipt_url || '';
}
export async function fetchReceipt(code) {
  if (!code) return null;
  const local = getReceipt(code);
  try {
    const { supabase } = await import('./supabaseClient.js');
    const { data } = await supabase.from('customer_receipts').select('payload, expires_at').eq('receipt_code', code).maybeSingle();
    if (data?.payload) return data.payload;
  } catch { /* ignore */ }
  try {
    const res = await fetch(`/functions/v1/get-receipt?code=${encodeURIComponent(code)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && !data.error) return data;
    }
  } catch { /* not deployed */ }
  return local || null;
}
export async function sendReceiptSms(phone, url) {
  const message = whatsappReceiptText({ receipt_url: url, receipt_code: '' });
  try {
    const { sendSms } = await import('./sms-gateway.js');
    const res = await sendSms({ phone, message });
    return { status: res.status, message, provider: res.provider, error: res.error };
  } catch { /* keys not set */ }
  return { status: 'preview', message, provider: null };
}
export async function completeSale(sale) {
  const rec = await createReceipt({
    customer_name: sale.customer_name || sale.customer || 'Walk-in',
    customer_phone: sale.customer_phone || sale.phone || '',
    customer_email: sale.email,
    items: (sale.items || sale.lines || []).map((i) => ({
      description: i.description || i.name || i.product_name || 'Item',
      sku: i.sku,
      qty: Number(i.qty || i.quantity || 1),
      price: Number(i.price || i.unit_price || 0),
    })),
    payment_method: sale.payment_method || sale.payLabel || 'CASH',
    discount: Number(sale.discount || 0),
    tax_amount: Number(sale.tax || sale.tax_amount || 0),
    tax_label: sale.tax_label,
    grand_total: Number(sale.total || sale.grand_total || 0),
    gross_total: Number(sale.subtotal || sale.gross_total || 0),
    reference: sale.reference,
    shop_name: sale.shop_name,
    shop_tag: sale.shop_tag,
    location_name: sale.location || sale.location_name,
    subsidiary_code: sale.subsidiary_code,
    shop_phone: sale.shop_phone,
    shop_email: sale.shop_email,
    tin: sale.tin,
  });
  if (sale.send_sms && rec.customer_phone) {
    rec.sms = await sendReceiptSms(rec.customer_phone, rec.receipt_url);
    rec.sms_status = rec.sms.status;
    saveReceipt(rec);
  }
  return rec;
}
