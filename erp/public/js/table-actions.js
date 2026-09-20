/**
 * Actionable columns sit immediately after the row checkbox
 * (or first if the table has no checkbox).
 *
 * Only real action widgets count. A header labelled "Action" that is a data
 * field (audit Event = view/edit) must not be hoisted on its own — that is
 * what shifted every audit column one step left.
 */
const ACTION_RE = /^(action|actions)$/i;
const WIDGET = '.act-btn, [data-act], details.act, .act-menu, menu.act-portal, .btn-view, .btn-edit, .btn-del';

function hasActionWidget(cell) {
  return !!(cell && cell.querySelector(WIDGET));
}

function isCheckCell(cell) {
  return !!(cell && cell.querySelector('input[type="checkbox"]'));
}

function labelOf(cell) {
  return String(cell?.textContent || '').replace(/[↕↑↓⇅]/g, '').replace(/\s+/g, ' ').trim();
}

export function hoistActionColumns(root = document) {
  (root.querySelectorAll ? root.querySelectorAll('table') : []).forEach((table) => {
    if (table.dataset.noActHoist === '1' || table.closest('[data-readonly="1"]')) return;
    const head = table.tHead?.rows?.[0];
    if (!head || head.children.length < 2) return;
    const bodyRows = [...table.querySelectorAll('tbody tr')].filter((tr) =>
      tr.dataset.dummy !== '1' && !(tr.cells.length === 1 && tr.cells[0].hasAttribute('colspan'))
    );
    const widgetCol = bodyRows.reduce((found, tr) => {
      if (found >= 0) return found;
      return [...tr.children].findIndex(hasActionWidget);
    }, -1);
    if (widgetCol < 0) return;
    const headAct = [...head.children].findIndex((th) => ACTION_RE.test(labelOf(th)));
    const col = headAct >= 0 ? headAct : widgetCol;
    table.querySelectorAll('tr').forEach((tr) => {
      const cells = [...tr.children];
      if (cells.length < 2) return;
      if (tr.cells.length === 1 && tr.cells[0].hasAttribute('colspan')) return;
      const act = cells[col] || cells.find(hasActionWidget) || cells.find((c) => ACTION_RE.test(labelOf(c)));
      if (!act) return;
      const check = cells.find(isCheckCell);
      if (check) {
        if (act.previousElementSibling === check) return;
        check.after(act);
      } else if (tr.firstElementChild !== act) {
        tr.insertBefore(act, tr.firstElementChild);
      }
    });
  });
}

export function watchActionColumns(root = document) {
  hoistActionColumns(root);
}
