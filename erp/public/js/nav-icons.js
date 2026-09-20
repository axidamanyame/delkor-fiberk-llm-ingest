/** Lucide-style sidebar icons. Keys match MENU.icon. */
function svg(inner) {
  return `<svg class="nav-svg" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

export const NAV_ICONS = {
  home: svg('<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  messages: svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
  megaphone: svg('<path d="m3 11 18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>'),
  records: svg('<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/><rect x="8" y="4" width="8" height="16" rx="1"/>'),
  cart: svg('<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>'),
  hub: svg('<path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35"/><path d="M6 18h12"/><path d="M6 14h12"/><rect x="2" y="3" width="20" height="5"/><path d="M12 8v14"/>'),
  wms: svg('<path d="M3 9h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 9 12 3l9 6"/><path d="M12 3v18"/><path d="M8 13h2M14 13h2"/>'),
  bag: svg('<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>'),
  bank: svg('<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>'),
  chart: svg('<path d="M3 3v18h18"/><path d="M7 16v-5"/><path d="M12 16V8"/><path d="M17 16v-9"/>'),
  cog: svg('<path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"/><path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="m4.9 4.9 1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  users: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  bot: svg('<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>'),
  book: svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
};

const ALIAS = {
  box: 'records', truck: 'wms', adjust: 'hub', people: 'users', user: 'users',
  receipt: 'bank', receip: 'bank', bell: 'messages', package: 'records',
};

export function iconHtml(key) {
  const raw = String(key || '');
  const k = ALIAS[raw] || raw;
  if (NAV_ICONS[k]) return `<span class="nav-ico">${NAV_ICONS[k]}</span>`;
  if (k.includes('<svg')) return `<span class="nav-ico">${k}</span>`;
  if (!k || /^[a-z][a-z0-9_-]{1,20}$/i.test(k)) return '<span class="nav-ico"></span>';
  return `<span class="nav-ico nav-ico-emoji">${k}</span>`;
}
