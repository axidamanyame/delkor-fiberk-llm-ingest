/** Delkor-Fiberk lockup + till subsidiary colours for digital receipts. */

export const LOGO_PATH = '/brand/delkor-fiberk-letterhead.png';

export const BRAND = {
  name: 'Delkor-Fiberk',
  email: 'social.delkorfiberk@gmail.com',
  phone: '054 644 3323',
  city: 'Accra',
};

/** Same D-mark as the login header (teal bowl + indigo bar). */
export const MARK_SVG = `<svg class="rc-mark" viewBox="0 0 64 64" aria-hidden="true">
  <path fill="#2dd4bf" d="M10 8h24c13.5 0 24 9.2 24 24S47.5 56 34 56H10V8z"/>
  <path fill="#fff" d="M22 18h12.5c7.5 0 13 5.4 13 14s-5.5 14-13 14H22V18z"/>
  <path fill="#818cf8" d="M10 28h42v8H10z"/>
</svg>`;

export function lockupHtml() {
  return `<div class="rc-lockup">
    ${MARK_SVG}
    <div class="rc-word">
      <strong><span class="rc-delkor">DELKOR</span><span class="rc-hyphen">-</span><span class="rc-fiberk">FIBERK</span></strong>
      <small>Axidigetek · BuyNowPaysLater · Delkor Logistics · Fiberk</small>
    </div>
  </div>`;
}

/** Colours match the organogram cards on the welcome screen. */
export const SUB_THEMES = {
  group: {
    code: 'group', label: 'Delkor-Fiberk', tag: 'Group',
    head: '#1e3a8a', head2: '#0d9488', ink: '#ffffff',
    accent: '#1e3a8a', table: '#1e3a8a', page: '#eff6ff',
    payBg: '#ecfdf5', payInk: '#0f766e',
  },
  fiberk: {
    code: 'fiberk', label: 'Fiberk', tag: 'Electronics',
    head: '#0052ff', head2: '#0040cc', ink: '#ffffff',
    accent: '#0052ff', table: '#0052ff', page: '#eff6ff',
    payBg: '#dbeafe', payInk: '#1e3a8a',
  },
  axidigetek: {
    code: 'axidigetek', label: 'Axidigetek', tag: 'eCommerce',
    head: '#ea580c', head2: '#c2410c', ink: '#ffffff',
    accent: '#ea580c', table: '#ea580c', page: '#fff7ed',
    payBg: '#ffedd5', payInk: '#c2410c',
  },
  delkor: {
    code: 'delkor', label: 'Delkor Logistics', tag: 'Logistics',
    head: '#2b9fd6', head2: '#4dca7e', ink: '#ffffff',
    accent: '#0f766e', table: '#0f766e', page: '#ecfdf5',
    payBg: '#dcfce7', payInk: '#166534',
  },
  bnpl: {
    code: 'bnpl', label: 'BuyNowPaysLater', tag: 'Hire Purchase',
    head: '#7c3aed', head2: '#ea580c', ink: '#ffffff',
    accent: '#f97316', table: '#6d28d9', page: '#fff7ed',
    payBg: '#ffedd5', payInk: '#c2410c',
  },
};

export function themeFor(code) {
  const c = String(code || '').toLowerCase();
  if (SUB_THEMES[c]) return SUB_THEMES[c];
  if (/fib|electronics/.test(c)) return SUB_THEMES.fiberk;
  if (/axi/.test(c)) return SUB_THEMES.axidigetek;
  if (/delkor|logist|furn/.test(c)) return SUB_THEMES.delkor;
  if (/bnpl|hire|field/.test(c)) return SUB_THEMES.bnpl;
  return SUB_THEMES.group;
}

export function themeStyle(t) {
  return [
    `--rc-head:${t.head}`,
    `--rc-head2:${t.head2}`,
    `--rc-on:${t.ink}`,
    `--rc-accent:${t.accent}`,
    `--rc-table:${t.table}`,
    `--rc-page:${t.page}`,
    `--rc-pay-bg:${t.payBg}`,
    `--rc-pay-ink:${t.payInk}`,
  ].join(';');
}

export function logoSrc() {
  try {
    if (typeof location !== 'undefined' && location.origin && !/grok\.me$/.test(location.host)) {
      return location.origin + LOGO_PATH;
    }
  } catch { /* ignore */ }
  return LOGO_PATH;
}
