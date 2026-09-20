/**
 * Ultimate-style shell with RBAC-filtered menu
 */
import { supabase, loadAccess, can, filterMenu, MENU_WITH_PERMS, applyDomPermissions } from './rbac.js';

export { supabase, loadAccess, can, applyDomPermissions };

export async function mountShellRBAC(opts = {}) {
  const ctx = await loadAccess();
  if (!ctx) return null;

  if (document.getElementById('rbac-root')) return ctx;

  const menu = filterMenu(MENU_WITH_PERMS);

  const root = document.createElement('div');
  root.id = 'rbac-root';
  root.innerHTML = `
    <style>
      #rbac-root .rbac-hdr {
        position: fixed; top: 0; left: 0; right: 0; height: 48px; z-index: 40;
        background: #1e40af; color: #fff; display: flex; align-items: center;
        justify-content: space-between; padding: 0 16px; font-family: Inter, system-ui, sans-serif;
      }
      #rbac-root .rbac-hdr a { color: #e0e7ff; text-decoration: none; font-size: 13px; font-weight: 600; margin-left: 10px; }
      #rbac-root .rbac-side {
        position: fixed; top: 48px; left: 0; bottom: 0; width: 220px; z-index: 30;
        background: #0f172a; color: #e2e8f0; overflow-y: auto; font-family: Inter, system-ui, sans-serif; font-size: 13px;
      }
      #rbac-root .rbac-side a, #rbac-root .rbac-side button {
        display: block; width: 100%; text-align: left; background: none; border: none;
        color: #94a3b8; padding: 9px 16px; cursor: pointer; font: inherit; text-decoration: none;
      }
      #rbac-root .rbac-side a:hover, #rbac-root .rbac-side button:hover { color: #fff; background: rgba(255,255,255,.06); }
      #rbac-root .rbac-side a.active { color: #60a5fa; background: rgba(59,130,246,.15); }
      #rbac-root .rbac-side .grp { color: #64748b; font-size: 11px; text-transform: uppercase; padding: 12px 16px 4px; letter-spacing: .04em; }
      #rbac-root .rbac-side .sub { display: none; background: rgba(0,0,0,.2); }
      #rbac-root .rbac-side .open > .sub { display: block; }
      #rbac-root .rbac-side .sub a { padding-left: 28px; font-size: 12px; }
      body.rbac-on { margin: 0; padding-top: 48px; padding-left: 220px; }
      @media (max-width: 768px) {
        #rbac-root .rbac-side { width: 64px; }
        #rbac-root .rbac-side .label, #rbac-root .rbac-side .grp { display: none; }
        body.rbac-on { padding-left: 64px; }
      }
    </style>
    <header class="rbac-hdr">
      <div><strong>Axidigetek Group</strong>
        ${can('sell.add') ? '<a href="/pos.html">▦ POS</a>' : ''}
      </div>
      <div>
        <span style="font-size:12px;opacity:.9">${ctx.fullName} · ${ctx.jobLabel || ctx.designation || ctx.roleName}</span>
        <a href="#" id="rbac-logout">Logout</a>
      </div>
    </header>
    <aside class="rbac-side" id="rbac-nav"></aside>
  `;
  document.body.prepend(root);
  document.body.classList.add('rbac-on');

  const nav = document.getElementById('rbac-nav');
  const path = (location.pathname.split('/').pop() || '').toLowerCase();

  nav.innerHTML = menu.map((item, idx) => {
    if (item.children?.length) {
      const open = item.children.some(c => (c.href || '').includes(path));
      return `
        <div class="${open ? 'open' : ''}" data-g="${idx}">
          <button type="button" data-toggle="${idx}">${item.icon || ''} <span class="label">${item.label}</span></button>
          <div class="sub">
            ${item.children.map(c => {
              const file = (c.href || '').split('/').pop().split('#')[0];
              const act = file === path ? 'active' : '';
              return `<a class="${act}" href="${c.href}">${c.label}</a>`;
            }).join('')}
          </div>
        </div>`;
    }
    const file = (item.href || '').split('/').pop();
    return `<a class="${file === path ? 'active' : ''}" href="${item.href}">${item.icon || ''} <span class="label">${item.label}</span></a>`;
  }).join('');

  nav.addEventListener('click', (e) => {
    const t = e.target.closest('[data-toggle]');
    if (!t) return;
    t.parentElement.classList.toggle('open');
  });

  document.getElementById('rbac-logout').onclick = async (e) => {
    e.preventDefault();
    await supabase.auth.signOut();
    location.href = '/login.html';
  };

  applyDomPermissions(document);
  return ctx;
}
