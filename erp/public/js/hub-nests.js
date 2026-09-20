/**
 * Desktop heading nests for color-coded modules.
 * When topics overflow one line, related children hide behind a parent.
 * Clicking the parent opens a nest page of those topics.
 */
export const MODULE_NESTS = {
  '/communications.html': [
    { key: 'nest-talk', label: 'Talk', children: ['announce', 'msg', 'calls', 'meet'] },
    { key: 'nest-work', label: 'Work', children: ['todo', 'docs', 'memos', 'remind'] },
  ],
  '/crm.html': [
    { key: 'nest-follow', label: 'Follow ups', children: ['followups', 'fcat'] },
    { key: 'nest-contacts', label: 'Contacts', children: ['leads', 'login', 'sources', 'life'] },
    { key: 'nest-proposals', label: 'Proposals', children: ['ptpl', 'proposals'] },
  ],
  '/hrm.html': [
    { key: 'nest-leave', label: 'Leave', children: ['types', 'leave'] },
    { key: 'nest-time', label: 'Time', children: ['att', 'holiday'] },
    { key: 'nest-org', label: 'Organisation', children: ['dept', 'desig'] },
  ],

  '/field-ops.html': [
    { key: 'nest-people', label: 'People', children: ['agents', 'join'] },
    { key: 'nest-work', label: 'Field work', children: ['visits', 'collect'] },
  ],
  '/projects.html': [
    { key: 'nest-work', label: 'Work', children: ['list', 'tasks'] },
    { key: 'nest-setup', label: 'Setup', children: ['cats', 'settings'] },
  ],
  '/assets.html': [
    { key: 'nest-alloc', label: 'Allocations', children: ['allocated', 'revoked'] },
    { key: 'nest-setup', label: 'Setup', children: ['maint', 'cats', 'settings'] },
  ],
  '/wms.html': [
    { key: 'nest-in', label: 'Inbound', children: ['recv', 'putaway'] },
    { key: 'nest-out', label: 'Outbound', children: ['pick', 'pack', 'dispatch'] },
    { key: 'nest-stock', label: 'Stock', children: ['stock', 'xfer', 'adj', 'count', 'bank'] },
  ],
  '/accounting.html': [
    { key: 'nest-books', label: 'Books', children: ['je', 'xfer', 'tx', 'ledger', 'recon'] },
    { key: 'nest-plan', label: 'Planning', children: ['budget', 'reports'] },
  ],
};

export function nestsFor(pathname) {
  const file = '/' + String(pathname || location.pathname || '').split('/').pop();
  if (file.startsWith('/accounting')) return MODULE_NESTS['/accounting.html'] || [];
  return MODULE_NESTS[file] || [];
}

export function resolveHubTab(raw, tabs, fallback, nests) {
  if (!raw) return fallback;
  if ((tabs || []).some((t) => t.key === raw)) return raw;
  if ((nests || []).some((n) => n.key === raw)) return raw;
  if (/^(topics|reports|setup|talk|work|books|planning|summary|settings|setting)$/.test(raw)) return raw;
  return fallback;
}

export function parentNest(nests, key) {
  return (nests || []).find((n) => n.key === key || n.children.includes(key)) || null;
}