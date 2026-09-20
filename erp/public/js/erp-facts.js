/** Read-only crawl of ERP books the assistant can answer from. No writes. */
function parse(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null || raw === '') return null;
    return JSON.parse(raw);
  } catch { return null; }
}
function arr(key) {
  const v = parse(key);
  return Array.isArray(v) ? v : [];
}
function obj(key) {
  const v = parse(key);
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}
function money(n) {
  const v = Number(n || 0);
  return 'GH₵ ' + v.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function todayYmd() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function dayOf(r) {
  return String(r.date || r.order_date || r.expense_date || r.created_at || r.when || '').slice(0, 10);
}
function sum(rows, keys) {
  return (rows || []).reduce((s, r) => {
    for (const k of keys) {
      const n = Number(r[k]);
      if (Number.isFinite(n) && n) return s + n;
    }
    return s;
  }, 0);
}

function dueFollow(a, today) {
  if (!a.next_follow_up) return false;
  if (['completed', 'on_hold'].includes(a.status)) return false;
  return a.next_follow_up <= today;
}

function inDefault(a, brokenIds, today) {
  if (a.regular || a.status === 'completed') return false;
  if (brokenIds.has(a.id)) return true;
  if (['open', 'ptp', 'escalate', 'dispute'].includes(a.status)) return true;
  if (dueFollow(a, today)) return true;
  if (Number(a.amount_due) > 0 && a.status !== 'current') return true;
  if (['D', 'E'].includes(a.credit_grade) && a.status !== 'current') return true;
  return false;
}

export function crawlErp() {
  const today = todayYmd();
  const accounts = arr('df_collection_accounts');
  const calls = arr('df_collection_calls');
  const ptps = arr('df_collection_ptps');
  const customers = arr('df_customers');
  const contacts = arr('df_contacts');
  const suppliers = arr('df_suppliers');
  const sales = arr('df_sales_orders');
  const purchases = [...arr('df_purchases'), ...arr('df_purchase_orders')];
  const products = arr('df_products');
  const users = arr('df_users').length ? arr('df_users') : arr('df_profiles');
  const expenses = arr('df_expenses');
  const repairs = arr('df_repair_jobs');
  const transfers = arr('df_stock_transfers');
  const payrolls = arr('df_hrm_payroll');
  const ccCalls = arr('df_cc_calls');
  const ccCamps = arr('df_cc_campaigns');
  const crm = obj('df_crm_hub_v1');
  const leads = Array.isArray(crm.leads) ? crm.leads : [];
  const followups = Array.isArray(crm.followups) ? crm.followups : [];
  const brokenIds = new Set(ptps.filter((p) => p.status === 'broken').map((p) => p.account_id));
  const defaulting = accounts.filter((a) => inDefault(a, brokenIds, today));
  const dueToday = accounts.filter((a) => dueFollow(a, today));
  const grades = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  accounts.forEach((a) => { grades[a.credit_grade || 'C'] = (grades[a.credit_grade || 'C'] || 0) + 1; });
  const salesToday = sales.filter((r) => dayOf(r) === today);
  const expToday = expenses.filter((r) => dayOf(r) === today);
  const fuDue = followups.filter((f) => {
    const when = String(f.when || f.date || '').slice(0, 10);
    return when && when <= today && !/complete|cancel/i.test(f.status || '');
  });
  return {
    today,
    accounts,
    defaulting,
    dueToday,
    broken: brokenIds.size,
    grades,
    calls: calls.length,
    customers,
    contacts,
    suppliers,
    leads,
    followups,
    fuDue,
    products: products.length,
    users: users.length,
    sales,
    salesToday,
    salesTodayAmt: sum(salesToday, ['grand_total', 'total', 'amount']),
    purchases: purchases.length,
    expenses,
    expTodayAmt: sum(expToday, ['amount', 'total']),
    repairs: repairs.length,
    transfers: transfers.length,
    payrolls: payrolls.length,
    payrollPaid: payrolls.filter((p) => String(p.status || '').toLowerCase() === 'paid').length,
    appliance: accounts.filter((a) => a.credit_grade === 'A').length,
    ccCalls,
    ccCamps,
    ccMissed: ccCalls.filter((c) => c.status === 'missed' || c.status === 'abandoned').length,
    ccToday: ccCalls.filter((c) => c.called_on === today).length,
  };
}

function topNames(rows, n = 8) {
  return rows.slice(0, n).map((a) => {
    const g = a.credit_grade ? ` (${a.credit_grade})` : '';
    const due = a.amount_due != null && a.amount_due !== '' ? ` · ${money(a.amount_due)} due` : '';
    return `• ${a.name || a.contact || a.full_name || 'Unnamed'}${g}${due}`;
  }).join('\n');
}

function findByName(q, snap) {
  const t = q.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\b(how|many|who|is|the|a|an|in|of|for|customer|customers|account|show|me|list|find)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (t.length < 3) return [];
  const hay = [
    ...snap.accounts.map((a) => ({ kind: 'Collections', ...a })),
    ...snap.customers.map((a) => ({ kind: 'Customer', ...a })),
    ...snap.contacts.map((a) => ({ kind: 'Contact', ...a })),
    ...snap.leads.map((a) => ({ kind: 'Lead', name: a.name || a.contact, ...a })),
  ];
  return hay.filter((r) => String(r.name || r.full_name || r.contact || '').toLowerCase().includes(t)).slice(0, 8);
}

export function answerFromFacts(q, menuHere = 'Home') {
  const s = String(q || '').toLowerCase();
  const snap = crawlErp();
  const n = (x) => (x || 0).toLocaleString('en-GH');

  if (/default|arrears|overdue|not paying|behind|delinquen|in default/.test(s)) {
    const list = snap.defaulting;
    const head = `${n(list.length)} hire-purchase customer${list.length === 1 ? ' is' : 's are'} in default on the Easybuy Collections book (${n(snap.accounts.length)} accounts in total).`;
    const extra = `${n(snap.dueToday.length)} due for follow-up today · ${n(snap.broken)} broken promise${snap.broken === 1 ? '' : 's'} · grades D ${n(snap.grades.D)} / E ${n(snap.grades.E)}.`;
    const names = list.length ? `\n\n${topNames(list)}` : '';
    return `${head} ${extra}${names}\n\nOpen CRM → Collections for the working list.`;
  }
  if (/follow.?up|due today|call today/.test(s)) {
    return `${n(snap.dueToday.length)} collection follow-ups are due today, plus ${n(snap.fuDue.length)} CRM follow-up${snap.fuDue.length === 1 ? '' : 's'}. Open CRM → Follow ups (scope Today).`;
  }
  if (/credit grade|appliance|eligible|promotion|grade [a-e]/.test(s)) {
    return `Credit grades on the Easybuy book: A ${n(snap.grades.A)} (appliance HP eligible), B ${n(snap.grades.B)} (next handset), C ${n(snap.grades.C)}, D ${n(snap.grades.D)}, E ${n(snap.grades.E)}. CRM → Collections → Credit grade.`;
  }
  if (/how many customer|number of customer|customer count|clients do we/.test(s)) {
    const party = snap.customers.length || snap.contacts.length;
    return `${n(party)} customer/contact record${party === 1 ? '' : 's'} in Contacts, plus ${n(snap.accounts.length)} Easybuy hire-purchase accounts. ${n(snap.defaulting.length)} of those HP accounts are in default.`;
  }
  if (/supplier/.test(s)) {
    return `${n(snap.suppliers.length)} supplier${snap.suppliers.length === 1 ? '' : 's'} on file. Contacts → Suppliers.`;
  }
  if (/lead/.test(s)) {
    return `${n(snap.leads.length)} CRM lead${snap.leads.length === 1 ? '' : 's'}. Open CRM → Leads.`;
  }
  if (/product|sku|catalog|stock count|how many item/.test(s)) {
    return `${n(snap.products)} unique SKU${snap.products === 1 ? '' : 's'} in the catalogue (listings, not on-hand). Stock lives at Operations Hub until it is transferred. Products → List.`;
  }
  if (/today.*sale|sales today|how much did we sell|show today/.test(s)) {
    return `Today (${snap.today}) this book has ${n(snap.salesToday.length)} sale${snap.salesToday.length === 1 ? '' : 's'} totalling ${money(snap.salesTodayAmt)}. Sales → All Sales.`;
  }
  if (/\bsales\b/.test(s) && /how many|total|this month|all/.test(s)) {
    const amt = sum(snap.sales, ['grand_total', 'total', 'amount']);
    return `${n(snap.sales.length)} sales on this device totalling ${money(amt)}. ${n(snap.salesToday.length)} today (${money(snap.salesTodayAmt)}).`;
  }
  if (/uba|fiberk bank|03216347302516/.test(s)) {
    return 'Finance → Banking → UBA Fiberk holds Fiberk Ltd’s UBA overdraft 03216347302516 (FIBERK, ODA). Account Summary, Operative Accounts and Transaction History match UBA columns. Statement lines post to the bank book first; Sync maps them to expenses, payroll, MoMo and a journal.';
  }
  if (/expense/.test(s)) {
    return `Expenses today ${money(snap.expTodayAmt)} across ${n(snap.expenses.length)} recorded expense${snap.expenses.length === 1 ? '' : 's'}. Accounting → Expenses.`;
  }
  if (/payroll|payslip|snnit|salary/.test(s) && !/uba/.test(s)) {
    return `HRM payroll book: ${n(snap.payrolls)} run${snap.payrolls === 1 ? '' : 's'}, ${n(snap.payrollPaid)} paid. Paying a run posts Payroll Expenses. Accounting → Transactions → Payroll maps Bank / Payroll Expenses onto the same HRM row. SNNIT remittance stays on HRM → SNNIT.`;
  }
  if (/repair/.test(s)) {
    return `${n(snap.repairs)} repair job${snap.repairs === 1 ? '' : 's'} on the repair till book. Repair → All jobs.`;
  }
  if (/transfer|put away|receive stock|\bwms\b/.test(s) && !/purpose|what is|explain/.test(s)) {
    return `${n(snap.transfers)} stock transfer${snap.transfers === 1 ? '' : 's'} recorded. WMS floor and Operations Hub share this book. New goods still receive at Operations Hub first.`;
  }
  if (/staff|user|employee|how many people/.test(s)) {
    return `${n(snap.users)} user/profile record${snap.users === 1 ? '' : 's'} in User Management.`;
  }
  if (/call centre|call center|missed call|inbound|callback/.test(s)) {
    return `Call Centre: ${n(snap.ccToday)} inbound today, ${n(snap.ccMissed)} missed/abandoned, ${n(snap.ccCalls.length)} tickets, ${n(snap.ccCamps.length)} campaigns. CRM → Call Centre. Missed rings sit on Missed / callback until they are recovered.`;
  }
  if (/collection|easybuy|hire purchase|bnpl/.test(s)) {
    return `Easybuy collections: ${n(snap.accounts.length)} accounts, ${n(snap.calls)} call records, ${n(snap.dueToday.length)} due today, ${n(snap.defaulting.length)} in default. CRM → Collections.`;
  }
  const named = findByName(s, snap);
  if (named.length) {
    return named.map((r) => {
      const st = r.status ? ` · ${r.status}` : '';
      const g = r.credit_grade ? ` · grade ${r.credit_grade}` : '';
      return `${r.kind}: ${r.name || r.full_name}${st}${g}${r.phone ? ' · ' + r.phone : ''}`;
    }).join('\n');
  }
  return '';
}

export function factsForPrompt() {
  const s = crawlErp();
  return [
    `page facts ${s.today}`,
    `HP accounts ${s.accounts.length}, in default ${s.defaulting.length}, due today ${s.dueToday.length}, broken PTP ${s.broken}`,
    `grades A${s.grades.A} B${s.grades.B} C${s.grades.C} D${s.grades.D} E${s.grades.E}`,
    `customers ${s.customers.length}, contacts ${s.contacts.length}, leads ${s.leads.length}, suppliers ${s.suppliers.length}`,
    `SKUs ${s.products}, sales today ${s.salesToday.length} ${money(s.salesTodayAmt)}, expenses today ${money(s.expTodayAmt)}`,
    `users ${s.users}, repairs ${s.repairs}, transfers ${s.transfers}`,
    `call centre today ${s.ccToday}, missed ${s.ccMissed}, tickets ${s.ccCalls.length}, campaigns ${s.ccCamps.length}`,
  ].join('; ');
}
