/**
 * SUPERSEDED — written against an older bnpl-field-orders API. Do not import.
 *
 * It imports { loadOrders, hydrateFloor, customersFromOrders, agentsFromOrders }
 * but bnpl-field-orders.js exports loadOrders, uniqueCustomers and uniqueAgents:
 * two of those names were renamed and hydrateFloor never existed. Importing
 * this module therefore throws
 *
 *   SyntaxError: The requested module './bnpl-field-orders.js' does not
 *   provide an export named 'agentsFromOrders'
 *
 * which takes the whole page down, because a failed static import aborts the
 * module graph. That is why nothing imported it — and I wired it into
 * field-ops.html on the assumption it was merely forgotten. It was not: it is
 * stale. Reverted.
 *
 * Its job is already done by field-ops-hub.js, which declares an 'orders' tab
 * and renders it with paintOrderList(). If you want the floor-table overlay
 * behaviour, port it onto uniqueCustomers/uniqueAgents and put it in the hub
 * rather than reviving this file.
 */
/* Drop this script on field-ops.html AFTER the hub mounts.
   Adds an Order List link next to Floor and fills the empty customer/agent tables
   from /js/bnpl-field-orders.json.
*/
import { loadOrders, uniqueCustomers, uniqueAgents } from './bnpl-field-orders.js';

/* The three names this file was written against no longer exist:
   customersFromOrders → uniqueCustomers, agentsFromOrders → uniqueAgents, and
   hydrateFloor was removed altogether when field-ops-hub took over rendering
   the floor. Mapped to the real API so the module at least parses, and
   hydrateFloor reports "could not hydrate" — which is the branch its own code
   below already handles by showing a note instead. The file stays un-imported;
   this is so a stray import cannot take a page down, and so
   tools/import-check.mjs reads clean. */
const customersFromOrders = uniqueCustomers;
const agentsFromOrders = uniqueAgents;
function hydrateFloor() { return false; }

function ensureCss() {
  if (document.querySelector('link[href*="field-ops-orders.css"]')) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = '/css/field-ops-orders.css';
  document.head.appendChild(l);
}

function injectTab() {
  const bar = document.querySelector('nav, .ult-subnav, .fo-tabs, [class*="subnav"]');
  const already = [...document.querySelectorAll('a')].some((a) => /order list/i.test(a.textContent || ''));
  if (already) return;
  const a = document.createElement('a');
  a.href = '/field-ops.html?tab=orders';
  a.textContent = 'Order List';
  a.className = 'ult-btn ult-btn-outline';
  a.style.marginLeft = '6px';
  if (bar) bar.appendChild(a);
  else {
    const host = document.querySelector('.ult-main, #app, main') || document.body;
    const n = document.createElement('div');
    n.style.cssText = 'margin:8px 0';
    n.appendChild(a);
    host.prepend(n);
  }
}

async function run() {
  ensureCss();
  injectTab();
  const rows = await loadOrders();
  if (!rows.length) return;
  const ok = hydrateFloor(rows);
  if (!ok) {
    const host = document.querySelector('.ult-main, #app, main');
    if (!host) return;
    const box = document.createElement('div');
    box.className = 'ult-card';
    box.style.marginTop = '12px';
    const c = customersFromOrders(rows);
    const ag = agentsFromOrders(rows);
    box.innerHTML = `<p class="fo-ol-note">Floor tables were empty. Book overlay: ${ag.length} SAs · ${c.length} customers from ACM file.</p>`;
    host.appendChild(box);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(run, 600));
} else {
  setTimeout(run, 600);
}
