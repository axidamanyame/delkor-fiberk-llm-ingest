/**
 * Unified shell — supports BOTH APIs used across the project:
 *   await mountShell({ title, active, role, userName }) → { contentEl }
 *   mountUltimateShell({ userLabel })
 *   pageChrome(title, subtitle)
 */
import { supabase } from './supabaseClient.js';

const MENU = [
  { href: '/dashboard.html', label: 'Dashboard', icon: '🏠', key: 'home' },
  { href: '/pos.html', label: 'POS', icon: '🛒', key: 'pos' },
  { href: '/sales-orders.html', label: 'All Sales', icon: '💰', key: 'sales' },
  { href: '/purchase-orders.html', label: 'Purchases', icon: '📦', key: 'purchases' },
  { href: '/products.html', label: 'Products', icon: '📱', key: 'products' },
  { href: '/stock.html', label: 'Stock', icon: '📊', key: 'stock' },
  { href: '/customers.html', label: 'Customers', icon: '👥', key: 'customers' },
  { href: '/suppliers.html', label: 'Suppliers', icon: '🏭', key: 'suppliers' },
  { href: '/accounting.html', label: 'Accounting', icon: '📒', key: 'accounting' },
  { href: '/reports.html', label: 'Reports', icon: '📈', key: 'reports' },
  { href: '/users.html', label: 'Users', icon: '👤', key: 'users' },
  { href: '/roles.html', label: 'Roles', icon: '🔐', key: 'roles' },
  { href: '/commission-agents.html', label: 'Commission', icon: '💼', key: 'commission' },
  { href: '/payroll.html', label: 'Payroll', icon: '👷', key: 'payroll' },
  { href: '/settings.html', label: 'Settings', icon: '⚙️', key: 'settings' },
];

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function pathKey() {
  return (location.pathname.split('/').pop() || 'dashboard.html').replace('.html', '');
}

/**
 * Dark sidebar + content area (dashboard / essentials style).
 */
export async function mountShell(opts = {}) {
  const active = opts.active || 'home';
  const userName = opts.userName || 'User';
  const role = opts.role || 'User';
  const title = opts.title || 'Axidigetek';

  let app = document.getElementById('app');
  if (!app) {
    app = document.createElement('div');
    app.id = 'app';
    app.className = 'app';
    document.body.appendChild(app);
  }

  app.innerHTML = `
    <aside class="sidebar" id="ax-sidebar">
      <div class="sidebar-brand">
        <div class="logo-icon">Ax</div>
        <div>
          <div class="brand-text">Axidigetek</div>
          <div class="brand-sub">ERP System</div>
        </div>
      </div>
      <nav class="sidebar-nav">
        ${MENU.map((m) => `
          <a href="${m.href}" class="${m.key === active ? 'active' : ''}">
            <span class="icon">${m.icon}</span><span>${m.label}</span>
          </a>`).join('')}
      </nav>
      <div class="sidebar-footer">
        <div class="avatar">${(userName[0] || 'U').toUpperCase()}</div>
        <div class="user-info">
          <div class="name">${escapeHtml(userName)}</div>
          <div class="role">${escapeHtml(role)}</div>
        </div>
        <button type="button" class="logout-btn" id="ax-logout" title="Logout">🚪</button>
      </div>
    </aside>
    <main class="main">
      <div class="topbar">
        <div class="page-title">${escapeHtml(title)}</div>
        <div class="actions">
          <span class="date-display">📅 ${new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span>
        </div>
      </div>
      <div id="page-content" class="page-content"></div>
    </main>
  `;

  document.getElementById('ax-logout')?.addEventListener('click', async () => {
    if (!confirm('Logout?')) return;
    await supabase.auth.signOut();
    location.href = '/login.html';
  });

  return { contentEl: document.getElementById('page-content'), app };
}

/**
 * Delkor-Fiberk ERP blue header + dark sidebar injected before <main class="up-main">.
 * Used by products, purchases, accounting, customers, etc.
 */
export function mountUltimateShell(opts = {}) {
  if (document.getElementById('up-shell-root')) return;

  const userLabel = opts.userLabel || 'Admin';
  const key = pathKey();

  const root = document.createElement('div');
  root.id = 'up-shell-root';
  root.innerHTML = `
    <header class="up-header">
      <div class="up-header-left">
        <strong>Axidigetek Group</strong>
        <a class="up-pos-pill" href="/pos.html">▦ POS</a>
      </div>
      <div class="up-header-right">
        <span class="up-date">${new Date().toLocaleDateString('en-GB')}</span>
        <span class="up-user">${escapeHtml(userLabel)}</span>
        <a href="#" id="up-logout">Logout</a>
      </div>
    </header>
    <aside class="up-sidebar">
      <div class="up-side-brand">Axidigetek ERP</div>
      ${MENU.map((m) => {
        const file = m.href.replace('/', '').replace('.html', '');
        const act = key === file || key === m.key ? 'active' : '';
        return `<a class="${act}" href="${m.href}"><span>${m.icon}</span> ${m.label}</a>`;
      }).join('')}
    </aside>
  `;
  document.body.prepend(root);
  document.body.classList.add('up-has-shell');

  document.getElementById('up-logout')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await supabase.auth.signOut();
    location.href = '/login.html';
  });
}

/** Page title block used inside up-main */
export function pageChrome(title, subtitle = '') {
  return `
    <div class="up-chrome">
      <h1>${escapeHtml(title)}</h1>
      ${subtitle ? `<p class="up-chrome-sub">${escapeHtml(subtitle)}</p>` : ''}
    </div>`;
}
