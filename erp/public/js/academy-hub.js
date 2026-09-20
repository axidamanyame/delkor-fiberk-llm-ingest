/**
 * Academy — staff knowledge under one roof.
 * Manuals, Knowledge Base, Policies — HQ writes these. Nothing is seeded.
 * Technical desk notes stay at /manual.html for HQ only.
 */
import { esc, uid, readLs, writeLs } from './ls-rows.js';
import { hubTabs, bindHubTabs, goFile, svgIco, resolveHubTab, nestsFor, onHubNavigate, floorNav, tryPaintFloor } from './hub-kit.js';
import { bindEssHost, paintKb, loadEssState } from './essentials-hub.js';
import { can, applyDomPermissions } from './rbac.js';

const FILE = '/academy.html';
const TABS = [
  { key: 'home', label: 'Academy' },
  { key: 'manuals', label: 'User Manual' },
  { key: 'kb', label: 'Knowledge Base' },
  { key: 'policies', label: 'Policies' },
];
const BRAND = `${svgIco('book') || '📚'} Academy`;
const POL_KEY = 'df_academy_policies';
const MAN_KEY = 'df_academy_manuals';
const SEED_POL_IDS = new Set(['pol-attendance', 'pol-till', 'pol-data']);

function tab() {
  const raw = new URLSearchParams(location.search).get('tab') || 'home';
  const alias = { manual: 'manuals', 'user-manual': 'manuals', knowledge: 'kb', 'knowledge-base': 'kb', policy: 'policies' };
  return resolveHubTab(alias[raw] || raw, TABS, 'home', nestsFor(FILE));
}
function go(t) {
  goFile(FILE, !t || t === 'home' ? '' : t);
  paint();
}
function nav(on) { return floorNav(BRAND, on, 'home', FILE); }

function bindEss() {
  bindEssHost({ file: FILE, brand: BRAND, tabs: TABS, brandKey: 'home', go, paint });
}

function listPolicies() {
  const rows = readLs(POL_KEY, []);
  const clean = (Array.isArray(rows) ? rows : []).filter((x) => !SEED_POL_IDS.has(String(x?.id || '')));
  if (clean.length !== (rows || []).length) writeLs(POL_KEY, clean);
  return clean;
}

function listManuals() {
  const rows = readLs(MAN_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

function paintHome(app) {
  app.innerHTML = `
    ${nav('home')}
    <div class="ess-card" style="padding:22px 24px">
      <p class="kb-kicker">Academy</p>
      <h1 style="margin:0 0 8px">Academy</h1>
      <p class="ult-muted">User manuals, the knowledge base, and company policies. HQ adds what staff should read.</p>
      <div class="home-kpis" style="margin:18px 0 0;grid-template-columns:repeat(3,minmax(0,1fr))">
        <a class="home-kpi" href="${FILE}?tab=manuals" data-htab="manuals" style="text-decoration:none;color:inherit">
          <div class="ico" style="background:#ede9fe">📘</div>
          <div><div class="lab">User Manual</div><div class="val" style="font-size:16px">Manuals</div></div>
        </a>
        <a class="home-kpi" href="${FILE}?tab=kb" data-htab="kb" style="text-decoration:none;color:inherit">
          <div class="ico" style="background:#dbeafe">💡</div>
          <div><div class="lab">Knowledge Base</div><div class="val" style="font-size:16px">How-to cards</div></div>
        </a>
        <a class="home-kpi" href="${FILE}?tab=policies" data-htab="policies" style="text-decoration:none;color:inherit">
          <div class="ico" style="background:#fef3c7">📜</div>
          <div><div class="lab">Policies</div><div class="val" style="font-size:16px">House rules</div></div>
        </a>
      </div>
    </div>`;
  bindHubTabs(app, go);
}

function paintManuals(app) {
  const rows = listManuals();
  const open = new URLSearchParams(location.search).get('doc') || '';
  app.innerHTML = `
    ${nav('manuals')}
    ${rows.length
      ? rows.map((m) => `
      <details class="man-cat kb-read" style="padding:16px 18px 8px;margin:0 0 10px;background:var(--ult-card);border:1px solid var(--ult-border);border-radius:12px" ${String(m.id) === open ? 'open' : ''}>
        <summary style="cursor:pointer;font-weight:800;font-size:17px">${esc(m.title || 'Manual')}</summary>
        <div style="white-space:pre-wrap;padding:10px 0 8px">${esc(m.body || '')}</div>
      </details>`).join('')
      : '<div class="ess-card"><p class="ess-empty">No user manuals yet.</p></div>'}`;
  bindHubTabs(app, go);
}

function paintPolicies(app) {
  const rows = listPolicies();
  const editing = new URLSearchParams(location.search).get('edit');
  const creating = new URLSearchParams(location.search).get('new') === '1';
  const row = editing ? rows.find((x) => String(x.id) === editing) : null;
  const canEdit = can('academy.edit') || can('academy.add');
  const canDel = can('academy.delete');
  if (creating || row) {
    app.innerHTML = `
      ${nav('policies')}
      <div class="ess-card">
        <div class="ss-head"><strong>${row ? 'Edit policy' : 'Add policy'}</strong></div>
        <div class="ult-field"><label>Title:*</label><input id="pol-title" value="${esc(row?.title || '')}" /></div>
        <div class="ult-field"><label>Body</label><textarea id="pol-body" rows="10">${esc(row?.body || '')}</textarea></div>
        <div class="ess-form-actions ess-form-actions-end">
          <button type="button" class="ess-add" id="pol-save">Save</button>
        </div>
      </div>`;
    bindHubTabs(app, go);
    app.querySelector('#pol-save').onclick = () => {
      const title = app.querySelector('#pol-title').value.trim();
      if (!title) return alert('Title is required');
      const rec = { id: row?.id || uid(), title, body: app.querySelector('#pol-body').value.trim() };
      const next = rows.filter((x) => String(x.id) !== String(rec.id));
      next.unshift(rec);
      writeLs(POL_KEY, next);
      go('policies');
    };
    return;
  }
  app.innerHTML = `
    ${nav('policies')}
    <div class="ess-card">
      <div class="ss-head"><strong>Policies</strong>
        ${canEdit ? '<button type="button" class="ess-add" id="pol-add">+ Add</button>' : ''}</div>
      <div class="ess-kb-grid">
        ${rows.map((k) => `<article class="ess-kb-card">
          <h3>${esc(k.title)}</h3>
          <p>${esc((k.body || '').slice(0, 180))}</p>
          <div style="display:flex;gap:8px">
            <button type="button" data-view="${esc(k.id)}">Read</button>
            ${canEdit ? `<button type="button" data-edit="${esc(k.id)}">Edit</button>` : ''}
            ${canDel ? `<button type="button" data-del="${esc(k.id)}">Delete</button>` : ''}
          </div>
        </article>`).join('') || '<p class="ess-empty">No policies yet.</p>'}
      </div>
    </div>`;
  bindHubTabs(app, go);
  app.querySelector('#pol-add')?.addEventListener('click', () => {
    const u = `${FILE}?tab=policies&new=1`;
    history.pushState({ spa: u }, '', u);
    paint();
  });
  app.querySelectorAll('[data-edit]').forEach((b) => {
    b.onclick = () => {
      const u = `${FILE}?tab=policies&edit=${encodeURIComponent(b.dataset.edit)}`;
      history.pushState({ spa: u }, '', u);
      paint();
    };
  });
  app.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = () => {
      writeLs(POL_KEY, rows.filter((x) => String(x.id) !== b.dataset.del));
      paint();
    };
  });
  app.querySelectorAll('[data-view]').forEach((b) => {
    b.onclick = () => {
      const hit = rows.find((x) => String(x.id) === b.dataset.view);
      if (!hit) return;
      app.innerHTML = `
        ${nav('policies')}
        <div class="ess-card kb-read" style="padding:22px">
          <p class="kb-kicker">Policy</p>
          <h1>${esc(hit.title)}</h1>
          <p style="white-space:pre-wrap">${esc(hit.body)}</p>
          <p><button type="button" class="ult-btn" id="pol-back">Back</button></p>
        </div>`;
      bindHubTabs(app, go);
      app.querySelector('#pol-back').onclick = () => go('policies');
    };
  });
}

function paint() {
  const app = document.getElementById('app');
  if (!app) return;
  const on = tab();
  bindEss();
  if (tryPaintFloor(app, on, { brand: BRAND, file: FILE, go })) return;
  if (on === 'manuals') paintManuals(app);
  else if (on === 'kb') paintKb(app);
  else if (on === 'policies') paintPolicies(app);
  else paintHome(app);
  try { applyDomPermissions(app); } catch { /* rbac */ }
}

export async function bootAcademyHub() {
  onHubNavigate(paint);
  try { await loadEssState(); } catch { /* local kb */ }
  try { paint(); } catch (err) {
    const app = document.getElementById('app');
    if (app) app.innerHTML = `<div class="card" style="padding:24px"><h1>Academy</h1><p>${esc(err?.message || err)}</p></div>`;
  }
}
