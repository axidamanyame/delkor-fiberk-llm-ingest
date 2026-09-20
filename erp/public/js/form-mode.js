/**
 * Form modes — one place that honours ?view=1, ?print=1 and ?pay=1.
 *
 * The row action menus were right all along. actMenu() emits
 * customer-form.html?id=42&view=1 for View and customer-form.html?id=42 for
 * Edit, and similarly ?pay=1 for Add payment and ?print=1 for Print. The
 * problem was at the other end: each form page implemented those modes itself,
 * so some did and some did not.
 *
 *   expense-form.html            reads view      ignores pay
 *   stock-adjustment-form.html   reads view and print
 *   customer-form.html           reads neither
 *
 * Where a page ignored the parameter, every action opened the same editable
 * form — which is why eight different actions all looked like Edit.
 *
 * This applies the mode for any form page that has not already done it itself,
 * so a page needs no changes to behave correctly. Pages that want to branch
 * further can call formMode() and read the flags.
 */

/**
 * A dedicated view page opened inside the record card is still a whole page —
 * top bar, sidebar, "Go Home", its own h1 — so the card showed the chrome as
 * well as the record. The guard now appends embed=1 and the page drops
 * everything that belongs to the shell.
 */
if (typeof document !== 'undefined') {
  try {
    if (new URLSearchParams(location.search).get('embed') === '1') {
      document.documentElement.dataset.embed = '1';
    }
  } catch { /* ignore */ }
}

export function formMode() {
  let q;
  try { q = new URLSearchParams(location.search); } catch { q = new URLSearchParams(); }
  const on = (k) => q.get(k) === '1' || q.get(k) === 'true';
  return {
    view: on('view'),
    print: on('print'),
    pay: on('pay'),
    id: q.get('id') || '',
    raw: q,
  };
}

const WRITE_CONTROL = [
  '[type="submit"]', 'button[type="submit"]',
  '.save', '.btn-save', '.exp-save', '.update', '.crud-btn', '.purple',
  '.add', '.go', '.submit', '.btn-os', '.btn-another', '.po-print',
  '[data-write]',
].join(', ');

/** Anything a reader still needs: closing, printing, going back. */
const KEEP = [
  '[data-close]', '.po-x', '.close', '.btn-close', '.df-desk-back',
  '[data-print]', '.print', '.ult-theme-btn', '.ult-icon-btn',
  '#ult-nav a', '.ult-side a', '.ult-top a', '.hub-tabs a',
].join(', ');

function bannerHtml() {
  let editHref = location.pathname;
  try {
    const u = new URL(location.href);
    u.searchParams.delete('view');
    u.searchParams.delete('print');
    editHref = u.pathname + (u.search || '');
  } catch { /* ignore */ }
  return `<div class="ult-alert df-view-banner" style="display:flex;gap:12px;align-items:center;justify-content:space-between;padding:10px 14px;border:1px solid;border-radius:10px;margin:0 0 14px">
    <span><strong>Viewing</strong> — this record is read only.</span>
    <a class="ult-btn ult-btn-outline" href="${editHref}" data-full-page>Edit this record</a>
  </div>`;
}

/**
 * @param {Document|Element} root
 * @returns {object} the mode that was applied
 */
export function applyFormMode(root = document) {
  const mode = formMode();
  if (!mode.view && !mode.print) return mode;

  const host = root.querySelector?.('#app') || root.body || root;
  if (!host || host.dataset?.formMode === '1') return mode;
  if (host.dataset) host.dataset.formMode = '1';

  document.body.classList.add('df-view-mode');

  /* Lock every field the form owns, leaving navigation and print alone. */
  host.querySelectorAll('input, select, textarea, button').forEach((el) => {
    if (el.closest(KEEP)) return;
    if (el.matches('[type="hidden"]')) return;
    if (el.tagName === 'BUTTON' || el.matches(WRITE_CONTROL)) {
      /* Hide the write actions rather than showing dead buttons. */
      if (el.matches(WRITE_CONTROL)) { el.style.display = 'none'; return; }
    }
    el.setAttribute('disabled', '');
    el.setAttribute('aria-readonly', 'true');
  });
  host.querySelectorAll(WRITE_CONTROL).forEach((el) => { if (!el.closest(KEEP)) el.style.display = 'none'; });

  /* Say so, and offer the way into edit. */
  if (!host.querySelector('.df-view-banner')) {
    const box = document.createElement('div');
    box.innerHTML = bannerHtml();
    host.insertBefore(box.firstElementChild, host.firstChild);
  }

  if (mode.print) setTimeout(() => { try { window.print(); } catch { /* ignore */ } }, 300);
  return mode;
}

/* Self-mount on form and edit pages, after the page has rendered. Pages that
   already handle the mode themselves are unaffected — disabling twice is
   harmless, and the banner is only added once. */
if (typeof document !== 'undefined') {
  const isFormPage = /-(form|edit)\.html$/.test(location.pathname);
  if (isFormPage) {
    const run = () => { try { applyFormMode(document); } catch { /* ignore */ } };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(run, 600));
    else setTimeout(run, 600);
    /* Forms paint asynchronously; try once more after the data lands. */
    setTimeout(run, 1600);
  }
}
