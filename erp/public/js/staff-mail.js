/** Outbound staff mail. Recorded locally; a copy is always kept for the registered inbox. */
import { readLs, writeLs, uid } from './ls-rows.js';
import { supabase } from './supabaseClient.js';

export const OUTBOX_KEY = 'df_mail_outbox';

function all() {
  const rows = readLs(OUTBOX_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

export function listOutbox(email) {
  const to = String(email || '').toLowerCase();
  if (!to) return all();
  return all().filter((m) => String(m.to || '').toLowerCase() === to);
}

export async function sendStaffMail({ to, subject, body, kind } = {}) {
  const email = String(to || '').toLowerCase();
  const row = {
    id: uid(),
    to: email,
    subject: subject || '(no subject)',
    body: body || '',
    kind: kind || 'staff',
    created_at: new Date().toISOString(),
    status: 'queued',
  };
  if (!email) {
    row.status = 'failed';
    row.error = 'Missing recipient';
    writeLs(OUTBOX_KEY, [row, ...all()].slice(0, 200));
    return { ok: false, error: row.error, row };
  }
  try {
    const ins = await Promise.race([
      supabase.from('mail_outbox').insert({
        to: email,
        subject: row.subject,
        body: row.body,
        kind: row.kind,
      }),
      new Promise((resolve) => setTimeout(() => resolve({ error: { message: 'local-only' } }), 1200)),
    ]);
    if (!ins?.error) row.status = 'sent';
    else {
      row.status = 'local';
      row.error = ins.error.message;
    }
  } catch (ex) {
    row.status = 'local';
    row.error = String(ex?.message || ex);
  }
  writeLs(OUTBOX_KEY, [row, ...all()].slice(0, 200));
  return { ok: true, delivered: row.status === 'sent', row };
}

export function accessKeyEmail({ name, email, role, key, kind }) {
  const who = name || email;
  const ho = kind === 'head_office' || String(key || '').toUpperCase().startsWith('HO-');
  return {
    to: email,
    subject: `Your Delkor-Fiberk access key — ${role}`,
    kind: 'access-key',
    body: [
      `Hello ${who},`,
      '',
      'Your registration has been reviewed.',
      `Role assigned: ${role}`,
      `${ho ? 'Head-office access key' : 'Operations access key'}: ${key}`,
      '',
      ho
        ? 'Sign in, open Orientation, and enter this key. You will land on the head-office dashboard (All Subsidiaries).'
        : 'Sign in, open Orientation, and enter this key. You will land on the till or field floor for your job.',
      '',
      'A copy of this key is also in your in-app notifications.',
      '',
      'Support: support@delkorfiberk.com · 054 644 3323',
      'Delkor-Fiberk Group',
    ].join('\n'),
  };
}
