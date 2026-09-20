/**
 * Custom Dashboards color-coded module — right-pane headings, no left submenu.
 */
import { supabase, getActiveSubsidiary } from './supabaseClient.js';
import { mountUltimateShell } from './ultimate-shell.js';
import { bindTable } from './home-tables.js';
import { confirmAction, toast } from './confirm-action.js';
import { SCOPE_EVENT, scopeCaption, filterBySidebar } from './scope.js';
import { getAccess } from './rbac.js';
import { hubTabs, bindHubTabs, goFile, svgIco, bounceModuleSettings, onHubNavigate, floorNav, tryPaintFloor } from './hub-kit.js';
import {
  DASH_GROUPS, DASH_TEMPLATES, AI_EXAMPLES, DEMO_ROLES, WIDGETS, RANGES, SIZES,
  widgetMeta, esc, fetchBoards, deleteBoard, cloneBoard, setDraft, takeDraft,
  aiSuggest, hydrateAccess, persistAccess, loadAccessSettings, saveBoard,
  locationOptions, loadFacts, renderWidget,
} from './dashboards.js';

const FILE = '/custom-dashboards.html';
const TABS = [
  { key: 'list', label: 'Manage' },
  { key: 'create', label: 'Create' },
];
const BRAND = `${svgIco('spark') || '📊'} Custom Dashboards`;

function tabFromUrl(forced) {
  if (forced === 'setting' || forced === 'settings') { bounceModuleSettings(); return 'list'; }
  if (forced === 'create' || forced === 'list' || forced === 'view') return forced;
  const file = (location.pathname.split('/').pop() || '').toLowerCase();
  const params = new URLSearchParams(location.search);
  if (file.includes('setting') || params.get('tab') === 'settings' || params.get('tab') === 'setting') {
    bounceModuleSettings();
    return 'list';
  }
  if (file.includes('edit')) return 'create';
  if (file.includes('view')) return 'view';
  const t = params.get('tab') || '';
  if (t === 'create' || t === 'edit') return 'create';
  if (t === 'view') return 'view';
  return 'list';
}

export async function bootCustomDashboards(forcedTab) {
  const session = await mountUltimateShell();
  if (!session) throw new Error('auth');
  const app = document.getElementById('app');
  let tab = tabFromUrl(forcedTab);
  let rows = [];
  let roles = [];
  let profiles = [];
  let access = loadAccessSettings();
  let schemaHint = '';
  let board = { name: '', auto_refresh_min: 0, widgets: [] };
  let facts = null;
  let addOpen = false;
  let editingIdx = -1;
  let refreshTimer = 0;

  function nav(on) {
    const hi = on === 'view' ? 'list' : on;
    return floorNav(BRAND, hi, 'list', FILE);
  }
  function bindNav() {
    bindHubTabs(app, (k) => goTab(k || 'list'));
  }
  function goTab(next, extra = {}) {
    tab = next;
    const u = new URL(FILE, location.origin);
    if (next && next !== 'list') u.searchParams.set('tab', next === 'create' && extra.id ? 'create' : next);
    if (extra.id) u.searchParams.set('id', extra.id);
    const path = u.pathname + u.search;
    history.pushState({ spa: path }, '', path);
    paint();
  }

  function fmtWhen(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso).slice(0, 16).replace('T', ' ');
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function creatorName(d) {
    if (d.created_by_name) return d.created_by_name;
    const p = profiles.find((x) => x.id === d.created_by);
    if (p) return p.full_name || p.email || '';
    if (d.created_by === session.user.id) return session.user.email || 'You';
    return d.created_by ? String(d.created_by).slice(0, 8) : '—';
  }

  function paint() {
    clearInterval(refreshTimer);
    if (tryPaintFloor(app, tab, { brand: BRAND, file: FILE, go: goTab })) {
      bindNav();
      return;
    }
    if (tab === 'create') paintCreate();
    else if (tab === 'view') paintView();
    else paintList();
    bindNav();
  }

  function paintList() {
    const mine = filterBySidebar(rows.filter((r) => !r.is_template));
    app.innerHTML = `
      ${nav('list')}
      <div class="card" data-tbl="cd">
        <div class="head">
          <h2>Manage</h2>
          <div class="btns">
            <button type="button" class="btn btn-ai" id="btn-ai">✦ Use AI</button>
            <button type="button" class="btn btn-tpl" id="btn-gal">▦ Use a template</button>
            <button type="button" class="btn btn-add" id="btn-add">+ Create Dashboard</button>
          </div>
        </div>
        ${schemaHint ? `<p style="color:#991b1b;font-size:13px">${esc(schemaHint)}</p>` : ''}
        <p style="margin:0 0 10px;font-size:13px;color:#111">${esc(scopeCaption())}</p>
        <div class="bar">
          <label>Show <select data-tbl-size><option selected>25</option><option>50</option><option>100</option><option>All</option></select> entries</label>
          <div class="grow"></div>
          <button type="button" data-exp="csv">Export CSV</button>
          <button type="button" data-exp="xls">Export Excel</button>
          <button type="button" data-exp="print">Print</button>
          <button type="button" data-exp="cols">Column visibility</button>
          <button type="button" data-exp="pdf">Export PDF</button>
          <input data-tbl-search placeholder="Search …" />
        </div>
        <div class="ult-table-wrap"><table class="ult-table">
          <thead><tr>
            <th>Dashboard Name</th>
            <th>Created By</th>
            <th>Created At</th>
            <th>Action</th>
          </tr></thead>
          <tbody>${mine.map((d) => `<tr data-id="${esc(d.id)}">
            <td>${esc(d.name)}</td>
            <td>${esc(creatorName(d))}</td>
            <td>${esc(fmtWhen(d.created_at))}</td>
            <td>
              <details class="act">
                <summary>Actions</summary>
                <menu>
                  <button type="button" data-view="${esc(d.id)}">View</button>
                  <button type="button" data-ed="${esc(d.id)}">Edit</button>
                  <button type="button" data-clone="${esc(d.id)}">Clone</button>
                  <button type="button" data-del="${esc(d.id)}">Delete</button>
                </menu>
              </details>
            </td>
          </tr>`).join('') || '<tr data-dummy="1"><td colspan="4" style="text-align:center">No data available in table</td></tr>'}
          </tbody>
        </table></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
          <div data-tbl-info></div>
          <div class="pager" data-tbl-pager></div>
        </div>
      </div>`;
    bindTable(app.querySelector('[data-tbl="cd"]'), { title: 'Custom Dashboards', storageKey: 'custom-dash' });
    document.getElementById('btn-ai').onclick = openAi;
    document.getElementById('btn-gal').onclick = () => openGallery();
    document.getElementById('btn-add').onclick = () => {
      board = { name: '', auto_refresh_min: 0, widgets: [] };
      goTab('create');
    };
    app.querySelectorAll('[data-view]').forEach((b) => {
      b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); goTab('view', { id: b.dataset.view }); };
    });
    app.querySelectorAll('[data-ed]').forEach((b) => {
      b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); openEdit(b.dataset.ed); };
    });
    app.querySelectorAll('[data-clone]').forEach((b) => {
      b.onclick = async (e) => {
        e.preventDefault(); e.stopPropagation();
        const src = rows.find((r) => String(r.id) === String(b.dataset.clone));
        if (!src) return;
        if (!(await confirmAction('Clone dashboard?', 'This will create a copy of the dashboard with all its widgets. You can then edit the copy without affecting the original.'))) return;
        const { row, error } = await cloneBoard(src, session);
        if (error) toast(error, 'error');
        else toast('Dashboard copied');
        setDraft({ id: row.id, name: row.name, widgets: row.widgets, auto_refresh_min: row.auto_refresh_min });
        openEdit(row.id, true);
      };
    });
    app.querySelectorAll('[data-del]').forEach((b) => {
      b.onclick = async (e) => {
        e.preventDefault(); e.stopPropagation();
        if (!(await confirmAction('Delete dashboard?', 'Once deleted, you will not be able to recover this dashboard.'))) return;
        await deleteBoard(b.dataset.del);
        toast('Deleted');
        await reload();
      };
    });
  }

  function dashOptions(selected) {
    const boards = rows.filter((r) => !r.is_template);
    const sel = new Set(Array.isArray(selected) ? selected.map(String) : selected ? [String(selected)] : []);
    return boards.map((d) => `<option value="${esc(d.id)}" ${sel.has(String(d.id)) ? 'selected' : ''}>${esc(d.name)}</option>`).join('');
  }

  function selectedNames(ids) {
    const set = new Set((ids || []).map(String));
    const names = rows.filter((r) => set.has(String(r.id))).map((r) => r.name);
    return names.length ? names.join(', ') : 'None assigned';
  }

  function paintSetting() {
    const groupRows = DASH_GROUPS.map((g) => {
      const rec = access.groups?.[g.id] || { dashboards: [], default: '' };
      return `<tr>
        <td><b>${esc(g.label)}</b> <span class="role-pill">${esc(g.id)}</span></td>
        <td>${g.id === 'hq'
          ? `<span class="lock">🔒 All dashboards (admin)</span>`
          : `<select multiple size="4" class="cd-dashboards-select" data-kind="group" data-id="${g.id}">${dashOptions(rec.dashboards)}</select>
             <div class="cd-picked">${esc(selectedNames(rec.dashboards))}</div>`}</td>
        <td><select class="cd-default-select" data-kind="group" data-id="${g.id}">
          <option value="">None</option>${dashOptions(rec.default)}
        </select></td>
      </tr>`;
    }).join('');
    const roleRows = (roles || []).map((r) => {
      const key = String(r.name || '').toLowerCase();
      const rec = access.roles?.[key] || { dashboards: [], default: '' };
      const locked = /admin|owner|hq admin|super admin/i.test(r.name || '');
      return `<tr>
        <td>${esc(r.name)}${locked ? ' <span class="role-pill">Admin</span>' : ''}</td>
        <td>${locked
          ? `<span class="lock">🔒 All dashboards (admin)</span>`
          : `<select multiple size="4" class="cd-dashboards-select" data-kind="role" data-id="${esc(key)}">${dashOptions(rec.dashboards)}</select>
             <div class="cd-picked">${esc(selectedNames(rec.dashboards))}</div>`}</td>
        <td><select class="cd-default-select" data-kind="role" data-id="${esc(key)}">
          <option value="">None</option>${dashOptions(rec.default)}
        </select></td>
      </tr>`;
    }).join('');
    app.innerHTML = `
      ${nav('setting')}
      <div class="card set">
        <h3>Dashboard Access Settings</h3>
        <p class="lead">For each dashboard group (above roles) and each role, choose which dashboards it can access and set a default dashboard. Users land on that default after login. HQ admin always sees every dashboard.</p>
        ${schemaHint ? `<p style="color:#991b1b;font-size:13px">${esc(schemaHint)}</p>` : ''}
        <div class="ult-table-wrap"><table class="ult-table">
          <thead><tr><th>Role / group</th><th>Dashboards</th><th>Default dashboard for role</th></tr></thead>
          <tbody>
            ${groupRows}
            ${roleRows}
          </tbody>
        </table></div>
        <div class="foot-save"><button type="button" class="btn btn-save" id="save-all">💾 Save all</button></div>
      </div>`;
    app.querySelectorAll('.cd-dashboards-select').forEach((sel) => {
      const hint = sel.parentElement.querySelector('.cd-picked');
      const sync = () => {
        const ids = [...sel.options].filter((o) => o.selected).map((o) => o.value);
        if (hint) hint.textContent = selectedNames(ids);
      };
      sel.addEventListener('change', sync);
    });
    app.querySelectorAll('.cd-default-select').forEach((sel) => {
      sel.addEventListener('change', () => {
        if (!sel.value) return;
        const multi = sel.closest('tr').querySelector('.cd-dashboards-select');
        if (!multi) return;
        [...multi.options].forEach((o) => { if (o.value === sel.value) o.selected = true; });
        multi.dispatchEvent(new Event('change'));
      });
    });
    document.getElementById('save-all').onclick = async () => {
      if (!(await confirmAction('Save access settings?', 'Each group and role will land on its default dashboard after login.'))) return;
      const next = { groups: { ...(access.groups || {}) }, roles: { ...(access.roles || {}) } };
      app.querySelectorAll('.cd-dashboards-select').forEach((sel) => {
        const ids = [...sel.options].filter((o) => o.selected).map((o) => o.value);
        const bucket = sel.dataset.kind === 'group' ? next.groups : next.roles;
        bucket[sel.dataset.id] = { ...(bucket[sel.dataset.id] || {}), dashboards: ids, default: bucket[sel.dataset.id]?.default || '' };
      });
      app.querySelectorAll('.cd-default-select').forEach((sel) => {
        const bucket = sel.dataset.kind === 'group' ? next.groups : next.roles;
        bucket[sel.dataset.id] = { ...(bucket[sel.dataset.id] || { dashboards: [] }), default: sel.value };
        if (sel.value) {
          const ids = new Set(bucket[sel.dataset.id].dashboards || []);
          ids.add(sel.value);
          bucket[sel.dataset.id].dashboards = [...ids];
        }
      });
      access = next;
      await persistAccess(next);
      toast('Access settings saved');
    };
  }

  function openEdit(id, fromDraft = false) {
    const found = rows.find((r) => String(r.id) === String(id));
    if (found && !fromDraft) board = { ...found, widgets: [...(found.widgets || [])] };
    goTab('create', { id });
  }

  function widgetCard(w, i) {
    const inner = facts ? renderWidget(w, facts) : `<article class="wcard"><header><h3>${esc(w.heading || w.type)}</h3></header></article>`;
    return `<div style="flex:1 1 ${Number(w.size || 50)}%;min-width:${Number(w.size || 50) >= 75 ? '100%' : '240px'}">
      <div style="position:relative">
        <div class="wtools" style="position:absolute;right:10px;top:8px;z-index:2">
          <button type="button" data-up="${i}" title="Move up">↑</button>
          <button type="button" data-dn="${i}" title="Move down">↓</button>
          <button type="button" data-edw="${i}" title="Edit">✎</button>
          <button type="button" data-rm="${i}" title="Remove">×</button>
        </div>
        ${inner}
      </div>
    </div>`;
  }

  function paintCreate() {
    const n = (board.widgets || []).length;
    app.innerHTML = `
      ${nav('create')}
      <div class="name-bar">
        <input id="dash-name" placeholder="Dashboard Name" value="${esc(board.name || '')}" />
        <label class="muted">⟳ Auto-refresh
          <select id="dash-ref">
            ${[0, 5, 10, 30, 60].map((m) => `<option value="${m}" ${Number(board.auto_refresh_min) === m ? 'selected' : ''}>${m ? 'Every ' + m + ' min' : 'Off'}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="preview-card">
        <div class="preview-head">
          <h2><span style="color:#6366f4">▌</span> Dashboard Preview <span class="count">${n}</span></h2>
          <div class="spacer"></div>
          <button type="button" class="btn btn-add" id="add-w">+ Add Widget</button>
          <button type="button" class="btn btn-save" id="save">✓ Save</button>
        </div>
        <div class="dot-board" id="board">
          ${n ? board.widgets.map((w, i) => widgetCard(w, i)).join('') : `
            <div class="empty">
              <div class="ico">▦</div>
              <div>Your dashboard is empty. Click the add widget button to add your first widget.</div>
            </div>`}
        </div>
      </div>`;
    document.getElementById('dash-name').oninput = (e) => { board.name = e.target.value; };
    document.getElementById('dash-ref').onchange = (e) => { board.auto_refresh_min = Number(e.target.value) || 0; };
    document.getElementById('add-w').onclick = () => openAdd(-1);
    document.getElementById('save').onclick = onSave;
    app.querySelectorAll('[data-rm]').forEach((b) => {
      b.onclick = async () => {
        if (!(await confirmAction('Delete selected widget', 'Are you sure you want to delete selected widget'))) return;
        board.widgets.splice(Number(b.dataset.rm), 1);
        paintCreate();
        bindNav();
      };
    });
    app.querySelectorAll('[data-edw]').forEach((b) => { b.onclick = () => openAdd(Number(b.dataset.edw)); });
    app.querySelectorAll('[data-up]').forEach((b) => {
      b.onclick = () => {
        const i = Number(b.dataset.up); if (i <= 0) return;
        const t = board.widgets[i - 1]; board.widgets[i - 1] = board.widgets[i]; board.widgets[i] = t;
        paintCreate(); bindNav();
      };
    });
    app.querySelectorAll('[data-dn]').forEach((b) => {
      b.onclick = () => {
        const i = Number(b.dataset.dn); if (i >= board.widgets.length - 1) return;
        const t = board.widgets[i + 1]; board.widgets[i + 1] = board.widgets[i]; board.widgets[i] = t;
        paintCreate(); bindNav();
      };
    });
    if (addOpen) openAdd(editingIdx);
  }

  function openAdd(idx) {
    editingIdx = idx;
    addOpen = true;
    const cur = idx >= 0 ? board.widgets[idx] : { type: WIDGETS[0].id, heading: '', size: 25, range: '', location: '', html_text: '' };
    document.getElementById('aw-modal')?.remove();
    const wrap = document.createElement('div');
    wrap.id = 'aw-modal';
    wrap.className = 'modal-bg';
    wrap.innerHTML = `<div class="modal">
      <h3>${idx >= 0 ? 'Edit Widget' : 'Add Widget'} <button type="button" data-x style="border:0;background:transparent;font-size:20px;cursor:pointer">×</button></h3>
      <div class="body">
        <label class="field">Widget:*
          <select id="aw-type">${WIDGETS.map((t) => `<option value="${t.id}" ${t.id === cur.type ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}</select>
        </label>
        <label class="field">Heading:*
          <input id="aw-h" placeholder="Heading" value="${esc(cur.heading || '')}" />
        </label>
        <label class="field">Size %:*
          <select id="aw-s">${SIZES.map((s) => `<option value="${s}" ${Number(cur.size || 25) === s ? 'selected' : ''}>${s}%</option>`).join('')}</select>
        </label>
        <div id="aw-extra"></div>
      </div>
      <div class="foot">
        <button type="button" class="btn ghost" data-x>Close</button>
        <button type="button" class="btn btn-add" id="aw-go">${idx >= 0 ? 'Update' : '+ Add'}</button>
      </div>
    </div>`;
    document.body.appendChild(wrap);
    const extra = () => {
      const meta = widgetMeta(document.getElementById('aw-type').value);
      const h = document.getElementById('aw-h');
      if (!h.value.trim()) h.placeholder = meta.label;
      let html = '';
      if (meta.range) html += `<label class="field">Filter Date Range:<select id="aw-r"><option value="">None</option>${RANGES.map(([k, l]) => `<option value="${k}" ${cur.range === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
      if (meta.location) html += `<label class="field">Filter Location:<select id="aw-l">${locationOptions(cur.location)}</select></label>`;
      if (meta.html) html += `<label class="field">HTML / note:<textarea id="aw-html" rows="4">${esc(cur.html_text || '')}</textarea></label>`;
      html += `<label class="field">Show data:<select id="aw-own">
        <option value="show_all_data" ${cur.show_data !== 'show_own_data' ? 'selected' : ''}>All data in current subsidiary / location</option>
        <option value="show_own_data" ${cur.show_data === 'show_own_data' ? 'selected' : ''}>Only the signed-in user's data</option>
      </select></label>`;
      document.getElementById('aw-extra').innerHTML = html;
    };
    extra();
    wrap.querySelector('#aw-type').onchange = extra;
    wrap.querySelectorAll('[data-x]').forEach((b) => { b.onclick = () => { addOpen = false; wrap.remove(); }; });
    wrap.addEventListener('click', (e) => { if (e.target === wrap) { addOpen = false; wrap.remove(); } });
    wrap.querySelector('#aw-go').onclick = () => {
      const type = document.getElementById('aw-type').value;
      const heading = document.getElementById('aw-h').value.trim() || widgetMeta(type).label;
      const size = Number(document.getElementById('aw-s').value) || 25;
      const widget = {
        type, heading, size,
        range: document.getElementById('aw-r')?.value || '',
        location: document.getElementById('aw-l')?.value || '',
        html_text: document.getElementById('aw-html')?.value || '',
        show_data: document.getElementById('aw-own')?.value || 'show_all_data',
      };
      if (idx >= 0) board.widgets[idx] = widget;
      else board.widgets.push(widget);
      addOpen = false;
      wrap.remove();
      paintCreate();
      bindNav();
    };
  }

  async function onSave() {
    board.name = document.getElementById('dash-name').value.trim();
    board.auto_refresh_min = Number(document.getElementById('dash-ref').value) || 0;
    if (!board.name) { toast('Dashboard Name is required', 'error'); document.getElementById('dash-name').focus(); return; }
    if (!board.widgets.length) { toast('Add at least one widget', 'error'); return; }
    if (!(await confirmAction('Save dashboard?', 'Widgets and layout will be stored for this subsidiary.'))) return;
    const editId = new URLSearchParams(location.search).get('id');
    const { error } = await saveBoard({
      ...board,
      id: board.id || editId || undefined,
      subsidiary_code: getActiveSubsidiary()?.code || null,
    }, session);
    if (error && /does not exist|schema cache|42P01/i.test(error)) {
      toast('Saved locally. Server table is not installed yet.');
    } else if (error) toast(error, 'error');
    else toast('Dashboard saved');
    await reload();
    tab = 'list';
    goFile(FILE, '');
    paint();
  }

  async function paintView() {
    const id = new URLSearchParams(location.search).get('id');
    const found = rows.find((r) => String(r.id) === String(id));
    if (!found) {
      tab = 'list';
      paintList();
      bindNav();
      toast('Dashboard not found', 'error');
      return;
    }
    const acc = getAccess();
    const canEdit = acc?.isAdmin || found.created_by === session.user.id;
    if (!facts) {
      try { facts = await loadFacts(session); }
      catch { facts = { sales: [], purchases: [], expenses: [], products: [], ships: [], leads: [], sessions: [], sellReturns: [], purchaseReturns: [] }; }
    }
    const draw = () => {
      app.innerHTML = `
        ${nav('view')}
        <div class="top">
          <div>
            <h1>${esc(found.name)}</h1>
            <p class="sub">${esc(scopeCaption())}${found.auto_refresh_min ? ' · auto-refresh every ' + found.auto_refresh_min + ' min' : ''}</p>
          </div>
          <div>
            ${canEdit ? `<button type="button" class="btn btn-edit" id="vw-ed">Edit</button>` : ''}
            <button type="button" class="btn ghost" id="vw-all">All dashboards</button>
          </div>
        </div>
        <div class="grid">
          ${(found.widgets || []).map((w) => renderWidget(w, facts)).join('') || '<p>This dashboard has no widgets.</p>'}
        </div>`;
      document.getElementById('vw-ed')?.addEventListener('click', () => openEdit(found.id));
      document.getElementById('vw-all')?.addEventListener('click', () => goTab('list'));
      bindNav();
    };
    draw();
    const mins = Number(found.auto_refresh_min || 0);
    if (mins > 0) {
      refreshTimer = setInterval(async () => {
        try { facts = await loadFacts(session); } catch { /* keep */ }
        draw();
      }, mins * 60000);
    }
  }

  function closeModal() { document.getElementById('cd-modal')?.remove(); }

  function openAi() {
    closeModal();
    const wrap = document.createElement('div');
    wrap.id = 'cd-modal';
    wrap.className = 'modal-bg';
    wrap.innerHTML = `<div class="modal">
      <div class="ai-head"><span>✦ AI Dashboard Builder</span><button type="button" data-x>×</button></div>
      <div class="ai-body">
        <div>
          <h3>Describe Your Business or Dashboard Need</h3>
          <textarea id="ai-desc" placeholder="Example: I run a retail clothing store and need to track daily sales, top products, inventory alerts, and customer dues…"></textarea>
          <p class="hint">The more detail you provide, the better the AI can select the right widgets for your dashboard.</p>
        </div>
        <div>
          <div class="side-card">
            <h4>💡 Example Descriptions</h4>
            <ul>${AI_EXAMPLES.map((e) => `<li>“${esc(e)}”</li>`).join('')}</ul>
          </div>
          <div class="side-card">
            <h4>✦ AI Features</h4>
            <ul>
              <li>✔ Analyzes all available widgets</li>
              <li>✔ Selects those matching your business</li>
              <li>✔ Pre-populates the dashboard builder</li>
            </ul>
          </div>
        </div>
      </div>
      <div class="ai-foot">
        <button type="button" class="ghost" data-x>Close</button>
        <button type="button" class="go" id="ai-go">✦ Generate Dashboard</button>
      </div>
    </div>`;
    document.body.appendChild(wrap);
    wrap.querySelectorAll('[data-x]').forEach((b) => { b.onclick = closeModal; });
    wrap.addEventListener('click', (e) => { if (e.target === wrap) closeModal(); });
    wrap.querySelector('#ai-go').onclick = () => {
      const desc = wrap.querySelector('#ai-desc').value.trim();
      if (!desc) { toast('Dashboard description required', 'error'); wrap.querySelector('#ai-desc').focus(); return; }
      const suggested = aiSuggest(desc);
      board = { name: suggested.name, widgets: suggested.widgets, auto_refresh_min: 0, from_ai: true };
      closeModal();
      goTab('create');
    };
  }

  function openGallery(previewKey) {
    closeModal();
    const wrap = document.createElement('div');
    wrap.id = 'cd-modal';
    wrap.className = 'modal-bg';
    const templates = DASH_TEMPLATES;
    const preview = templates.find((t) => t.key === previewKey);
    wrap.innerHTML = `<div class="modal">
      <div class="tpl-head">
        <div>
          <h3 style="margin:0">${preview ? esc(preview.name) : 'Use a template'}</h3>
          <p class="hint" style="margin:6px 0 0">${preview ? 'Preview of widgets. Use this template to open the builder.' : 'Pick a pre-built dashboard layout to start from. You can rename it and adjust widgets after creation.'}</p>
        </div>
        <button type="button" data-x style="border:0;background:transparent;font-size:20px;cursor:pointer">×</button>
      </div>
      ${preview ? `
        <div style="padding:0 18px 18px">
          <p>${esc(preview.descr)}</p>
          <p class="n">${preview.widgets.length} widgets</p>
          <ul>${preview.widgets.map((w) => `<li>${esc(w.heading)} <span class="hint">(${w.size}%)</span></li>`).join('')}</ul>
          <div class="ai-foot" style="border:0;padding:8px 0 0">
            <button type="button" class="ghost" id="tpl-back">Back</button>
            <button type="button" class="use btn btn-add" data-use="${preview.key}">Use this template</button>
          </div>
        </div>` : `
        <div class="tpl-grid">${templates.map((t) => `<div class="tpl">
          <h4><span>${t.icon}</span> ${esc(t.name)}</h4>
          <p>${esc(t.descr)}</p>
          <div class="n">${t.widgets.length} widgets</div>
          <div class="row">
            <button type="button" class="preview" data-preview="${t.key}">Preview</button>
            <button type="button" class="use" data-use="${t.key}">Use this template</button>
          </div>
        </div>`).join('')}</div>
        <div class="ai-foot"><button type="button" class="ghost" data-x>Close</button></div>`}
    </div>`;
    document.body.appendChild(wrap);
    wrap.querySelectorAll('[data-x]').forEach((b) => { b.onclick = closeModal; });
    wrap.querySelector('#tpl-back')?.addEventListener('click', () => openGallery());
    wrap.querySelectorAll('[data-preview]').forEach((b) => { b.onclick = () => openGallery(b.dataset.preview); });
    wrap.querySelectorAll('[data-use]').forEach((b) => {
      b.onclick = () => {
        const t = templates.find((x) => x.key === b.dataset.use);
        if (!t) return;
        board = { name: t.name, widgets: t.widgets, auto_refresh_min: 0, from_template: t.key };
        closeModal();
        goTab('create');
      };
    });
    wrap.addEventListener('click', (e) => { if (e.target === wrap) closeModal(); });
  }

  async function reload() {
    const [{ rows: boards, err }, rRoles, rProf] = await Promise.all([
      fetchBoards(),
      supabase.from('app_roles').select('id,name').order('name'),
      supabase.from('profiles').select('id,full_name,email').limit(500),
    ]);
    rows = boards;
    roles = (rRoles.data && rRoles.data.length) ? rRoles.data : DEMO_ROLES;
    profiles = rProf.data || [];
    schemaHint = err && /does not exist|schema cache|42P01/i.test(err) ? err : '';
    access = await hydrateAccess();
  }

  const onScope = () => { reload().then(paint); };
  window.addEventListener(SCOPE_EVENT, onScope);
  window.addEventListener('df-spa-leave', () => {
    window.removeEventListener(SCOPE_EVENT, onScope);
    clearInterval(refreshTimer);
    document.getElementById('cd-modal')?.remove();
    document.getElementById('aw-modal')?.remove();
  }, { once: true });

  const draft = takeDraft();
  if (draft) {
    board = { name: '', auto_refresh_min: 0, widgets: [], ...draft };
    if (tab === 'list') tab = 'create';
  }
  const qid = new URLSearchParams(location.search).get('id');
  await reload();
  if (qid && (tab === 'create' || tab === 'view')) {
    const found = rows.find((r) => String(r.id) === String(qid));
    if (found && tab === 'create' && !draft) board = { ...found, widgets: [...(found.widgets || [])] };
  }
  if ((tab === 'create' || tab === 'view') && !facts) {
    try { facts = await loadFacts(session); }
    catch { facts = { sales: [], purchases: [], expenses: [], products: [], ships: [], leads: [], sessions: [], sellReturns: [], purchaseReturns: [] }; }
  }
  onHubNavigate(() => { tab = tabFromUrl(); paint(); });
  paint();
}
