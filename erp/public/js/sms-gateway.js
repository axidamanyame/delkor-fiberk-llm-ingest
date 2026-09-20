/**
 * Ghana SMS: Hubtel, Arkesel, Mnotify, or a generic POST URL.
 * Browser Test SMS goes through /functions/v1/send-receipt-sms so keys
 * are not required to survive CORS. Direct fetch is the fallback only.
 */
import { readLocal, writeLocal } from './settings-store.js';
import { SUPABASE_URL } from './supabaseClient.js';

export const PROVIDERS = {
  hubtel: {
    label: 'Hubtel',
    url: 'https://sms.hubtel.com/v1/messages/send',
    toParam: 'To',
    msgParam: 'Content',
    method: 'POST',
    auth: 'basic',
  },
  arkesel: {
    label: 'Arkesel',
    url: 'https://sms.arkesel.com/api/v2/sms/send',
    toParam: 'recipients',
    msgParam: 'message',
    method: 'POST',
    auth: 'api-key',
  },
  mnotify: {
    label: 'Mnotify',
    url: 'https://api.mnotify.com/api/sms/quick',
    toParam: 'recipient',
    msgParam: 'message',
    method: 'POST',
    auth: 'query-key',
  },
  custom: {
    label: 'Custom URL',
    url: '',
    toParam: 'to',
    msgParam: 'message',
    method: 'POST',
    auth: 'none',
  },
};

export function loadSms() {
  const s = readLocal();
  return {
    provider: s.sms_provider || 'arkesel',
    url: s.sms_url || PROVIDERS[s.sms_provider || 'arkesel'].url,
    toParam: s.sms_to_param || PROVIDERS[s.sms_provider || 'arkesel'].toParam,
    msgParam: s.sms_msg_param || PROVIDERS[s.sms_provider || 'arkesel'].msgParam,
    method: s.sms_method || 'POST',
    from: s.sms_from || 'DelkorFBK',
    senderIds: s.sms_sender_ids || 'DelkorFBK,Fiberk,AXI',
    mtnNumbers: s.sms_mtn_numbers || '0546443323',
    testNumber: s.sms_test_number || '',
    apiKey: s.sms_api_key || '',
    apiSecret: s.sms_api_secret || '',
  };
}

export function saveSms(partial) {
  const cur = readLocal();
  writeLocal({ ...cur, ...normalizeSave(partial) });
}

function normalizeSave(p) {
  return {
    sms_provider: p.provider,
    sms_url: p.url,
    sms_to_param: p.toParam,
    sms_msg_param: p.msgParam,
    sms_method: p.method,
    sms_from: p.from,
    sms_sender_ids: p.senderIds,
    sms_mtn_numbers: p.mtnNumbers,
    sms_test_number: p.testNumber,
    sms_api_key: p.apiKey,
    sms_api_secret: p.apiSecret,
  };
}

export function applyProvider(id) {
  const spec = PROVIDERS[id] || PROVIDERS.custom;
  const cur = loadSms();
  return {
    ...cur,
    provider: id,
    url: spec.url || cur.url,
    toParam: spec.toParam,
    msgParam: spec.msgParam,
    method: spec.method,
  };
}

/** 0XXXXXXXXX or +233… → 233XXXXXXXXX */
export function ghanaMsisdn(raw) {
  let n = String(raw || '').replace(/[^\d+]/g, '');
  if (n.startsWith('+')) n = n.slice(1);
  if (n.startsWith('0') && n.length === 10) n = '233' + n.slice(1);
  if (n.startsWith('2330')) n = '233' + n.slice(4);
  return n;
}

export function buildPayload(cfg, phone, message) {
  const to = ghanaMsisdn(phone);
  const from = cfg.from || 'DelkorFBK';
  const p = cfg.provider || 'custom';
  if (p === 'hubtel') {
    return { From: from, To: to, Content: message };
  }
  if (p === 'arkesel') {
    return { sender: from, message, recipients: [to] };
  }
  if (p === 'mnotify') {
    return { sender: from, message, recipient: [to] };
  }
  return {
    [cfg.toParam || 'to']: to,
    [cfg.msgParam || 'message']: message,
    from,
  };
}

export async function sendSms({ phone, message }) {
  const cfg = loadSms();
  const payload = {
    phone: ghanaMsisdn(phone),
    message,
    provider: cfg.provider,
    from: cfg.from,
    url: cfg.url,
    method: cfg.method,
    apiKey: cfg.apiKey,
    apiSecret: cfg.apiSecret,
    body: buildPayload(cfg, phone, message),
  };
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-receipt-sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && (data.ok || data.status === 'sent')) {
      return { status: 'sent', provider: data.provider || cfg.provider, detail: data };
    }
    if (res.status === 401 || res.status === 403) {
      return { status: 'preview', provider: cfg.provider, error: data.error || 'SMS function rejected the request' };
    }
    if (res.status !== 404) {
      return { status: 'error', provider: cfg.provider, error: data.error || data.message || res.statusText };
    }
  } catch {
    /* function not on this host */
  }
  if (!cfg.apiKey && cfg.provider !== 'custom') {
    return { status: 'preview', provider: cfg.provider, error: 'No API key saved — SMS stays in preview' };
  }
  try {
    const headers = { 'Content-Type': 'application/json' };
    let url = cfg.url;
    if (cfg.provider === 'hubtel' && cfg.apiKey) {
      headers.Authorization = 'Basic ' + btoa(`${cfg.apiKey}:${cfg.apiSecret || ''}`);
    }
    if (cfg.provider === 'arkesel' && cfg.apiKey) headers['api-key'] = cfg.apiKey;
    if (cfg.provider === 'mnotify' && cfg.apiKey) {
      url += (url.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(cfg.apiKey);
    }
    const res = await fetch(url, { method: cfg.method || 'POST', headers, body: JSON.stringify(payload.body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { status: 'error', provider: cfg.provider, error: data.message || data.error || res.statusText };
    return { status: 'sent', provider: cfg.provider, detail: data };
  } catch (e) {
    return {
      status: 'preview',
      provider: cfg.provider,
      error: 'Browser blocked the gateway (CORS). Deploy send-receipt-sms or test from the function.',
    };
  }
}
