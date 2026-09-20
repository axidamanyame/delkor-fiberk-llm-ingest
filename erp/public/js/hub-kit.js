/** Shared right-pane tab chrome for add-on hubs.
 * Phone: headings that overflow one line become a dropdown card.
 * Desktop: overflow nests related topics; the parent opens a nest page.
 */
import { esc } from './ls-rows.js';
import { nestsFor } from './hub-nests.js';
import { pushDeskBack, syncJumpBar } from './desk-chrome.js';
import { floorFor, headingOf, resolveFloorOn, groupCards } from './module-floor.js';
import { MODULE_BOOKS } from './module-books.js';
export { nestsFor, resolveHubTab } from './hub-nests.js';
export { floorFor, headingOf, resolveFloorOn } from './module-floor.js';

/** Color modules do not host Settings. Send HQ to System → Modules. */
export function bounceModuleSettings() {
  const u = '/settings.html?tab=modules';
  if (typeof window.__dfOpenSpa === 'function') window.__dfOpenSpa(u);
  else {
    try { history.pushState({ spa: u }, '', u); } catch { /* ignore */ }
    location.assign(u);
  }
  return 'settings';
}

const TAB_BARS = '.bank-head-tabs, .hub-subtabs, .addon-head-tabs, .acc-nav, .acc-inner-tabs, .rpt-subtabs, .mod-tabs';

const FLOOR_CHIP = {
  accounting: '#E7A8D4',
  communications: '#0D1B2A',
  academy: '#7B3FE4',
  hrm: '#6A4A9A',
  crm: '#9AABB8',
  wms: '#1B7A62',
  repair: '#B39A8A',
  manufacturing: '#F0A020',
  project: '#E91E8A',
  assets: '#3BA8B8',
  fieldops: '#C85A22',
  connector: '#2ED573',
  spreadsheet: '#2B7DE9',
  woocommerce: '#7A3AA8',
  'ai-assistance': '#6F8F7A',
  'call-centre': '#9B2040',
  'catalogue-qr': '#F5A024',
  'custom-dashboards': '#6C3CE0',
};

export function ensureSandboxCss() {
  if (document.querySelector('link[href="/css/sandbox.css"]')) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = '/css/sandbox.css';
  document.head.appendChild(l);
}

export function hubTabs(brand, tabs, on, brandKey = '', file = '') {
  const hrefFor = (k) => {
    const hit = (tabs || []).find((t) => t.key === k);
    if (hit?.href) return hit.href;
    if (!file) return (!k || k === brandKey) ? '?' : `?tab=${encodeURIComponent(k)}`;
    return (!k || k === brandKey) ? file : `${file}?tab=${encodeURIComponent(k)}`;
  };
  const active = (tabs || []).find((t) => t.key === on);
  const dropLabel = (active?.label || String(brand || 'Topics').replace(/<[^>]+>/g, '').trim() || 'Topics');
  const phone = isPhoneLayout();
  const brandText = String(brand || 'WMS').replace(/<[^>]+>/g, '').trim() || 'WMS';
  /* On a sub-tab there was no way back except the browser's own back button:
     the cards navigate via ?tab=, and the brand link reads as a heading rather
     than a control — and on a phone it collapses into the dropdown. This adds
     an explicit one, for every hub, in the one place they all render from. */
  const atHome = !on || on === brandKey;
  const brandNorm = brandText.toLowerCase();
  const visibleTabs = (tabs || []).filter((t) => {
    if (t.key === brandKey) return false;
    const lab = String(t.label || '').replace(/<[^>]+>/g, '').trim().toLowerCase();
    if (lab && lab === brandNorm) return false;
    return true;
  });
  return `<div class="topic-drop${phone ? ' is-phone' : ''}">
    <button type="button" class="topic-drop-btn" aria-haspopup="true" aria-expanded="false"><span>${esc(dropLabel)}</span><span class="topic-drop-caret" aria-hidden="true">▾</span></button>
    <nav class="bank-head-tabs hub-tabs" data-hub-file="${esc(file || '')}" data-hub-on="${esc(on || '')}" data-brand-key="${esc(brandKey || '')}">
    ${atHome ? '' : `<a href="${hrefFor(brandKey)}" class="df-desk-back hub-back" data-htab="${esc(brandKey || tabs[0]?.key || '')}" title="Back to ${esc(brandText)}" aria-label="Back to ${esc(brandText)}">← ${esc(brandText)}</a>`}
    <a href="${hrefFor(brandKey)}" class="hub-brand${atHome ? ' on' : ''}" data-htab="${esc(brandKey || tabs[0]?.key || '')}">${esc(brandText)}</a>
    ${visibleTabs.map((t) => `<a href="${hrefFor(t.key)}" class="${on === t.key ? 'on' : ''}" data-htab="${esc(t.key)}">${t.label}</a>`).join('')}
  </nav></div>`;
}

export function bindHubTabs(app, go) {
  if (app) app.__hubGo = go;
  const phone = isPhoneLayout();
  app.querySelectorAll('.topic-drop').forEach((d) => {
    d.classList.toggle('is-phone', phone);
    d.classList.remove('open');
    const btn = d.querySelector('.topic-drop-btn');
    if (!btn || btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const open = d.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });
  app.querySelectorAll('[data-htab]').forEach((a) => {
    a.onclick = (e) => {
      const href = a.getAttribute('href') || '';
      try {
        const u = new URL(href, location.href);
        const sameFile = !href || href.startsWith('?') || u.pathname === location.pathname;
        if (href && !sameFile) {
          a.closest('.topic-drop')?.classList.remove('open');
          return;
        }
      } catch { /* follow */ }
      e.preventDefault();
      e.stopPropagation();
      a.closest('.topic-drop')?.classList.remove('open');
      const tab = a.dataset.htab;
      try {
        const u = new URL(href, location.origin + location.pathname);
        const next = u.pathname + u.search + u.hash;
        if (next !== location.pathname + location.search + location.hash) {
          try { pushDeskBack(); } catch { /* ignore */ }
          history.pushState({ spa: next }, '', next);
          try { sessionStorage.setItem('df_last_path', next); } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
      if (typeof go === 'function') go(tab);
      try { syncJumpBar(); } catch { /* ignore */ };
    };
  });
  bindOverflowTabs(app);
}

function isPhoneLayout() {
  try {
    if (document.documentElement.classList.contains('ult-phone')) return true;
    const ua = navigator.userAgent || '';
    if (/iPhone|iPod|SamsungBrowser|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true;
    if (/Android/i.test(ua) && !/iPad|Tablet/i.test(ua)) return true;
    const w = Math.min(window.innerWidth || 9999, window.visualViewport?.width || 9999);
    if (w <= 820) return true;
    if (window.matchMedia('(pointer: coarse)').matches && w <= 1200) return true;
  } catch { /* ignore */ }
  return false;
}

function exceedsOneLine(nav) {
  if (!nav || nav.children.length < 3) return false;
  const host = nav.closest('.tab-drop') || nav;
  const width = host.clientWidth || nav.parentElement?.clientWidth || 360;
  const probe = nav.cloneNode(true);
  probe.removeAttribute('data-nested');
  probe.style.cssText = `position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;z-index:-1;display:flex;flex-wrap:wrap;flex-direction:row;height:auto;overflow:visible;width:${Math.max(width, 200)}px;margin:0`;
  const parent = nav.closest('.tab-drop')?.parentNode || nav.parentNode;
  if (!parent) return nav.children.length > 4;
  parent.appendChild(probe);
  const first = probe.querySelector('a, button');
  const line = Math.max(first?.getBoundingClientRect().height || 36, 32);
  const over = probe.scrollHeight > line + 12;
  probe.remove();
  return over;
}

function navCurrentLabel(nav) {
  const on = nav.querySelector('a.on') || nav.querySelector('.hub-brand') || nav.querySelector('a');
  return (on?.textContent || 'Topics').replace(/\s+/g, ' ').trim();
}

function unwrapTabDrop(wrap) {
  const nav = wrap.querySelector(TAB_BARS);
  if (nav) wrap.parentNode?.insertBefore(nav, wrap);
  wrap.remove();
}

function tabSpec(nav) {
  if (nav.dataset.hubTabs) {
    try { return JSON.parse(nav.dataset.hubTabs); } catch { /* ignore */ }
  }
  const spec = [...nav.querySelectorAll('a[data-htab], a.acc-tab, a[data-woo-tab], a[data-ss-tab], a[data-pane]')].map((a) => ({
    key: a.dataset.htab || a.dataset.wooTab || a.dataset.ssTab || a.dataset.pane || '',
    label: (a.textContent || '').replace(/\s+/g, ' ').trim(),
    href: a.getAttribute('href') || '',
    brand: a.classList.contains('hub-brand'),
    html: a.innerHTML,
  })).filter((t) => t.key);
  try { nav.dataset.hubTabs = JSON.stringify(spec); } catch { /* ignore */ }
  return spec;
}

function nestHref(file, key, spec) {
  const hit = spec.find((t) => t.key === key);
  if (hit?.href && !String(key).startsWith('nest-')) return hit.href;
  const path = file || ('/' + (location.pathname.split('/').pop() || ''));
  if (String(key).startsWith('nest-') && path.includes('accounting')) return '/accounting.html?tab=' + encodeURIComponent(key);
  return path + (key ? '?tab=' + encodeURIComponent(key) : '');
}

function applyDesktopNests(nav) {
  const file = nav.dataset.hubFile || ('/' + (location.pathname.split('/').pop() || ''));
  const nests = nestsFor(file);
  if (!nests.length) return;
  const spec = tabSpec(nav);
  if (spec.length < 3) return;
  const nested = nav.dataset.nested === '1';
  nav.style.flexWrap = 'nowrap';
  nav.style.overflow = 'hidden';
  if (!nested) nav.dataset.fullScroll = String(nav.scrollWidth);
  const full = Number(nav.dataset.fullScroll || nav.scrollWidth);
  const overflow = full > nav.clientWidth + 8;
  const many = spec.filter((t) => !t.brand).length > 5;
  nav.style.flexWrap = '';
  nav.style.overflow = '';
  if (!overflow && !many) {
    if (nested) restoreNav(nav, spec);
    return;
  }
  if (nested) return;
  rewriteNavNests(nav, spec, nests, file);
}

function restoreNav(nav, spec) {
  const on = nav.dataset.hubOn || '';
  nav.innerHTML = spec.map((t) => {
    const cls = [t.brand ? 'hub-brand' : '', t.key === on ? 'on' : '', nav.classList.contains('acc-nav') ? 'acc-tab' : ''].filter(Boolean).join(' ');
    return `<a href="${esc(t.href)}" class="${cls}" data-htab="${esc(t.key)}">${t.html || esc(t.label)}</a>`;
  }).join('');
  nav.dataset.nested = '';
}

function rewriteNavNests(nav, spec, nests, file) {
  const on = nav.dataset.hubOn || (nav.querySelector('a.on')?.dataset.htab) || '';
  const childTo = {};
  nests.forEach((n) => n.children.forEach((c) => { childTo[c] = n; }));
  const seen = new Set();
  const out = [];
  spec.forEach((t) => {
    if (t.brand) { out.push(t); return; }
    const nest = childTo[t.key];
    if (nest) {
      if (seen.has(nest.key)) return;
      seen.add(nest.key);
      const active = nest.key === on || nest.children.includes(on);
      out.push({
        key: nest.key,
        label: nest.label,
        href: nestHref(file, nest.key, spec),
        brand: false,
        on: active,
      });
      return;
    }
    out.push({ ...t, on: t.key === on });
  });
  const acc = nav.classList.contains('acc-nav');
  nav.innerHTML = out.map((t) => {
    const cls = [t.brand ? 'hub-brand' : '', (t.on || t.key === on) ? 'on' : '', acc ? 'acc-tab' : ''].filter(Boolean).join(' ');
    const attr = t.key.startsWith('nest-') ? ' data-nest="1"' : '';
    return `<a href="${esc(t.href)}" class="${cls}" data-htab="${esc(t.key)}"${attr}>${t.brand ? (t.html || esc(t.label)) : esc(t.label)}</a>`;
  }).join('');
  nav.dataset.nested = '1';
  const app = nav.closest('#app') || document.getElementById('app');
  const go = app?.__hubGo;
  if (typeof go === 'function') {
    nav.querySelectorAll('[data-htab]').forEach((a) => {
      a.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const tab = a.dataset.htab;
        try {
          const href = a.getAttribute('href') || '';
          const u = new URL(href, location.origin + location.pathname);
          const next = u.pathname + u.search + u.hash;
          if (next !== location.pathname + location.search + location.hash) {
            history.pushState({ spa: next }, '', next);
            try { sessionStorage.setItem('df_last_path', next); } catch { /* ignore */ }
          }
        } catch { /* ignore */ }
        go(tab);
      };
    });
  }
}

export function paintHubNest(app, { navHtml, nest, tabs, go, file }) {
  const cards = nest.children.map((k) => {
    const t = (tabs || []).find((x) => x.key === k);
    if (!t) return '';
    const href = t.href || ((file || '') + (k ? `?tab=${encodeURIComponent(k)}` : ''));
    return `<a class="nest-card" href="${esc(href)}" data-htab="${esc(k)}">
      <strong>${esc(t.label)}</strong>
      <span>Open this topic</span>
    </a>`;
  }).join('');
  app.innerHTML = `${navHtml}
    <h1 class="hub-h1">${esc(nest.label)}</h1>
    <p class="ult-lead">Related topics in this group. Pick one to continue.</p>
    <div class="nest-grid">${cards}</div>`;
  bindHubTabs(app, go);
}

export function maybePaintNest(app, on, ctx) {
  const list = ctx.nests || nestsFor(ctx.file);
  const nest = list.find((n) => n.key === on);
  if (!nest || !app) return false;
  const navHtml = hubTabs(ctx.brand, ctx.tabs, on, ctx.brandKey, ctx.file);
  paintHubNest(app, { navHtml, nest, tabs: ctx.tabs, go: ctx.go, file: ctx.file });
  return true;
}

function collapseNavIfNeeded(nav) {
  if (!nav || nav.children.length < 2) return;
  if (isPhoneLayout()) return;
  const already = nav.closest('.tab-drop');
  if (already) unwrapTabDrop(already);
  applyDesktopNests(nav);
}

function bindTopicDropButtons(root) {
  const phone = isPhoneLayout();
  (root || document).querySelectorAll('.topic-drop').forEach((d) => {
    d.classList.toggle('is-phone', phone);
    const btn = d.querySelector('.topic-drop-btn');
    if (!btn || btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const open = d.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });
}

export function bindOverflowTabs(root) {
  if (window.__tabDropApplying) return;
  const host = root || document;
  const run = () => {
    window.__tabDropApplying = true;
    try {
      bindTopicDropButtons(host);
      host.querySelectorAll(TAB_BARS).forEach(collapseNavIfNeeded);
    } finally {
      window.__tabDropApplying = false;
    }
  };
  requestAnimationFrame(() => requestAnimationFrame(run));
  if (!window.__tabDropDoc) {
    window.__tabDropDoc = true;
    document.addEventListener('click', (e) => {
      document.querySelectorAll('.topic-drop.open').forEach((d) => {
        if (!d.contains(e.target)) {
          d.classList.remove('open');
          d.querySelector('.topic-drop-btn')?.setAttribute('aria-expanded', 'false');
        }
      });
      document.querySelectorAll('.tab-drop.open').forEach((d) => {
        if (!d.contains(e.target)) {
          d.classList.remove('open');
          d.querySelector('.tab-drop-btn')?.setAttribute('aria-expanded', 'false');
        }
      });
    });
    window.addEventListener('resize', () => {
      clearTimeout(window.__tabDropT);
      window.__tabDropT = setTimeout(() => bindOverflowTabs(document), 160);
    });
  }
}

export function goFile(file, tab) {
  const path = tab ? `${file}?tab=${encodeURIComponent(tab)}` : file;
  history.pushState({ spa: path }, '', path);
}

/** Same-file color-module headings fire df-tab (SPA) not popstate. One listener covers both. */
export function onHubNavigate(paint) {
  if (typeof paint !== 'function' || paint.__hubNavBound) return;
  paint.__hubNavBound = true;
  let queued = 0;
  const run = () => {
    if (queued) return;
    queued = requestAnimationFrame(() => {
      queued = 0;
      try {
        const r = paint();
        if (r && typeof r.then === 'function') r.catch((e) => console.warn('hub nav', e));
      } catch (e) { console.warn('hub nav', e); }
    });
  };
  window.addEventListener('df-tab', run);
  window.addEventListener('popstate', run);
  window.addEventListener('df-scope-change', run);
}

/** Right-pane headings: Summary (module brand) → topics → Reports → Setup. */
export function floorNav(brand, on, brandKey, file) {
  ensureSandboxCss();
  const floor = floorFor(file);
  if (!floor) return hubTabs(brand, [], on, brandKey, file);
  const heading = headingOf(file, on);
  const tabs = floor.tabs || [];
  const hrefFor = (k) => {
    const hit = tabs.find((t) => t.key === k);
    if (hit?.href) return hit.href;
    const f = floor.file || file || '';
    return (!k || k === (floor.brandKey || brandKey)) ? f : `${f}?tab=${encodeURIComponent(k)}`;
  };
  return `<nav class="mod-tabs">${tabs.map((t) =>
    `<a href="${esc(hrefFor(t.key))}" class="${heading === t.key ? 'on' : ''}" data-htab="${esc(t.key)}">${esc(t.label)}</a>`
  ).join('')}</nav>`;
}

function floorCardsHtml(items, hint) {
  return `<div class="kpi-grid">${(items || []).map((it) =>
    `<a class="kpi-card" href="${esc(it.href)}" ${it.key ? `data-htab="${esc(it.key)}"` : ''}>
      <b>${esc(it.label)}</b>
      <span>${esc(hint || 'Open')}</span>
      <strong>Open</strong>
    </a>`).join('')}</div>`;
}

function paintFloorIndex(app, { navHtml, title, lead, items, hint, go, brand, mod }) {
  ensureSandboxCss();
  const color = FLOOR_CHIP[mod] || '#2563eb';
  const chip = brand || title;
  app.innerHTML = `${navHtml}
    <div class="mod-head">
      <div>
        <h2>${esc(title)}</h2>
        <p class="subhead">${esc(lead)}</p>
      </div>
      <span class="mod-chip" style="background:${color}">${esc(chip)}</span>
    </div>
    ${floorCardsHtml(items, hint)}`;
  bindHubTabs(app, go);
}

/** Paint Topics / Talk / Books / Reports / Setup. Returns false so the hub can paint children. */
export function tryPaintFloor(app, rawOn, ctx) {
  const file = ctx.file || ('/' + (location.pathname.split('/').pop() || ''));
  const floor = floorFor(file);
  if (!floor || !app) return false;
  const on = resolveFloorOn(file, rawOn);
  const brand = ctx.brand || floor.brand;
  const go = ctx.go;
  const navHtml = floorNav(brand, on, floor.brandKey, file);
  if (on === 'reports') {
    const book = MODULE_BOOKS[floor.mod] || {};
    const self = (floor.file || file) + '?tab=reports';
    const items = (book.reports || [])
      .filter((r) => {
        const h = String(r.href || '');
        return h && h !== self && h !== (floor.file || file);
      })
      .map((r) => ({ href: r.href, label: r.label }));
    paintFloorIndex(app, {
      navHtml,
      title: 'Reports',
      lead: 'Module reports only. These do not appear under ERP Reports.',
      items,
      hint: 'Open report',
      go,
      brand,
      mod: floor.mod,
    });
    return true;
  }
  if (on === 'setup') {
    const book = MODULE_BOOKS[floor.mod] || {};
    const self = (floor.file || file) + '?tab=setup';
    const items = (book.setup || [])
      .filter((r) => {
        const h = String(r.href || '');
        return h && h !== self;
      })
      .map((r) => ({ href: r.href, label: r.label }));
    paintFloorIndex(app, {
      navHtml,
      title: 'Setup',
      lead: 'Module setup only. This is not System settings.',
      items,
      hint: 'Open setup',
      go,
      brand,
      mod: floor.mod,
    });
    return true;
  }
  const cards = groupCards(floor, on);
  if (cards.length) {
    paintFloorIndex(app, {
      navHtml,
      title: (floor.tabs.find((t) => t.key === on) || {}).label || 'Topics',
      lead: 'Other headings, topics, and tasks for this module.',
      items: cards,
      hint: 'Open this topic',
      go,
      brand,
      mod: floor.mod,
    });
    return true;
  }
  return false;
}


export function innerTabs(items, on) {
  const active = (items || []).find((t) => t.key === on);
  const dropLabel = active?.label || items?.[0]?.label || 'Topics';
  const phone = isPhoneLayout();
  return `<div class="topic-drop${phone ? ' is-phone' : ''}">
    <button type="button" class="topic-drop-btn" aria-haspopup="true" aria-expanded="false"><span>${esc(dropLabel)}</span><span class="topic-drop-caret" aria-hidden="true">▾</span></button>
    <nav class="hub-subtabs">${(items || []).map((t) =>
    `<a href="${esc(t.href)}" class="${on === t.key ? 'on' : ''}" data-pane="${esc(t.key)}" data-htab="${esc(t.key)}">${t.label}</a>`).join('')}</nav>
  </div>`;
}

export function svgIco(name) {
  const common = 'width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  const map = {
    cal: `<svg ${common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>`,
    user: `<svg ${common}><circle cx="12" cy="8" r="3.5"/><path d="M5 19c1.5-3.2 3.7-5 7-5s5.5 1.8 7 5"/></svg>`,
    users: `<svg ${common}><circle cx="9" cy="8" r="3"/><circle cx="16" cy="9" r="2.4"/><path d="M3.5 19c1.2-3 3-4.6 5.5-4.6S13.3 16 14.5 19M15 14.5c2 .2 3.4 1.4 4.5 4.5"/></svg>`,
    conv: `<svg ${common}><path d="M7 7h11M15 4l3 3-3 3M17 17H6M9 14l-3 3 3 3"/></svg>`,
    search: `<svg ${common}><circle cx="11" cy="11" r="6"/><path d="M20 20l-3.5-3.5"/></svg>`,
    sun: `<svg ${common}><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/></svg>`,
    box: `<svg ${common}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/></svg>`,
    up: `<svg ${common}><path d="M12 19V5M6 11l6-6 6 6"/></svg>`,
    cake: `<svg ${common}><path d="M12 8a2 2 0 0 0 0-4 2 2 0 0 0 0 4zM4 13h16v7H4zM4 13c0-2 2-3 4-3s3 2 4 2 2-2 4-2 4 1 4 3"/></svg>`,
    leaf: `<svg ${common}><path d="M5 19c8-1 14-8 14-16-8 0-15 6-16 14 3 0 5-1 7-3"/><path d="M9 15c2-2 5-4 9-5"/></svg>`,
    target: `<svg ${common}><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg>`,
    lock: `<svg ${common}><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`,
    check: `<svg ${common}><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>`,
    doc: `<svg ${common}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>`,
    book: `<svg ${common}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M6 3v16"/></svg>`,
    folder: `<svg ${common}><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`,
    building: `<svg ${common}><path d="M4 21V5a1 1 0 0 1 1-1h6v17M11 21h9V9a1 1 0 0 0-1-1h-8"/><path d="M7 8h2M7 12h2M7 16h2M15 12h2M15 16h2"/></svg>`,
    people: `<svg ${common}><circle cx="9" cy="8" r="3"/><path d="M3 19c.8-3.2 2.8-5 6-5s5.2 1.8 6 5"/><circle cx="17" cy="9" r="2.3"/><path d="M16 14.2c2.2.4 3.7 1.8 4.7 4.8"/></svg>`,
    plane: `<svg ${common} width="14" height="14"><path d="M3 11l16-7-7 16-2-6-6-3z"/></svg>`,
    spark: `<svg ${common}><path d="M12 2l1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6z"/></svg>`,
    clock: `<svg ${common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
    filter: `<svg ${common}><path d="M3 5h18l-7 8v5l-4 2v-7z"/></svg>`,
  };
  return map[name] || '';
}

export function cyanPill(icon, label, value) {
  const ico = svgIco(icon) || icon;
  return `<div class="crm-pill">
    <span class="crm-pill-ico">${ico}</span>
    <div><div class="crm-pill-lab">${label}</div><div class="crm-pill-val">${value}</div></div>
  </div>`;
}

export function orangePill(icon, label, value) {
  const ico = svgIco(icon) || icon;
  return `<div class="crm-pill crm-pill-amber">
    <span class="crm-pill-ico">${ico}</span>
    <div><div class="crm-pill-lab">${label}</div><div class="crm-pill-val">${value}</div></div>
  </div>`;
}

export function emptyRow(cols, text = 'No data') {
  return `<tr data-dummy="1"><td colspan="${cols}" class="ult-muted" style="text-align:center">${text}</td></tr>`;
}

export function crudList(title, cols, rows, { addLabel = '+ Add' } = {}) {
  return `<div class="ult-card">
    <div class="ss-head"><strong>${title}</strong>
      <button type="button" class="ult-btn ult-btn-primary" data-add>${addLabel}</button></div>
    <div class="ult-table-wrap"><table class="ult-table">
      <thead><tr>${cols.map((c) => `<th>${c}</th>`).join('')}<th></th></tr></thead>
      <tbody>${rows.join('') || emptyRow(cols.length + 1)}</tbody>
    </table></div>
  </div>`;
}

export function settingsCard(title, lines) {
  return `<div class="ult-card"><h2 style="margin:0 0 8px;font-size:16px">${title}</h2>
    <p class="ult-muted">${lines}</p>
    <label class="ult-field" style="margin-top:12px"><span>Enable module</span>
      <input type="checkbox" checked /></label>
  </div>`;
}

export function modalHtml(id, title, body, { wide = false } = {}) {
  return `<div class="pay-modal-bg" id="${id}" hidden>
    <div class="pay-modal ${wide ? 'wide' : ''}" role="dialog">
      <div class="pay-modal-h"><h2>${title}</h2><button type="button" class="pay-modal-x" data-close>×</button></div>
      <div class="pay-modal-b">${body}</div>
      <div class="pay-modal-f">
        <button type="button" class="btn-save" data-save>Save</button>
        <button type="button" class="btn-close" data-close>Close</button>
      </div>
    </div>
  </div>`;
}

export function bindModal(root, id) {
  const el = root.querySelector('#' + id);
  if (!el) return el;
  el.querySelectorAll('[data-close]').forEach((b) => { b.onclick = () => { el.hidden = true; }; });
  el.addEventListener('click', (e) => { if (e.target === el) el.hidden = true; });
  return el;
}

export function fld(label, control, { req = false } = {}) {
  return `<div class="ult-field"><label>${label}${req ? ' <span class="req">*</span>' : ''}</label>${control}</div>`;
}

export function fakeEditor(id) {
  return `<div class="tiny-fake" data-ed="${id}">
    <div class="tiny-bar tiny-menu">
      <button type="button" tabindex="-1">File</button>
      <button type="button" tabindex="-1">Edit</button>
      <button type="button" tabindex="-1">View</button>
      <button type="button" tabindex="-1">Insert</button>
      <button type="button" tabindex="-1">Format</button>
      <button type="button" tabindex="-1">Tools</button>
      <button type="button" tabindex="-1">Table</button>
    </div>
    <div class="tiny-bar tiny-tools">
      <button type="button" data-cmd="undo" title="Undo">↩</button>
      <button type="button" data-cmd="redo" title="Redo">↪</button>
      <select data-cmd="block">
        <option value="p">Paragraph</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
      </select>
      <button type="button" data-cmd="bold" title="Bold"><b>B</b></button>
      <button type="button" data-cmd="italic" title="Italic"><i>I</i></button>
      <button type="button" data-cmd="ul" title="List">☰</button>
      <button type="button" data-cmd="link" title="Link">🔗</button>
    </div>
    <textarea id="${id}" rows="7"></textarea>
    <div class="tiny-foot"><span>P</span><span>0 WORDS &nbsp; POWERED BY TINY</span></div>
  </div>`;
}

export function bindFakeEditor(root) {
  (root || document).querySelectorAll('.tiny-fake').forEach((box) => {
    if (box.dataset.bound === '1') return;
    box.dataset.bound = '1';
    const ta = box.querySelector('textarea');
    const foot = box.querySelector('.tiny-foot span:last-child');
    const words = () => {
      const n = (ta?.value || '').trim().split(/\s+/).filter(Boolean).length;
      if (foot) foot.textContent = n + ' WORDS  POWERED BY TINY';
    };
    ta?.addEventListener('input', words);
    words();
    const wrapSel = (before, after) => {
      if (!ta) return;
      const a = ta.selectionStart || 0;
      const z = ta.selectionEnd || 0;
      const v = ta.value;
      ta.value = v.slice(0, a) + before + v.slice(a, z) + after + v.slice(z);
      ta.focus();
      const caret = a + before.length;
      ta.setSelectionRange(caret, caret + (z - a));
      words();
    };
    box.querySelectorAll('[data-cmd]').forEach((el) => {
      const run = (e) => {
        e.preventDefault();
        const cmd = el.dataset.cmd;
        if (cmd === 'bold') wrapSel('<b>', '</b>');
        else if (cmd === 'italic') wrapSel('<i>', '</i>');
        else if (cmd === 'ul') wrapSel('\n- ', '');
        else if (cmd === 'link') {
          const url = prompt('Link URL') || '';
          if (url) wrapSel('<a href="' + url.replace(/"/g, '') + '">', '</a>');
        } else if (cmd === 'block' && el.value === 'h1') wrapSel('<h1>', '</h1>');
        else if (cmd === 'block' && el.value === 'h2') wrapSel('<h2>', '</h2>');
      };
      el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'click', run);
    });
  });
}

export function editorValue(root, id) {
  const el = root?.querySelector('#' + id);
  if (!el) return '';
  if ('value' in el) return el.value;
  return el.innerHTML || el.innerText || '';
}

export function setEditorValue(root, id, html) {
  const el = root?.querySelector('#' + id);
  if (!el) return;
  if ('value' in el) el.value = html || '';
  else el.innerHTML = html || '';
}
