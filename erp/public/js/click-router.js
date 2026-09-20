/**
 * One delegated click router for the whole ERP.
 *
 * Before this, fourteen separate `document` click listeners ran on every page —
 * five in the shell plus link-guard, pos-gate, delete-guard, table-rules,
 * tab-loader, desk-chrome, hub-kit, home-tables and accounting. Most attached in
 * the capture phase, several called preventDefault(), and their selectors
 * overlapped heavily: `a, button`, `a[href]`, `table a[href]` and
 * `a[href*="view=1"]` all claim the same Edit link inside a table. Which one won
 * depended on module import order, so a click could be answered by a handler
 * that had nothing to do with what the user pressed.
 *
 * Now there is one listener. Guards register a priority, a matcher and a claim,
 * and the router evaluates them in a declared order.
 *
 *   registerClickGuard({
 *     name: 'till-exit',
 *     priority: PRIORITY.lock,
 *     match: (origin, e) => origin?.closest('a[href]'),
 *     claim: (el, e) => { …; return 'claim'; },
 *   });
 *
 * claim() returns:
 *   'claim'    — this guard owns the click. The router cancels the default and
 *                stops other guards. Nothing downstream sees it.
 *   'observe'  — the guard acted but does not own the click (audit logging,
 *                href normalising). Evaluation continues, default untouched.
 *   'pass' | false | undefined — not mine, keep looking.
 *
 * Set window.__dfClickTrace = true in the console to see which guard answers
 * each click, and which ones looked and passed.
 */

export const PRIORITY = {
  observe: 200,   // audit trail — must see every click, claims nothing
  normalise: 150, // correct a destination before anyone routes on it
  lock: 100,      // workspace / till locks that must pre-empt everything
  exit: 90,       // leaving a guarded session
  tab: 80,        // in-page tab navigation
  record: 70,     // open a record in a modal instead of navigating
  table: 60,      // in-table link behaviour
  page: 10,       // last resort before the browser's own default
};

const guards = [];
let installed = false;

function trace(...args) {
  if (typeof window !== 'undefined' && window.__dfClickTrace) console.info('[click-router]', ...args);
}

export function registerClickGuard(guard) {
  if (!guard || typeof guard.match !== 'function' || typeof guard.claim !== 'function') return;
  if (guards.some((g) => g.name === guard.name)) return;
  guards.push({ priority: PRIORITY.page, ...guard });
  guards.sort((a, b) => b.priority - a.priority);
  install();
}

export function listClickGuards() {
  return guards.map((g) => ({ name: g.name, priority: g.priority }));
}

function install() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented) return;
    /* Let the browser handle modified clicks and middle clicks — open in a new
       tab must keep working. */
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const origin = e.target?.closest?.('a[href], button, summary, [data-act], [data-htab], tr[data-id]') || e.target;
    if (!origin) return;
    /* Table chrome has its own handlers. Do not swallow those clicks.
       Action flyout *items* (View, Edit) must still reach the record-view
       guard — only the opener chip is skipped.
       Anchors in the toolbar (+ ADD, Review) are real navigation and MUST
       reach spa-nav. Skipping every .erp-chip was reloading the window. */
    if (origin.closest?.('[data-exp], .col-vis-menu, [data-tbl-size], .erp-top-bar button, .erp-top-bar select, .erp-top-bar input, .erp-dd, .biz-set-nav')) return;
    const chip = origin.closest?.('.erp-chip');
    if (chip && String(chip.tagName || '').toLowerCase() !== 'a') return;
    if (origin.closest?.('.act-btn') && !origin.closest?.('.act-flyout, menu.act-portal, .act-menu, menu')) return;

    for (const g of guards) {
      let el = null;
      try { el = g.match(origin, e); } catch (err) { trace('match threw in', g.name, err); continue; }
      if (!el) continue;
      let outcome;
      try { outcome = g.claim(el, e); } catch (err) { console.warn('[click-router] ' + g.name + ' failed', err); continue; }
      if (outcome === 'observe') { trace(g.name, 'observed', el); continue; }
      if (!outcome || outcome === 'pass') { trace(g.name, 'passed', el); continue; }
      trace(g.name, 'CLAIMED', el);
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    trace('no guard claimed', origin);
  }, true);
}
