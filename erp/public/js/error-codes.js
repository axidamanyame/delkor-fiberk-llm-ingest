/**
 * Delkor-Fiberk error nomenclature for IT.
 * Family  AUTH | GATE | PERM | DATA | NET
 * Number  1xxx login  2xxx session  3xxx permission  4xxx data  5xxx network
 */
import { writeLs, readLs } from './ls-rows.js';
import { writeAudit } from './supabaseClient.js';

export const SUPPORT = {
  email: 'support@delkorfiberk.com',
  phone: '054 644 3323',
};

export const ERROR_KEY = 'df_error_log';

export const ERRORS = {
  AUTH_MISSING: {
    code: 'DF-AUTH-1001',
    title: 'Missing login details',
    hint: 'Enter both username and password.',
  },
  AUTH_EMAIL: {
    code: 'DF-AUTH-1002',
    title: 'Invalid email',
    hint: 'Use a single email such as hq@delkor-fiberk.com.',
  },
  AUTH_UNKNOWN_USER: {
    code: 'DF-AUTH-1003',
    title: 'Username not recognised',
    hint: 'Use the ERP user email from Users.',
  },
  AUTH_BAD_CRED: {
    code: 'DF-AUTH-1004',
    title: 'Wrong username or password',
    hint: 'Check the ERP email and password. A Grok/X login only opens the site.',
  },
  AUTH_TIMEOUT: {
    code: 'DF-AUTH-1005',
    title: 'Login timed out',
    hint: 'Check the network and try again.',
  },
  AUTH_FAIL: {
    code: 'DF-AUTH-1006',
    title: 'Sign-in failed',
    hint: 'Try again. If it continues, contact support.',
  },
  AUTH_REGISTER: {
    code: 'DF-AUTH-1007',
    title: 'Registration failed',
    hint: 'Check the form and try again.',
  },
  AUTH_REGISTER_DUP: {
    code: 'DF-AUTH-1008',
    title: 'Account already exists',
    hint: 'Sign in with that email, or use Account Registration with a different email.',
  },
  AUTH_REGISTER_WEAK: {
    code: 'DF-AUTH-1009',
    title: 'Password too short',
    hint: 'Use at least 6 characters and confirm it matches.',
  },
  GATE_ONLY: {
    code: 'DF-GATE-1101',
    title: 'Site invite is not an ERP password',
    hint: 'Continue with Grok first, then sign in here with the ERP user.',
  },
  GATE_PENDING: {
    code: 'DF-GATE-1102',
    title: 'Account waiting for review',
    hint: 'An administrator must assign a role and issue your access key.',
  },
  GATE_KEY: {
    code: 'DF-GATE-1103',
    title: 'Access key not accepted',
    hint: 'Ask your administrator for the key they generated when they assigned your role.',
  },
  GATE_DEL_KEY: {
    code: 'DF-GATE-1104',
    title: 'Delete access key not accepted',
    hint: 'Ask HQ Admin for the current delete access key (Users → Delete access key). Wrong keys are written to the audit log.',
  },
  PERM_DENIED: {
    code: 'DF-PERM-3001',
    title: 'Not allowed',
    hint: 'This role cannot complete that action.',
  },
  DATA_SAVE: {
    code: 'DF-DATA-4001',
    title: 'Could not save',
    hint: 'The record was not written. Try again or contact support.',
  },
  NET_TIMEOUT: {
    code: 'DF-NET-5001',
    title: 'Network timeout',
    hint: 'The company database did not respond in time.',
  },
};

export const NOMENCLATURE = [
  { family: 'AUTH', range: '1000–1999', meaning: 'Sign-in, password, username' },
  { family: 'GATE', range: '1100–1199', meaning: 'Grok invite vs ERP login' },
  { family: 'PERM', range: '3000–3999', meaning: 'Role / HQ authority' },
  { family: 'DATA', range: '4000–4999', meaning: 'Save, update, delete' },
  { family: 'NET', range: '5000–5999', meaning: 'Timeout or connection' },
];

export function supportLine() {
  return `Contact support: ${SUPPORT.email} · ${SUPPORT.phone}`;
}

export function formatError(key, extra = '') {
  const e = ERRORS[key] || ERRORS.AUTH_FAIL;
  const bits = [`${e.title} [${e.code}]`, e.hint];
  if (extra) bits.push(String(extra));
  bits.push(supportLine());
  return bits.join('\n');
}

export function classifyRegisterError(message) {
  const m = String(message || '');
  if (/already|registered|exists/i.test(m)) return 'AUTH_REGISTER_DUP';
  if (/password|weak|short|6/i.test(m)) return 'AUTH_REGISTER_WEAK';
  if (/timed out|timeout/i.test(m)) return 'AUTH_TIMEOUT';
  if (/network|fetch|failed to/i.test(m)) return 'NET_TIMEOUT';
  return 'AUTH_REGISTER';
}

export function classifyLoginError(message) {
  const m = String(message || '');
  if (/missing|both username|required/i.test(m)) return 'AUTH_MISSING';
  if (/invalid email|atCount|too many @/i.test(m)) return 'AUTH_EMAIL';
  if (/not recognised|not recognized|unknown/i.test(m)) return 'AUTH_UNKNOWN_USER';
  if (/invite|grok|site invite/i.test(m)) return 'GATE_ONLY';
  if (/pending|waiting for review/i.test(m)) return 'GATE_PENDING';
  if (/timed out|timeout/i.test(m)) return 'AUTH_TIMEOUT';
  if (/network|fetch|failed to fetch/i.test(m)) return 'NET_TIMEOUT';
  if (/database error granting user|rls|row-level|policy/i.test(m)) return 'AUTH_FAIL';
  if (/invalid login|wrong|credential|password/i.test(m)) return 'AUTH_BAD_CRED';
  return 'AUTH_FAIL';
}

export function loadErrorLog() {
  return readLs(ERROR_KEY, []);
}

export function logError(key, detail = {}) {
  const e = ERRORS[key] || { code: 'DF-UNK-0000', title: 'Unknown error', hint: '' };
  const row = {
    id: 'err-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    created_at: new Date().toISOString(),
    actor_email: detail.email || detail.actor || '',
    action: 'error',
    entity_type: 'error_code',
    entity_id: e.code,
    code: e.code,
    title: e.title,
    subsidiary_code: 'group',
    summary: `${e.code} · ${e.title}${detail.summary ? ' · ' + detail.summary : ''}`,
    detail: String(detail.detail || '').slice(0, 500),
    path: typeof location !== 'undefined' ? location.pathname : '',
  };
  try {
    const cur = loadErrorLog();
    writeLs(ERROR_KEY, [row, ...cur].slice(0, 400));
  } catch { /* ignore */ }
  writeAudit({
    action: 'error',
    entity_type: 'error_code',
    entity_id: e.code,
    subsidiary_code: 'group',
    summary: row.summary,
    payload: { code: e.code, detail: row.detail, email: row.actor_email, path: row.path },
  }).catch(() => {});
  return row;
}
