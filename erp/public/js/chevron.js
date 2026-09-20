/**
 * Left-rail chevron + type size. Same keys as the report sandbox:
 * sandbox-chevron-style / size / place / closed / open.
 */
const CHEVRON_STYLES = [
  { id: 'thin', name: 'Minimal thin', note: 'Light line, sharp corners' },
  { id: 'bold', name: 'Bold', note: 'Filled, slightly tapered' },
  { id: 'rounded', name: 'Rounded', note: 'Soft caps, the current look' },
  { id: 'square', name: 'Square', note: 'Solid triangle caret' },
  { id: 'feather', name: 'Ultra-thin', note: 'Hairline, airy' },
  { id: 'heavy', name: 'Heavy', note: 'Chunky filled arrow' },
  { id: 'double', name: 'Double', note: 'Two chevrons, expand/collapse' },
];
const CHEVRON_SIZES = [14, 20, 30, 40, 60, 80, 100, 120];
const CHROME = {
  14: { font: 13, leaf: 12.5, icon: 16, pill: 13, padY: 6, padX: 8, gap: 8, sidebar: 248 },
  20: { font: 15, leaf: 14, icon: 18, pill: 14, padY: 7, padX: 9, gap: 8, sidebar: 270 },
  30: { font: 17, leaf: 15.5, icon: 21, pill: 16, padY: 8, padX: 10, gap: 9, sidebar: 300 },
  40: { font: 20, leaf: 17, icon: 24, pill: 18, padY: 10, padX: 12, gap: 10, sidebar: 340 },
  60: { font: 26, leaf: 22, icon: 32, pill: 22, padY: 12, padX: 14, gap: 12, sidebar: 400 },
  80: { font: 34, leaf: 28, icon: 42, pill: 28, padY: 14, padX: 16, gap: 14, sidebar: 480 },
  100: { font: 42, leaf: 34, icon: 52, pill: 34, padY: 16, padX: 18, gap: 16, sidebar: 540 },
  120: { font: 50, leaf: 40, icon: 62, pill: 40, padY: 18, padX: 20, gap: 18, sidebar: 600 },
};
const CHEV_PATH = {
  thin: { right: 'M9 6l6 6-6 6', down: 'M6 9l6 6 6-6', left: 'M15 6l-6 6 6 6', up: 'M6 15l6-6 6 6' },
  bold: {
    right: 'M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z',
    down: 'M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z',
    left: 'M15.41 16.59 10.83 12l4.58-4.59L14 6l-6 6 6 6z',
    up: 'M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6z',
  },
  rounded: { right: 'M10 6l6 6-6 6', down: 'M6 10l6 6 6-6', left: 'M14 6l-6 6 6 6', up: 'M6 14l6-6 6 6' },
  square: { right: 'M8 4l8 8-8 8z', down: 'M4 8l8 8 8-8z', left: 'M16 4l-8 8 8 8z', up: 'M4 16l8-8 8 10z' },
  feather: { right: 'M9 6l6 6-6 6', down: 'M6 9l6 6 6-6', left: 'M15 6l-6 6 6 6', up: 'M6 15l6-6 6 6' },
  heavy: { right: 'M7 4l10 8-10 8z', down: 'M4 7l8 10 8-10z', left: 'M17 4l-10 8 10 8z', up: 'M4 17l8-10 8 10z' },
  double: {
    right: 'M7 6l5 6-5 6M12 6l5 6-5 6',
    down: 'M6 8l6 6 6-6M6 12l6 6 6-6',
    left: 'M17 6l-5 6 5 6M12 6l-5 6 5 6',
    up: 'M6 16l6-6 6 6M6 12l6-6 6 6',
  },
};
const CHEV_DIRS = ['right', 'down', 'left', 'up'];

function readState() {
  return {
    style: localStorage.getItem('sandbox-chevron-style') || 'rounded',
    size: Number(localStorage.getItem('sandbox-chevron-size') || 14),
    place: localStorage.getItem('sandbox-chevron-place') || 'start',
    closed: localStorage.getItem('sandbox-chevron-closed') || 'right',
    open: localStorage.getItem('sandbox-chevron-open') || 'down',
  };
}

function phoneRail() {
  try {
    return document.documentElement.classList.contains('ult-phone') || window.innerWidth <= 820;
  } catch {
    return false;
  }
}

export function applyChrome() {
  const s = readState();
  const c = CHROME[s.size] || CHROME[14];
  const root = document.documentElement.style;
  root.setProperty('--rail-w', c.sidebar + 'px');
  root.setProperty('--rail-font', c.font + 'px');
  root.setProperty('--rail-leaf', c.leaf + 'px');
  root.setProperty('--rail-pill', c.pill + 'px');
  root.setProperty('--rail-gap', c.gap + 'px');
  root.setProperty('--rail-pady', c.padY + 'px');
  root.setProperty('--rail-padx', c.padX + 'px');
  root.setProperty('--chev-size', s.size + 'px');
  if (!phoneRail()) root.setProperty('--ult-rail', c.sidebar + 'px');
  const side = document.getElementById('ult-side');
  if (side) {
    side.classList.toggle('rail-place-end', s.place === 'end');
    side.classList.toggle('rail-place-start', s.place !== 'end');
    if (!phoneRail()) side.style.width = c.sidebar + 'px';
  }
  const menu = document.getElementById('menu');
  menu?.classList.toggle('rail-place-end', s.place === 'end');
  menu?.classList.toggle('rail-place-start', s.place !== 'end');
}

export function chevronMark(open) {
  const s = readState();
  const dir = open ? s.open : s.closed;
  const id = CHEV_PATH[s.style] ? s.style : 'rounded';
  const d = CHEV_PATH[id][dir] || CHEV_PATH[id].right;
  const fill = id === 'bold' || id === 'square' || id === 'heavy';
  const sw = id === 'feather' ? 1.5 : 2;
  if (fill) {
    return `<span class="chev" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="${d}"/></svg></span>`;
  }
  return `<span class="chev" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg></span>`;
}

function chevronGlyph(dir, px, style) {
  const s = readState();
  const id = CHEV_PATH[style || s.style] ? (style || s.style) : 'rounded';
  const d = CHEV_PATH[id][dir] || CHEV_PATH[id].right;
  const fill = id === 'bold' || id === 'square' || id === 'heavy';
  const sw = id === 'feather' ? 1.5 : Math.max(2, Math.round((px || 40) / 20));
  const size = px || 72;
  if (fill) return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor"><path d="${d}"/></svg>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
}

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;' }[c]));
}

function persist(partial) {
  const s = { ...readState(), ...partial };
  localStorage.setItem('sandbox-chevron-style', s.style);
  localStorage.setItem('sandbox-chevron-size', String(s.size));
  localStorage.setItem('sandbox-chevron-place', s.place);
  localStorage.setItem('sandbox-chevron-closed', s.closed);
  localStorage.setItem('sandbox-chevron-open', s.open);
  applyChrome();
  try { window.dispatchEvent(new CustomEvent('df-chevron', { detail: s })); } catch { /* ignore */ }
}

export function paintChevronSettings(box) {
  if (!box) return;
  const s = readState();
  const chrome = CHROME[s.size] || CHROME[14];
  box.innerHTML = `
    <div class="items-page landing chev-page">
      <section class="items-card chev-hero">
        <p class="kicker">SETTINGS · ICONS</p>
        <h2>Chevron styles</h2>
        <p class="subhead">Tap a size to put it on the left menu. Labels, icons, and arrows all scale together. Tap a family to change the shape.</p>
      </section>
      <section class="items-card">
        <p class="kicker">SIZE · TYPE</p>
        <h3>${s.size === 14 ? 'Compact · 13px type' : s.size + 'px arrow · ' + chrome.font + 'px type'}</h3>
        <p class="subhead">These draw at the real pixel size. Selecting one updates the sidebar — type included.</p>
        <div class="size-row">
          ${CHEVRON_SIZES.map((n) => `<button type="button" class="${s.size === n ? 'on dark' : ''}" data-csize="${n}">${n === 14 ? 'Compact · 13' : n + ' · ' + CHROME[n].font}</button>`).join('')}
        </div>
        <div class="chev-preview">
          <div class="chev-tile light"><div>${chevronGlyph(s.closed, 72)}</div><span>${s.closed.toUpperCase()}</span></div>
          <div class="chev-tile light"><div>${chevronGlyph(s.open, 72)}</div><span>${s.open.toUpperCase()}</span></div>
          <div class="chev-tile navy"><div>${chevronGlyph(s.closed, 72)}</div><span>ON NAVY</span></div>
          <div class="chev-tile navy"><div>${chevronGlyph(s.open, 72)}</div><span>ON NAVY</span></div>
        </div>
        <div class="chev-sizes">
          ${[20, 30, 40, 60, 80, 100, 120].map((n) => `
            <button type="button" class="chev-size-card ${s.size === n ? 'on' : ''}" data-csize="${n}">
              <b>${n}px · ${CHROME[n].font} type</b>
              <span>stroke ${({ 20: 2, 30: 2, 40: 3, 60: 4, 80: 5, 100: 6, 120: 7 })[n]}</span>
              <div class="pair">${chevronGlyph('right', 32)} ${chevronGlyph('down', 32)}</div>
            </button>`).join('')}
        </div>
      </section>
      <section class="items-card">
        <h3>Placement</h3>
        <div class="size-row">
          <button type="button" class="${s.place === 'end' ? 'on' : ''}" data-cplace="end">Option 1 · far right</button>
          <button type="button" class="${s.place === 'start' ? 'on' : ''}" data-cplace="start">Option 2 · beside label</button>
        </div>
        <h3>Points when closed</h3>
        <div class="size-row">${CHEV_DIRS.map((d) => `<button type="button" class="${s.closed === d ? 'on' : ''}" data-cclosed="${d}">${d}</button>`).join('')}</div>
        <h3>Points when open</h3>
        <div class="size-row">${CHEV_DIRS.map((d) => `<button type="button" class="${s.open === d ? 'on' : ''}" data-copen="${d}">${d}</button>`).join('')}</div>
      </section>
      <section class="items-card">
        <h3>Family</h3>
        <div class="fam-row">
          ${CHEVRON_STYLES.map((st) => `<button type="button" class="${s.style === st.id ? 'on' : ''}" data-cstyle="${st.id}">${esc(st.name)}<br><span class="subhead">${esc(st.note)}</span></button>`).join('')}
        </div>
      </section>
    </div>`;
  box.querySelectorAll('[data-csize]').forEach((b) => {
    b.onclick = () => { persist({ size: Number(b.dataset.csize) }); paintChevronSettings(box); };
  });
  box.querySelectorAll('[data-cstyle]').forEach((b) => {
    b.onclick = () => { persist({ style: b.dataset.cstyle }); paintChevronSettings(box); };
  });
  box.querySelectorAll('[data-cplace]').forEach((b) => {
    b.onclick = () => { persist({ place: b.dataset.cplace }); paintChevronSettings(box); };
  });
  box.querySelectorAll('[data-cclosed]').forEach((b) => {
    b.onclick = () => { persist({ closed: b.dataset.cclosed }); paintChevronSettings(box); };
  });
  box.querySelectorAll('[data-copen]').forEach((b) => {
    b.onclick = () => { persist({ open: b.dataset.copen }); paintChevronSettings(box); };
  });
}

applyChrome();
