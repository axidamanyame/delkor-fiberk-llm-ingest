/** Paper receipts + official payroll → live books. RBC personal statement is not company. */
import { readLs, writeLs } from './ls-rows.js';

const FLAG = 'df_receipts_hr_v1';
const EMP_KEY = 'df_fiberk_employees';
const PAY_KEY = 'df_hrm_payroll';
const MOMO_TXN = 'df_momo_transactions';

function merge(key, rows) {
  const cur = readLs(key, []) || [];
  const map = new Map(cur.map((r) => [String(r.id), r]));
  rows.forEach((r) => { if (r?.id) map.set(String(r.id), { ...(map.get(String(r.id)) || {}), ...r }); });
  writeLs(key, [...map.values()]);
}

const STAFF = [
  { name: 'David Lamptey', position: 'Data Entry Coordinator/HR', bank: 'GCB', account: '1011100445552', ssnit: 'C019302180096', basic: 4000 },
  { name: 'Harry Coleman', position: 'IT/Digital Network Lead', bank: 'GT Bank', account: '1211001034874', ssnit: 'C010004250190', basic: 4000 },
  { name: 'Prince Charles Essel', position: 'Accountant/Finance Manager', bank: 'Zenith Bank', account: '4012018604', ssnit: 'A169505050155', basic: 4000 },
  { name: 'Thomas Adongo', position: 'Field Sales Manager', bank: 'ADB', account: '9012000139128801', ssnit: 'J018501100034', basic: 3000 },
  { name: 'Annabel Oworhu', position: 'Field Sales Manager', bank: '', account: '', ssnit: '', basic: 3000 },
  { name: 'Wisdom Adzadu', position: 'Field Sales Manager', bank: 'GCB', account: '5121010016676', ssnit: 'D219803260056', basic: 3000 },
  { name: 'Emmanuel Mensah', position: 'Retail Manager', bank: 'Access Bank', account: '0011629167721', ssnit: '', basic: 3000 },
  { name: 'Abraham Teye Narh', position: 'Field Sales Manager', bank: 'GT Bank', account: '3011113631700', ssnit: 'C049108140018', basic: 3000 },
  { name: 'Richmond Azameti', position: 'Field Sales Coordinator', bank: 'GCB', account: '1011102099587', ssnit: '', basic: 3000 },
  { name: 'Emmanuel Baaba', position: 'Custodian/Facilities Manager', bank: 'Fidelity Bank', account: '2030875067913', ssnit: '', basic: 2000 },
  { name: 'William Kofi Adika', position: 'Logistics Manager', bank: '', account: '', ssnit: '', basic: 2000 },
  { name: 'Anita Osei', position: 'Front Desk/Call Centre Coordinator', bank: 'CBG', account: '2539998600001', ssnit: '', basic: 2000 },
  { name: 'Valerie Naa Charkor Marbell', position: 'Call Centre', bank: '', account: '', ssnit: '', basic: 1500 },
  { name: 'Nat Ntrebi', position: 'Delivery Rider', bank: 'CBG', account: '2400252600001', ssnit: '', basic: 1500, also_known: 'Kwadwo Ntrebi' },
  { name: 'Martin Nsebi', position: 'Delivery Rider', bank: '', account: '', ssnit: '', basic: 1500 },
  { name: 'Bright Kaizer', position: 'Digital Marketing Coordinator', bank: 'ABSA', account: '0211390271', ssnit: 'N050406160015', basic: 1500 },
  { name: 'Anita Asare', position: 'Digital Marketing Coordinator', bank: 'ECOBANK', account: '1441004901799', ssnit: 'D279405050015', basic: 1500 },
  { name: 'Eugenia Larbi', position: 'Sales Rep', bank: 'Access Bank', account: '100400004361', ssnit: '', basic: 1000 },
  { name: 'Emmanuella Duro', position: 'Sales Rep', bank: '', account: '', ssnit: '', basic: 1000 },
  { name: 'Samuel Gyamfi', position: 'Sales Rep', bank: '', account: '', ssnit: '', basic: 1000 },
];

const JULY_DEDUCT = {
  'Nat Ntrebi': 50,
  'Kwadwo Ntrebi': 50,
  'Martin Nsebi': 50,
  'Anita Asare': 100,
};

export function syncReceiptsAndHr() {
  merge(MOMO_TXN, [{
    id: 'momo-85497209940',
    txn_id: '85497209940',
    date: '2026-07-16',
    created_at: '2026-07-16T14:14:00',
    amount: 10000,
    direction: 'in',
    wallet: '0541093516',
    wallet_name: 'FIBERK',
    sender_name: 'PHOEBE KYEI-BOATENG',
    sender_number: '0244934948',
    reference: 'Loan',
    method: 'momo',
    source: 'momo-receipt',
    note: 'Private loan 16 Jul 2026. Lender Phoebe Kyei-Boateng 0244934948. Borrower Fiagbey Bernard 0249112244. Principal ₵10,000 at 4%/month (₵400). Paid into Fiberk MoMo 0541093516 txn 85497209940. Company wallet holds Bernard’s personal loan funds.',
    loan_id: 'loan-phoebe-bernard-2026-07-16',
  }]);

  ['df_purchases', 'df_purchase_orders', 'df_purchase_invoices'].forEach((k) => {
    writeLs(k, (readLs(k, []) || []).filter((r) => String(r.id) !== 'po-egl-12060' && String(r.reference) !== 'EGL-PFI-12060'));
  });
  writeLs('df_suppliers', (readLs('df_suppliers', []) || []).filter((r) => String(r.id) !== 's-electroland'));

  merge('df_loans', [{
    id: 'loan-phoebe-bernard-2026-07-16',
    date: '2026-07-16',
    lender_name: 'Phoebe Kyei-Boateng',
    lender_phone: '0244934948',
    lender_address: 'Bennedet street Sapeiman - Opah',
    borrower_name: 'Fiagbey Bernard',
    borrower_phone: '0249112244',
    borrower_address: 'Ebenezer Nikoi Avenue, Ashaley Botwe',
    principal: 10000,
    rate_monthly_pct: 4,
    interest_monthly: 400,
    principal_on_demand: true,
    notice_months: 2,
    late_grace_days: 7,
    late_penalty_pct_per_day: 5,
    witnesses: [
      { name: 'Prince Botchway', phone: '0247195363', address: 'Kofi Annan Avenue, North Legon' },
      { name: 'Samuel Kyei-Boateng', phone: '0243382139', address: 'St. Benedict Street, Opah, Sarpeiman' },
    ],
    received_wallet: '0541093516',
    received_txn: '85497209940',
    book: 'private-loan',
    company_note: 'Personal loan to Bernard. Cash sat in Fiberk MoMo. Not a Fiberk supplier or EasyBuy loan.',
    source: 'signed-agreement',
    status: 'open',
  }]);

  merge('df_expenses', [{
    id: 'exp-uba-chg-7473610',
    date: '2026-06-15',
    category: 'bank_charge',
    amount: 10,
    method: 'bank',
    reference: 'UBA-7473610-CHG',
    note: 'UBA IBG/GIP/7473610 transaction charge. Bank paid ₵57,672, Franko stamped paid ₵57,662.',
    source: 'uba-charge',
    subsidiary_code: 'fiberk',
  }]);

  const employees = STAFF.map((s, i) => ({
    id: 'hr-' + String(i + 1).padStart(3, '0'),
    name: s.name,
    aliases: [s.name, s.also_known].filter(Boolean).map((n) => n.toLowerCase()),
    position: s.position,
    bank_name: s.bank,
    bank_account: s.account,
    ssnit: s.ssnit,
    basic_salary: s.basic,
    status: 'active',
    employment: 'present',
    source: 'payroll-register',
    subsidiary_code: /field sales/i.test(s.position) ? 'bnpl' : 'fiberk',
  }));
  merge(EMP_KEY, employees);

  const payroll = employees.map((e) => {
    const deduct = JULY_DEDUCT[e.name] || 0;
    const snnit = +(e.basic_salary * 0.13).toFixed(2);
    const tier2 = +(e.basic_salary * 0.055).toFixed(2);
    const netSheet = e.basic_salary - deduct;
    return {
      id: 'pr-2026-07-' + e.id,
      employee_id: e.id,
      employee_name: e.name,
      period: '2026-07',
      basic: e.basic_salary,
      snnit_tier1: snnit,
      snnit_tier2: tier2,
      deduction: deduct,
      deduction_note: deduct ? 'Absenteeism (July register)' : '',
      net: netSheet,
      status: 'posted',
      source: 'july-register',
    };
  });
  merge(PAY_KEY, payroll);

  try { localStorage.setItem(FLAG, '1'); } catch { /* */ }
  return { staff: employees.length, momo: 10000, uba_charge: 10 };
}
