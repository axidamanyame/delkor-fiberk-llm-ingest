/** Investors / Partners / Consultants desks — real people only, no demo seed. */
import { pageChrome } from './ultimate-shell.js';
import { confirmAction, ackResult } from './confirm-action.js';
import { bindTable } from './home-tables.js';
import { SCOPE_EVENT, scopeCaption, filterBySidebar } from './scope.js';
import { subsidiaryLabel, stampScope, subsidiarySelect } from './entity-scope.js';
import { readLs, saveRow, deleteRow } from './ls-rows.js';
import { KEYS } from './catalog-seed.js';
import { CLIENT_GROUP_TREE, flattenClientGroups, subsFor, findClientGroup } from './client-groups-tree.js';

export const CLIENT_KINDS = {
  Investors: {
    title: 'Investors',
    who: 'Equity and capital partners. They put money into the group or a subsidiary. They are not shop customers and they are not field agents.',
  },
  Partners: {
    title: 'Partners',
    who: 'Operating, channel, and strategic partners we work with. Not suppliers of goods and not hire-purchase customers.',
  },
  Consultants: {
    title: 'Consultants',
    who: 'Advisors and professional services we retain. Track who they are and every call, email, or meeting with them.',
  },
};

const GROUPS = Object.keys(CLIENT_KINDS);
const CHANNELS = ['Call', 'Email', 'WhatsApp', 'Meeting', 'Letter', 'Other'];

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&',
    '<': '<',
    '>': '>',
    '"': '"',
    "'": '&#39;',
  }[c]));
}

function groupOf(row) {
  const g = String(row?.group_name || row?.client_group || '').trim();
  if (CLIENT_KINDS[g]) return g;
  if (/^investor/i.test(g)) return 'Investors';
  if (/^partner/i.test(g)) return 'Partners';
  if (/^consultant/i.test(g)) return 'Consultants';
  const byId = findClientGroup(row?.group_id);
  return byId?.group_name || '';
}

/** Only tagged Investor / Partner / Consultant rows. Never merge customers, agents, or leftover contacts. */
export function loadClientPeople() {
  const rows = Array.isArray(readLs(KEYS.clients, [])) ? readLs(KEYS.clients, []) : [];
  return rows.filter((r) => GROUPS.includes(groupOf(r)));
}

export function loadComms() {
  return Array.isArray(readLs(KEYS.client_comms, [])) ? readLs(KEYS.client_comms, []) : [];
}

export function kindFromPage() {
  const q = new URLSearchParams(location.search).get('kind');
  if (q && CLIENT_KINDS[q]) return q;
  const file = (location.pathname.split('/').pop() || '').toLowerCase();
  if (file.startsWith('investor')) return 'Investors';
  if (file.startsWith('partner')) return 'Partners';
  if (file.startsWith('consultant')) return 'Consultants';
  return q || '';
}

export async function bootClientDesk(kind = kindFromPage()) {
  const cfg = CLIENT_KINDS[kind];
  const app = document.getElementById('app');
  if (!cfg || !app) return;
  let personFilter = '';
  let subFilter = '';

  async function load() {
    const people = filterBySidebar(loadClientPeople().filter((r) => groupOf(r) === kind))
      .filter((r) => !subFilter || String(r.sub_group || '') === subFilter);
    const comms = loadComms().filter((c) => {
      if (c.group_name && c.group_name !== kind) return false;
      if (personFilter && String(c.party_id) !== String(personFilter)) return false;
      const party = people.find((p) => String(p.id) === String(c.party_id));
      return !c.party_id || party || c.group_name === kind;
    }).sort((a, b) => String(b.logged_on || b.created_at || '').localeCompare(String(a.logged_on || a.created_at || '')));

    const personOpts = people.map((p) => `<option value="${esc(p.id)}" ${personFilter===String(p.id)?'selected':''}>${esc(p.full_name || p.name)}</option>`).join('');

    app.innerHTML = `
      ${pageChrome(cfg.title, cfg.who)}
      <p class="sub">${esc(scopeCaption())}</p>
      <div class="filter-section">
        <div class="filter-header">Filters <span class="filter-chevron">▼</span></div>
        <div class="filter-body">
          <div class="filters">
            <div>Sub-group<br><select id="subf"><option value="">All</option>${subsFor(kind).map((s) => `<option ${subFilter===s.sub_group?'selected':''}>${esc(s.sub_group)}</option>`).join('')}</select></div>
          </div>
        </div>
      </div>
      <div class="card" data-tbl="people">
        <div class="head">
          <h2>Who they are</h2>
          <a class="add" href="/client-form.html?group=${encodeURIComponent(kind)}">+ Add ${esc(kind.replace(/s$/, ''))}</a>
        </div>
        <div class="bar">
          <label>Show <select data-tbl-size><option selected>25</option><option>50</option><option>100</option><option>All</option></select> entries</label>
          <div class="grow"></div>
          <button type="button" data-exp="csv">Export CSV</button>
          <button type="button" data-exp="xls">Export Excel</button>
          <input data-tbl-search placeholder="Search …" />
        </div>
        <div class="ult-table-wrap"><table class="ult-table">
          <thead><tr>
            <th>Action</th><th>Name</th><th>Sub-group</th><th>Company</th><th>Role</th><th>Email</th><th>Phone</th>
            <th>Country</th><th>Subsidiary</th><th>Status</th>
          </tr></thead>
          <tbody>${people.map((p) => `<tr data-id="${esc(p.id)}">
            <td>
              <a class="btn-edit" href="/client-form.html?group=${encodeURIComponent(kind)}&id=${encodeURIComponent(p.id)}">Edit</a>
              <button type="button" class="btn-del" data-del="${esc(p.id)}">Delete</button>
            </td>
            <td>${esc(p.name || p.full_name || '')}</td>
            <td>${esc(p.sub_group || '')}</td>
            <td>${esc(p.company || p.organisation || '')}</td>
            <td>${esc(p.role || '')}</td>
            <td>${esc(p.email || '')}</td>
            <td>${esc(p.phone || p.mobile || '')}</td>
            <td>${esc(p.country || '')}</td>
            <td>${esc(subsidiaryLabel(p.subsidiary_code))}</td>
            <td>${esc(p.status || (p.is_active === false ? 'Inactive' : 'Active'))}</td>
          </tr>`).join('') || `<tr data-dummy="1"><td colspan="10" style="text-align:center">No ${esc(kind.toLowerCase())} yet. Use + Add.</td></tr>`}</tbody>
        </table></div>
        <div style="display:flex;justify-content:space-between;margin-top:10px"><div data-tbl-info></div><div class="pager" data-tbl-pager></div></div>
      </div>
      <div class="card" data-tbl="comms">
        <div class="head"><h2>Communication with ${esc(kind)}</h2></div>
        <form id="comm" class="comm-form">
          <label>Person
            <select name="party_id">
              <option value="">— Select —</option>
              ${people.map((p) => `<option value="${esc(p.id)}">${esc(p.full_name || p.name)}</option>`).join('')}
            </select>
          </label>
          <label>Date <input name="logged_on" type="date" value="${new Date().toISOString().slice(0,10)}" required /></label>
          <label>Channel
            <select name="channel">${CHANNELS.map((c) => `<option>${c}</option>`).join('')}</select>
          </label>
          <label>Direction
            <select name="direction"><option>Outbound</option><option>Inbound</option></select>
          </label>
          <label>Subject <input name="subject" placeholder="Subject" /></label>
          <label class="span2">Note <input name="note" placeholder="What was said or agreed" /></label>
          <button type="submit" class="add" style="border:0;cursor:pointer">Log communication</button>
        </form>
        <div class="bar" style="margin-top:12px">
          <label>Show for
            <select id="pfilter"><option value="">All ${esc(kind)}</option>${personOpts}</select>
          </label>
          <div class="grow"></div>
          <input data-tbl-search placeholder="Search communications…" />
        </div>
        <div class="ult-table-wrap"><table class="ult-table">
          <thead><tr>
            <th>Action</th><th>Date</th><th>Person</th><th>Channel</th><th>Direction</th><th>Subject</th><th>Note</th>
          </tr></thead>
          <tbody>${comms.map((c) => {
            const p = people.find((x) => String(x.id) === String(c.party_id));
            return `<tr data-id="${esc(c.id)}">
              <td><button type="button" class="btn-del" data-cdel="${esc(c.id)}">Delete</button></td>
              <td>${esc((c.logged_on || c.created_at || '').slice(0,10))}</td>
              <td>${esc(c.party_name || p?.full_name || p?.name || '—')}</td>
              <td>${esc(c.channel || '')}</td>
              <td>${esc(c.direction || '')}</td>
              <td>${esc(c.subject || '')}</td>
              <td>${esc(c.note || '')}</td>
            </tr>`;
          }).join('') || '<tr data-dummy="1"><td colspan="7" style="text-align:center">No communications logged yet.</td></tr>'}</tbody>
        </table></div>
      </div>`;

    bindTable(app.querySelector('[data-tbl="people"]'), { title: kind, storageKey: 'client-' + kind });
    bindTable(app.querySelector('[data-tbl="comms"]'), { title: kind + ' comms', storageKey: 'client-comms-' + kind });

    const pfilter = document.getElementById('pfilter');
    if (pfilter) pfilter.onchange = (e) => { personFilter = e.target.value; load(); };
    const subf = document.getElementById('subf');
    if (subf) subf.onchange = (e) => { subFilter = e.target.value; load(); };

    app.querySelectorAll('[data-del]').forEach((b) => {
      b.onclick = async () => {
        if (!(await confirmAction('Delete this person?', 'Communications stay in the log unless you delete those too.'))) return;
        const r = await deleteRow('clients', KEYS.clients, b.dataset.del);
        if (r?.cancelled) return;
        ackResult(true, 'Removed.');
        load();
      };
    });
    app.querySelectorAll('[data-cdel]').forEach((b) => {
      b.onclick = async () => {
        if (!(await confirmAction('Delete this communication?'))) return;
        const r = await deleteRow('client_comms', KEYS.client_comms, b.dataset.cdel);
        if (r?.cancelled) return;
        ackResult(true, 'Removed.');
        load();
      };
    });
    const commForm = document.getElementById('comm');
    if (commForm) commForm.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const partyId = String(fd.get('party_id') || '');
      const party = people.find((p) => String(p.id) === partyId);
      if (!party) { ackResult(false, 'Select who you spoke with.'); return; }
      if (!(await confirmAction('Log this communication?'))) return;
      await saveRow('client_comms', KEYS.client_comms, {
        party_id: party.id,
        party_name: party.full_name || party.name,
        group_name: kind,
        logged_on: fd.get('logged_on'),
        channel: fd.get('channel'),
        direction: fd.get('direction'),
        subject: String(fd.get('subject') || '').trim(),
        note: String(fd.get('note') || '').trim(),
      });
      ackResult(true, 'Communication logged.');
      load();
    };
  }

  window.addEventListener(SCOPE_EVENT, load);
  await load();
}

export async function bootClientForm() {
  const app = document.getElementById('app');
  const q = new URLSearchParams(location.search);
  const id = q.get('id');
  const group = CLIENT_KINDS[q.get('group')] ? q.get('group') : (q.get('group') || 'Investors');
  const people = loadClientPeople();
  const row = people.find((r) => String(r.id) === String(id)) || { group_name: group, status: 'Active' };
  const v = (k) => row[k] ?? '';
  const currentGroup = v('group_name') || group;
  const extras = (readLs(KEYS.client_groups, []) || []).filter((r) => r.group_name === currentGroup);
  const subOpts = [...subsFor(currentGroup), ...extras].map((s) =>
    `<option value="${esc(s.id || s.sub_group)}" ${ (v('group_id')===s.id || v('sub_group')===s.sub_group) ? 'selected' : ''}>${esc(s.sub_group)}</option>`
  ).join('');
  const gOpts = GROUPS.map((g) => `<option ${currentGroup===g?'selected':''}>${g}</option>`).join('');
  app.innerHTML = `
    ${pageChrome((id ? 'Edit' : 'Add') + ' ' + (CLIENT_KINDS[group]?.title || 'Client'), CLIENT_KINDS[group]?.who || '')}
    <form id="f" class="ult-card" style="max-width:760px">
      ${subsidiarySelect(row.subsidiary_code || '')}
      <div class="fg">
        <div><label>Name *</label><input name="name" required value="${esc(v('name') || v('full_name'))}" /></div>
        <div><label>Client group *</label><select name="group_name" id="gname">${gOpts}</select></div>
        <div><label>Sub-group *</label><select name="group_id" id="gid">${subOpts}</select></div>
        <div><label>Role</label><input name="role" value="${esc(v('role'))}" placeholder="e.g. Angel Investor" /></div>
        <div><label>Company</label><input name="company" value="${esc(v('company') || v('organisation'))}" /></div>
        <div><label>Email</label><input name="email" type="email" value="${esc(v('email'))}" /></div>
        <div><label>Phone</label><input name="phone" value="${esc(v('phone') || v('mobile'))}" /></div>
        <div><label>Country</label><input name="country" value="${esc(v('country') || 'Ghana')}" /></div>
        <div><label>Status</label>
          <select name="status">
            <option ${v('status')!=='Inactive'?'selected':''}>Active</option>
            <option ${v('status')==='Inactive'?'selected':''}>Inactive</option>
          </select>
        </div>
      </div>
      <label>Notes</label>
      <textarea name="notes" rows="3">${esc(v('notes'))}</textarea>
      <div class="row">
        <button type="submit" class="save">Save</button>
        <a class="close" href="/${group.toLowerCase()}.html">Close</a>
      </div>
    </form>`;
  const gSel = document.getElementById('gname');
  const idSel = document.getElementById('gid');
  if (gSel && idSel) gSel.onchange = () => {
    const g = gSel.value;
    const extra = (readLs(KEYS.client_groups, []) || []).filter((r) => r.group_name === g);
    idSel.innerHTML = [...subsFor(g), ...extra].map((s) =>
      `<option value="${esc(s.id || s.sub_group)}">${esc(s.sub_group)}</option>`
    ).join('');
  };
  document.getElementById('f').onsubmit = async (e) => {
    e.preventDefault();
    if (!(await confirmAction('Save this record? No other lists are filled in.'))) return;
    const fd = new FormData(e.target);
    const gname = String(fd.get('group_name') || group);
    const gid = String(fd.get('group_id') || '');
    const found = findClientGroup(gid) || flattenClientGroups().find((x) => x.sub_group === gid)
      || (readLs(KEYS.client_groups, []) || []).find((x) => String(x.id) === gid || x.sub_group === gid);
    const body = {
      ...row,
      name: String(fd.get('name') || '').trim(),
      full_name: String(fd.get('name') || '').trim(),
      email: String(fd.get('email') || '').toLowerCase().trim(),
      phone: fd.get('phone') || '',
      group_id: found?.id || gid || null,
      group_name: gname,
      sub_group: found?.sub_group || '',
      company: fd.get('company') || '',
      role: fd.get('role') || found?.sub_group || '',
      country: fd.get('country') || '',
      notes: fd.get('notes') || '',
      status: fd.get('status') || 'Active',
      is_active: fd.get('status') !== 'Inactive',
      kind: 'client',
    };
    try { stampScope(body, e.target); } catch (ex) { ackResult(false, ex.message); return; }
    await saveRow('clients', KEYS.clients, body);
    ackResult(true, 'Saved.');
    location.href = '/' + gname.toLowerCase() + '.html';
  };
}

