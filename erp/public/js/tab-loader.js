import { registerClickGuard, PRIORITY } from './click-router.js';
/** Same-file tabs stay in place. No document reload, no shell timeout. */
const TAB_SEL = [
  '.acc-nav a',
  '.desk-tabs a',
  '.rpt-subtabs a',
  '.hub-tabs a',
  '.bank-head-tabs a',
  '.addon-head-tabs a',
  '.acc-inner-tabs a',
  'a[data-htab]',
  'button[data-htab]',
  'a.acc-tab',
  'button.acc-tab',
  'a.mod-book-a',
].join(',');

function sameFile(href) {
  try {
    const u = new URL(href, location.href);
    return u.pathname === location.pathname;
  } catch {
    return href.startsWith('?') || href.startsWith('#');
  }
}

export function openTab(hrefOrKey) {
  let href = String(hrefOrKey || '');
  if (!href.includes('/') && !href.startsWith('?')) href = `?tab=${encodeURIComponent(href)}`;
  try {
    const u = new URL(href, location.origin + location.pathname);
    const next = u.pathname + u.search + u.hash;
    if (next !== location.pathname + location.search + location.hash) {
      history.pushState({ spa: next, tab: true }, '', next);
    }
  } catch { /* ignore */ }
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.dispatchEvent(new CustomEvent('df-tab', { detail: href }));
}

export function mountTabLoader() {
  if (document.documentElement.dataset.tabLoader === '1') return;
  document.documentElement.dataset.tabLoader = '1';
  registerClickGuard({
    name: 'tab-nav',
    priority: PRIORITY.tab,
    match: (origin) => origin?.closest?.(TAB_SEL),
    claim: (a) => {
      const href = a.getAttribute('href') || (a.dataset.htab ? `?tab=${a.dataset.htab}` : '');
      if (!href || href === '#') return 'pass';
      if (!sameFile(href) && !href.startsWith('?') && !href.startsWith('#')) return 'pass';
      a.closest('.topic-drop')?.classList.remove('open');
      openTab(href);
      return 'claim';
    },
  });
  window.openTab = openTab;
  if (!document.getElementById('tab-loader-css')) {
    const s = document.createElement('style');
    s.id = 'tab-loader-css';
    s.textContent = 'button.acc-tab{background:none;border:0;border-bottom:2px solid transparent;cursor:pointer;font:inherit}';
    document.head.appendChild(s);
  }
}
