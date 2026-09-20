/**
 * Collections operating layer on the Easybuy book:
 * PTP contracts, work queues, internal credit grade, amounts, field handoff.
 * No invented customers or balances — only what the call diary already holds.
 */
import { esc, uid, readLs, writeLs } from './ls-rows.js';

export const ACC_KEY = 'df_collection_accounts';
export const CALL_KEY = 'df_collection_calls';
export const PTP_KEY = 'df_collection_ptps';
export const HAND_KEY = 'df_collection_handoffs';
export const GRADE_KEY = 'df_customer_grades';
export const OFFER_KEY = 'df_collection_offers';
const FLAG = 'df_collection_ops_v1';

export function todayYmd() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function money(n) {
  if (n == null || n === '' || Number.isNaN(Number(n))) return '—';
  return '₵' + Number(n).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const QUEUES = [
  { key: 'broken_ptp', label: 'Broken promises' },
  { key: 'skip', label: 'Skip-trace' },
  { key: 'hardship', label: 'Hardship' },
  { key: 'language', label: 'Language desk' },
  { key: 'specialist', label: 'Dispute / specialist' },
  { key: 'unassigned', label: 'Unassigned' },
  { key: 'field', label: 'With field' },
];

const SKIP_FLAGS = ['wrong_number', 'dead_number', 'blocked'];
const SPEC_FLAGS = ['stolen', 'legal_threat', 'other_lender', 'dispute', 'escalate', 'return_request', 'unlock_failed'];

function accs() { return readLs(ACC_KEY, []) || []; }
function calls() { return readLs(CALL_KEY, []) || []; }
function ptps() { return readLs(PTP_KEY, []) || []; }
function hands() { return readLs(HAND_KEY, []) || []; }
function offers() { return readLs(OFFER_KEY, []) || []; }
function saveAcc(rows) { writeLs(ACC_KEY, rows); }
function savePtps(rows) { writeLs(PTP_KEY, rows); }
function saveHands(rows) { writeLs(HAND_KEY, rows); }
function saveGrades(rows) { writeLs(GRADE_KEY, rows); }
function saveOffers(rows) { writeLs(OFFER_KEY, rows); }

function flagsOf(a) { return Array.isArray(a?.flags) ? a.flags : []; }
function hasFlag(a, list) { return flagsOf(a).some((f) => list.includes(f)); }

export function gradeLetter(score) {
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  if (score >= 35) return 'D';
  return 'E';
}

export function gradeLabel(g) {
  return {
    A: 'A · appliance hire purchase eligible',
    B: 'B · next handset eligible',
    C: 'C · higher deposit · no promo',
    D: 'D · service path · no promo',
    E: 'E · no new credit',
  }[g] || g;
}

export const OFFER_TYPES = [
  { key: 'appliance', label: 'Appliance hire purchase', grades: ['A'] },
  { key: 'next_handset', label: 'Next handset (same HP line)', grades: ['A', 'B'] },
  { key: 'deposit_waiver', label: 'Deposit reduction on next HP', grades: ['A'] },
];

export function eligibilityFor(grade) {
  if (grade === 'A') return ['appliance', 'next_handset', 'deposit_waiver'];
  if (grade === 'B') return ['next_handset'];
  return [];
}

export function offerTypeLabel(key) {
  return OFFER_TYPES.find((t) => t.key === key)?.label || key;
}

export function scoreAccount(a, hist, contracts) {
  const reasons = [];
  const mine = (contracts || []).filter((p) => p.account_id === a.id);
  const kept = mine.filter((p) => p.status === 'kept').length;
  const broken = mine.filter((p) => p.status === 'broken').length;
  const totalP = kept + broken + mine.filter((p) => p.status === 'rolled').length;
  let ptpPts = 15;
  if (mine.length) {
    const den = kept + broken || 1;
    ptpPts = Math.round(30 * (kept / den));
    if (broken && !kept) ptpPts = 0;
    reasons.push(`PTP ${kept} kept / ${broken} broken`);
  } else reasons.push('No PTP yet (neutral)');

  let reg = 8;
  if (a.status === 'completed' || a.regular || flagsOf(a).includes('regular_payer')) { reg = 25; reasons.push('Regular / settled'); }
  else if (a.status === 'current') { reg = 20; reasons.push('Paying'); }
  else if (a.status === 'ptp') { reg = 12; }
  else if (a.status === 'on_hold') { reg = 10; }

  const dials = hist || [];
  const rpc = dials.filter((c) => c.outcome && c.outcome !== 'no_contact').length;
  let contact = dials.length ? Math.round(15 * (rpc / dials.length)) : 8;
  if (hasFlag(a, SKIP_FLAGS)) { contact = Math.min(contact, 4); reasons.push('Skip-trace flag'); }
  else reasons.push(`Reach ${rpc}/${dials.length || 0} calls`);

  let stress = 15;
  if (flagsOf(a).includes('hardship')) { stress -= 6; reasons.push('Hardship'); }
  if (flagsOf(a).includes('dispute') || a.status === 'dispute') { stress -= 5; reasons.push('Dispute'); }
  if (flagsOf(a).includes('escalate') || a.status === 'escalate') { stress -= 4; }
  if (flagsOf(a).includes('other_lender')) { stress -= 8; reasons.push('Other lender'); }
  if (flagsOf(a).includes('stolen') || flagsOf(a).includes('legal_threat')) { stress = 0; reasons.push('Stolen / legal'); }
  stress = Math.max(0, stress);

  const att = Number(a.attempts || dials.length || 0);
  let effort = 15;
  if (att >= 16) effort = 2;
  else if (att >= 9) effort = 6;
  else if (att >= 5) effort = 10;
  if (att >= 9) reasons.push(`${att} attempts`);

  let score = Math.max(0, Math.min(100, ptpPts + reg + contact + stress + effort));
  let grade = gradeLetter(score);
  if (flagsOf(a).includes('stolen') || flagsOf(a).includes('legal_threat')) {
    grade = 'E';
    score = Math.min(score, 34);
  }
  return { score, grade, reasons, ptpPts, kept, broken, totalP };
}

function settlePtpStatus(p, a, hist, laterPtp) {
  if (p.manual) return p.status;
  const after = (hist || []).filter((c) => String(c.at || '') > String(p.at || p.promised_on || ''));
  if (after.some((c) => ['current', 'completed'].includes(c.outcome))) return 'kept';
  if (a.status === 'completed' || a.status === 'current') return 'kept';
  if (laterPtp) return 'rolled';
  const due = p.due_on || '';
  if (due && due < todayYmd() && !['completed', 'current'].includes(a.status)) return 'broken';
  return 'open';
}

export function derivePtps(accounts, hist) {
  const out = [];
  (accounts || []).forEach((a) => {
    const mine = (hist || []).filter((c) => c.account_id === a.id).sort((x, y) => String(x.at).localeCompare(String(y.at)));
    const ptpCalls = mine.filter((c) => c.outcome === 'ptp');
    ptpCalls.forEach((c, i) => {
      const row = {
        id: 'ptp-' + (c.id || uid()).replace(/^call-/, ''),
        account_id: a.id,
        name: a.name,
        phone: a.phone,
        call_id: c.id,
        promised_on: c.called_on || String(c.at || '').slice(0, 10),
        due_on: c.next_follow_up || '',
        amount: c.amount == null || c.amount === '' ? null : Number(c.amount),
        channel: c.channel || '',
        agent: a.agent || '',
        note: c.follow_up || c.response || '',
        at: c.at,
        manual: false,
        status: 'open',
      };
      row.status = settlePtpStatus(row, a, mine, ptpCalls[i + 1]);
      out.push(row);
    });
  });
  return out;
}

export function ensureOps() {
  const accounts = accs();
  const hist = calls();
  if (!accounts.length) return { accounts, ptps: [], grades: [] };
  let contracts = ptps();
  try {
    if (localStorage.getItem(FLAG) !== '1' || !contracts.length) {
      contracts = derivePtps(accounts, hist);
      savePtps(contracts);
      localStorage.setItem(FLAG, '1');
    } else {
      const byAcc = {};
      contracts.forEach((p) => { (byAcc[p.account_id] ||= []).push(p); });
      Object.values(byAcc).forEach((list) => list.sort((a, b) => String(a.at || a.promised_on).localeCompare(String(b.at || b.promised_on))));
      contracts = contracts.map((p) => {
        const list = byAcc[p.account_id] || [];
        const idx = list.findIndex((x) => x.id === p.id);
        const later = idx >= 0 ? list[idx + 1] : null;
        const a = accounts.find((x) => x.id === p.account_id) || {};
        const mine = hist.filter((c) => c.account_id === p.account_id);
        return { ...p, status: settlePtpStatus(p, a, mine, later) };
      });
      savePtps(contracts);
    }
  } catch { /* ignore */ }

  const grades = [];
  const nextAcc = accounts.map((a) => {
    const mineC = hist.filter((c) => c.account_id === a.id);
    const mineP = contracts.filter((p) => p.account_id === a.id);
    const s = scoreAccount(a, mineC, mineP);
    grades.push({
      phone: a.phone || '',
      name: a.name,
      account_id: a.id,
      score: s.score,
      grade: s.grade,
      reasons: s.reasons,
      kept: s.kept,
      broken: s.broken,
      at: new Date().toISOString(),
    });
    return {
      ...a,
      credit_score: s.score,
      credit_grade: s.grade,
      credit_why: s.reasons.join(' · '),
      promo_eligible: eligibilityFor(s.grade),
      promo_label: eligibilityFor(s.grade).includes('appliance')
        ? 'Eligible: appliance hire purchase'
        : eligibilityFor(s.grade).includes('next_handset')
          ? 'Eligible: next handset'
          : 'Not eligible for HP promotion',
    };
  });
  saveAcc(nextAcc);
  saveGrades(grades);
  return { accounts: nextAcc, ptps: contracts, grades };
}

export function listPtps(filter) {
  ensureOps();
  const today = todayYmd();
  return ptps().filter((p) => {
    if (!filter || filter === 'all') return true;
    if (filter === 'open') return p.status === 'open';
    if (filter === 'due') return p.status === 'open' && p.due_on && p.due_on <= today;
    if (filter === 'broken') return p.status === 'broken';
    if (filter === 'kept') return p.status === 'kept';
    if (filter === 'rolled') return p.status === 'rolled';
    return p.status === filter;
  }).sort((a, b) => String(b.due_on || b.promised_on || '').localeCompare(String(a.due_on || a.promised_on || '')));
}

export function queueAccounts(key) {
  ensureOps();
  const accounts = accs();
  const brokenIds = new Set(ptps().filter((p) => p.status === 'broken').map((p) => p.account_id));
  return accounts.filter((a) => {
    if (key === 'broken_ptp') return brokenIds.has(a.id);
    if (key === 'skip') return hasFlag(a, SKIP_FLAGS);
    if (key === 'hardship') return flagsOf(a).includes('hardship');
    if (key === 'language') return flagsOf(a).includes('language') || (a.lang && a.lang !== 'en');
    if (key === 'specialist') return hasFlag(a, SPEC_FLAGS) || ['dispute', 'escalate'].includes(a.status);
    if (key === 'unassigned') return !String(a.agent || '').trim();
    if (key === 'field') return a.field_status === 'handed' || a.field_status === 'accepted';
    return true;
  });
}

export function queueCounts() {
  const o = {};
  QUEUES.forEach((q) => { o[q.key] = queueAccounts(q.key).length; });
  return o;
}

export function gradeCounts() {
  ensureOps();
  const o = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  accs().forEach((a) => { o[a.credit_grade || 'C'] = (o[a.credit_grade || 'C'] || 0) + 1; });
  return o;
}

export function addPtp({ account, due_on, amount, channel, note, call_id, agent }) {
  const row = {
    id: 'ptp-' + uid().slice(0, 10),
    account_id: account.id,
    name: account.name,
    phone: account.phone,
    call_id: call_id || '',
    promised_on: todayYmd(),
    due_on: due_on || '',
    amount: amount == null || amount === '' ? null : Number(amount),
    channel: channel || 'momo',
    agent: agent || account.agent || '',
    note: note || '',
    at: new Date().toISOString(),
    manual: false,
    status: 'open',
  };
  savePtps([row, ...ptps()]);
  return row;
}

export function setPtpStatus(id, status) {
  savePtps(ptps().map((p) => p.id === id ? { ...p, status, manual: true } : p));
}

export function markPtpsKept(accountId) {
  savePtps(ptps().map((p) => (p.account_id === accountId && p.status === 'open' ? { ...p, status: 'kept', manual: true } : p)));
}

export function applyPayment(accountId, amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return;
  saveAcc(accs().map((a) => {
    if (a.id !== accountId) return a;
    const paid = Number(a.amount_paid || 0) + n;
    const due = a.amount_due == null || a.amount_due === '' ? a.amount_due : Math.max(0, Number(a.amount_due) - n);
    return { ...a, amount_paid: paid, amount_due: due };
  }));
  markPtpsKept(accountId);
}

export function setAmountDue(accountId, amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return;
  saveAcc(accs().map((a) => a.id === accountId ? { ...a, amount_due: n } : a));
}

export function handoffToField(account, { note, agent, from_desk } = {}) {
  const row = {
    id: 'foh-' + uid().slice(0, 10),
    account_id: account.id,
    name: account.name,
    phone: account.phone,
    grade: account.credit_grade || '',
    score: account.credit_score || 0,
    note: note || account.last_note || '',
    from_desk: from_desk || 'Call Centre',
    to_field: agent || '',
    at: new Date().toISOString(),
    status: 'open',
  };
  saveHands([row, ...hands()]);
  saveAcc(accs().map((a) => a.id === account.id ? { ...a, field_status: 'handed', field_at: row.at, field_note: row.note } : a));
  return row;
}

export function listHandoffs(filter) {
  return hands().filter((h) => !filter || filter === 'all' || h.status === filter);
}

export function setHandoffStatus(id, status) {
  const row = hands().find((h) => h.id === id);
  saveHands(hands().map((h) => h.id === id ? { ...h, status } : h));
  if (row) {
    saveAcc(accs().map((a) => a.id === row.account_id ? { ...a, field_status: status === 'done' ? 'done' : 'accepted' } : a));
  }
}

export function gradeBadge(g) {
  const letter = g || '—';
  return `<span class="col-grade col-g-${esc(letter)}">${esc(letter)}</span>`;
}

export function ptpPill(st) {
  const lab = { open: 'Open PTP', due: 'Due', broken: 'Broken', kept: 'Kept', rolled: 'Rolled' }[st] || st;
  return `<span class="col-pill col-ptp-${esc(st || 'open')}">${esc(lab)}</span>`;
}

export function listEligible(kind) {
  ensureOps();
  return accs().filter((a) => {
    const el = a.promo_eligible || eligibilityFor(a.credit_grade);
    if (kind === 'appliance') return el.includes('appliance');
    if (kind === 'next_handset') return el.includes('next_handset');
    if (kind === 'any') return el.length > 0;
    return el.length > 0;
  });
}

export function listOffers(status) {
  return offers().filter((o) => !status || status === 'all' || o.status === status);
}

export function addOffer({ account, offer_type, note, agent, product }) {
  const allowed = eligibilityFor(account.credit_grade);
  if (!allowed.includes(offer_type)) {
    throw new Error(account.credit_grade === 'A' || account.credit_grade === 'B'
      ? 'This grade does not unlock that promotion.'
      : 'This customer is not eligible for a hire-purchase promotion.');
  }
  const row = {
    id: 'off-' + uid().slice(0, 10),
    account_id: account.id,
    name: account.name,
    phone: account.phone,
    grade: account.credit_grade,
    score: account.credit_score,
    line: 'hire_purchase',
    offer_type,
    title: offerTypeLabel(offer_type),
    product: product || '',
    note: note || '',
    agent: agent || account.agent || '',
    status: 'offered',
    offered_on: todayYmd(),
    at: new Date().toISOString(),
  };
  saveOffers([row, ...offers()]);
  return row;
}

export function setOfferStatus(id, status) {
  saveOffers(offers().map((o) => o.id === id ? { ...o, status, responded_at: new Date().toISOString() } : o));
}

export { esc };
