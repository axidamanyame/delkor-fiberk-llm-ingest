/**
 * AI Assistance hub — UPOS tool grid, generator form, history.
 */
import { esc } from "./ls-rows.js";
import { tableBar, tableFoot } from "./accounting.js";
import { bindTable } from "./home-tables.js";
import { hubTabs, bindHubTabs, goFile, emptyRow, svgIco, onHubNavigate, floorNav, tryPaintFloor } from "./hub-kit.js";
import {
  AI_TOOLS, LANGS, remainingTokens, spendToken, loadHistory, pushHistory, createCopy,
} from "./ai-assist.js";

const FILE = "/ai-assistance.html";
const TABS = [
  { key: "home", label: "AI Assistance" },
  { key: "history", label: "History" },
];
const BRAND = `${svgIco("spark")} AI Assistance`;

function tab() {
  const q = new URLSearchParams(location.search);
  if (q.get("tab") === "history") return "history";
  return "home";
}
function toolId() {
  return new URLSearchParams(location.search).get("tool") || "";
}
function go(t, extra) {
  const q = new URLSearchParams();
  if (t === "history") q.set("tab", "history");
  if (extra?.tool) q.set("tool", extra.tool);
  const path = FILE + (q.toString() ? "?" + q.toString() : "");
  history.pushState({ spa: path }, "", path);
  paint();
}

function icoSvg(name) {
  const n = String(name || "spark");
  if (n === "g") return `<span class="ai-letter">G</span>`;
  if (n === "f") return `<span class="ai-letter">f</span>`;
  const map = {
    tag: svgIco("box"),
    star: svgIco("sun"),
    reply: svgIco("conv"),
    share: svgIco("up"),
    mail: svgIco("doc"),
    doc: svgIco("doc"),
    book: svgIco("folder"),
    chat: svgIco("users"),
    spark: svgIco("sun"),
  };
  return map[n] || svgIco("box");
}

function nav(on) {
  return floorNav(BRAND, on, "home", FILE);
}

function paintHome(app) {
  const id = toolId();
  const tool = AI_TOOLS.find((t) => t.id === id);
  if (tool) return paintForm(app, tool);

  app.innerHTML = `
    ${nav("home")}
    <h1 class="hub-h1">AI Assistance</h1>
    <p class="ai-tokens">${remainingTokens()}/100 Tokens Remaining</p>
    <div class="ai-grid">${AI_TOOLS.map((t) => `
      <article class="ai-tile">
        <div class="ai-ico">${icoSvg(t.ico)}</div>
        <h3>${esc(t.title)}</h3>
        <p>${esc(t.blurb)}</p>
        <button type="button" class="ai-create" data-tool="${esc(t.id)}">Create</button>
      </article>`).join("")}</div>`;
  bindHubTabs(app, go);
  app.querySelectorAll("[data-tool]").forEach((b) => {
    b.onclick = () => go("home", { tool: b.dataset.tool });
  });
}

function fieldHtml(f) {
  const req = f.req ? ' <span class="req">*</span>' : "";
  if (f.type === "textarea") {
    return `<div class="ult-field"><label>${esc(f.label)}${req}</label>
      <textarea name="${esc(f.key)}" rows="4" placeholder="${esc(f.label)}" ${f.req ? "required" : ""}></textarea></div>`;
  }
  return `<div class="ult-field"><label>${esc(f.label)}${req}</label>
    <input name="${esc(f.key)}" placeholder="${esc(f.label)}" ${f.req ? "required" : ""} /></div>`;
}

function paintForm(app, tool) {
  app.innerHTML = `
    ${nav("home")}
    <h1 class="hub-h1">AI Assistance</h1>
    <p class="ai-tokens">${remainingTokens()}/100 Tokens Remaining</p>
    <div class="ai-form-card">
      <div class="ai-form-banner">
        <div>
          <h2>${esc(tool.title)}</h2>
          <p>${esc(tool.blurb)}</p>
        </div>
        <button type="button" class="ai-star" id="ai-star" title="Favourite">★</button>
      </div>
      <form id="create_form" class="ai-form-body">
        <p class="ai-example">${esc(tool.example)}</p>
        ${(tool.fields || []).map(fieldHtml).join("")}
        <div class="ult-field"><label>Language:</label>
          <select name="language">${LANGS.map((l) => `<option>${esc(l)}</option>`).join("")}</select></div>
        <div class="ai-form-actions">
          <button type="reset" class="ai-reset">Reset</button>
          <button type="submit" class="ai-go" id="submit_btn">Create</button>
        </div>
      </form>
    </div>
    <div class="output_row" id="ai-out"></div>`;
  bindHubTabs(app, go);
  const star = app.querySelector("#ai-star");
  star.onclick = () => star.classList.toggle("on");
  app.querySelector("#create_form").onsubmit = async (e) => {
    e.preventDefault();
    if (remainingTokens() <= 0) {
      alert("No tokens remaining");
      return;
    }
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    for (const f of tool.fields || []) {
      if (f.req && !String(data[f.key] || "").trim()) {
        alert(`${f.label} is required`);
        return;
      }
    }
    const btn = app.querySelector("#submit_btn");
    btn.disabled = true;
    btn.textContent = "Working…";
    const { text } = await createCopy(tool, data);
    if (!text) {
      alert("Could not generate copy");
      btn.disabled = false;
      btn.textContent = "Create";
      return;
    }
    spendToken();
    const created = new Date().toISOString().replace("T", " ").slice(0, 19);
    pushHistory({
      input: Object.values(data).filter(Boolean).join(" · "),
      output: text,
      tool: tool.title,
      added_by: "Akosua Darko",
      created_at: created,
    });
    const card = document.createElement("div");
    card.className = "ai-out";
    card.innerHTML = `<h3>Result</h3><pre>${esc(text)}</pre>
      <p><button type="button" class="ult-btn ult-btn-outline ult-btn-sm" data-copy>Copy</button></p>`;
    app.querySelector("#ai-out").prepend(card);
    card.querySelector("[data-copy]").onclick = async () => {
      try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
    };
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    btn.disabled = false;
    btn.textContent = "Create";
    const tok = app.querySelector(".ai-tokens");
    if (tok) tok.textContent = `${remainingTokens()}/100 Tokens Remaining`;
  };
}

function paintHistory(app) {
  const rows = loadHistory();
  app.innerHTML = `
    ${nav("history")}
    <h1 class="hub-h1">History <span>History of all generated outputs</span></h1>
    <details class="ess-filters" open>
      <summary><span class="ess-filter-ico">▾</span> Filters</summary>
      <div class="pr-filters">
        <label>Tool:<select id="f-tool"><option value="">All</option>${AI_TOOLS.map((t) => `<option>${esc(t.title)}</option>`).join("")}</select></label>
        <label>Date Range:<input id="f-range" value="01/01/2026 - 12/31/2026" readonly /></label>
        <label>Search:<input id="f-q" placeholder="Search" /></label>
      </div>
    </details>
    <div class="ult-card" data-tbl="ai-hist">
      ${tableBar()}
      <div class="ult-table-wrap"><table class="ult-table">
        <thead><tr><th>Input</th><th>Output</th><th>Tool</th><th>Added By</th><th>Created At</th></tr></thead>
        <tbody>${rows.map((r) => `<tr>
          <td>${esc((r.input || "").slice(0, 160))}</td>
          <td>${esc((r.output || "").slice(0, 220))}</td>
          <td>${esc(r.tool)}</td>
          <td>${esc(r.added_by)}</td>
          <td>${esc(r.created_at)}</td>
        </tr>`).join("") || emptyRow(5, "No data available in table")}</tbody>
      </table></div>
      ${tableFoot()}
    </div>`;
  bindHubTabs(app, go);
  bindTable(app.querySelector("[data-tbl='ai-hist']"), { title: "AI History", storageKey: "ai-hist" });
  const apply = () => {
    const tool = app.querySelector("#f-tool").value;
    const kw = app.querySelector("#f-q").value.toLowerCase().trim();
    app.querySelectorAll("tbody tr").forEach((tr) => {
      if (tr.dataset.dummy === "1") return;
      const cells = [...tr.children].map((td) => td.textContent);
      let ok = true;
      if (tool && cells[2] !== tool) ok = false;
      if (kw && !cells.join(" ").toLowerCase().includes(kw)) ok = false;
      tr.hidden = !ok;
    });
    app.querySelector("[data-tbl-search]")?.dispatchEvent(new Event("input"));
  };
  app.querySelector("#f-tool").onchange = apply;
  app.querySelector("#f-q").oninput = apply;
}

function paint() {
  const app = document.getElementById("app");
  if (!app) return;
  const on = tab();
  if (tryPaintFloor(app, on, { brand: BRAND, file: FILE, go })) return;
  if (on === "history") return paintHistory(app);
  paintHome(app);
}

export async function bootAiHub() {
  onHubNavigate(paint);
  try { loadHistory(); } catch { /* quota — still paint the desk */ }
  paint();
}
