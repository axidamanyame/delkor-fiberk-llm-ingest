# Delkor-Fiberk ERP — handoff for our own LLM

This file is the constitution for any model that must understand what we built.
It is not the product. The product is the folder. Feed both.

**Read `PROJECTS.md` first.** That is the shared map of ERP, KorBek, Supply Chain Catalog, BNPL field apps, and this ingest pack. This file is the ERP layer only.

Last updated: 2026-09-20

---

## 1. What this company is

Delkor-Fiberk Group is a real Ghana retail / hire-purchase / e-commerce group.

Operating companies (subsidiaries):

- Operations Hub (group desk)
- Axidigetek (e-comm HQ)
- BNPL (Hire Purchase)
- Delkor Logistics
- Fiberk (Electronics)

Locations include Fiberk Shop, BNPL Market (Field), BNPL Online Shop, Axidigetek Online Store, Delkor Online, Delkor Furniture Market, Field Stock Hub.

Staff work on a **floor**. HQ works the full ERP. Cashiers, field agents, and Call Centre stay on their own desk. Do not send staff into HRM, System, or another module “because it exists.”

---

## 2. Source of truth (code)

The live product is a vanilla HTML / JS / CSS ERP.

```
Our Project Updates/
  public/          ← the site (HTML, js/, css/, uploads/)
  api/ai.js        ← /api/ai
  vercel.json
  start-local.bat  ← Windows local run
  start-local.mjs
  start-local.sh
  PROJECTS.md      ← shared map for every assistant
  ERP-CONSTITUTION.md
  LLM-HANDOFF.md   ← this file
```

How humans run it:

1. Test the **same folder** on the computer first (`start-local.bat` → login page).
2. After it looks right, upload **that same folder** to Vercel as the project root.
   `index.html`, `js/`, `css/`, `api/`, `vercel.json` must sit at the top — not nested in `public/` on Vercel if they already flattened it. Locally in this workspace the site lives in `Our Project Updates/public`.

Do **not** treat a Vercel zip as the finish line. Do **not** rebuild this as a React toy.

Auth and data: Supabase (Postgres + Auth + RLS). Login is real. Preview demo sessions are sandbox-only.

---

## 3. Product rules the model must never break

These came from the owner across many passes. They override generic ERP habits.

### Shell and look

- Keep the existing **teal heading / ultimate-pos shell**. Do not restyle the company header to a sandbox mock header.
- Left rail: Home, Records, Operations, Purchases, Sales, Finance, Collections, Reports, System, then colour-coded add-on modules.
- Colour modules (Academy, Accounting, AI Assistance, Asset Management, Call Centre, Supply Chain Catalog, Communications, Connector, CRM, Custom Dashboards, Field Ops, HRM, Manufacturing, Project, Repair, Spreadsheet, WMS, WooCommerce) have their **own floor**.
- Floor order: **Summary → other headings / topics → Reports → Setup**.
- Module reports do **not** appear under ERP Reports.
- Module Setup is **not** System settings. System → Settings → Modules is where HQ turns modules on.
- Chevrons + text size (14–120px) are a System setting applied to the **real left rail**, not only a sandbox page.

### Reports

Reports are **read-only documents**. Working lists stay under Purchases, Sales, Operations, Records.

Must look like the sandbox drop (`erp-report-sandbox-3file`):

- Landing: grouped list (Purchase / Inventory / Sales / Finance / Collections / System), not a card grid titled “Reports engine.”
- Items / product reports: **items-page / items-card / blue-tbl** product card (SKU, brand, prices, stock details). PIN-00475 is the reference card.
- Purchase / sell reports: purchase details / sell details **sheets**, click a row for the sheet.
- **Forbidden in Reports:** listing tables with Actions dropdowns, empty Record modals, bar / pie / donut charts.

### People and jobs

- HRM is for HR. Staff do **not** get “Attendance in HRM” from their dashboard. Payslip / their own floor only.
- Call Centre (Valerie Marbell) must **not** see seeded staff manuals (docs 01–06, How to clock in, MoMo vs cash) dumping raw HTML.
- Academy Knowledge Base stays **empty until HQ writes real articles**. Purge seed manuals from KB, User Manual, Policies, Communications KB, AI assist, chatbot, desk-manual.
- No unsolicited helper “cookies”: Academy i-pills, deskHow, infoIcon crumbs on staff desks.

### Notifications

- Bell shows unread only.
- Clear / Mark all read must **persist across login** (write the DB, don’t only hide locally).
- Remove: Send test to me, email test, Open unread log, Bell test, Ping my bell.

### Catalog vs ERP

- Product photos live on the Supply Chain Catalog, not in the ERP.
- Stall identity is shop + short code (A1). ERP `master_sku` (FBK1829) stays internal.

### Data honesty

- Empty is empty. Do not invent stock, sales, or customers to fill a screen.
- Mock sandbox numbers are layout-only until swapped to live Supabase rows.
- Unowned / world-writable rows must never hold personal data.

---

## 4. Main moving parts (files)

| Area | Where |
|---|---|
| Shared project map | `PROJECTS.md` |
| ERP constitution | `ERP-CONSTITUTION.md` |
| Shell, header, left rail, SPA | `public/js/ultimate-shell.js`, `public/css/ultimate-pos.css` |
| Login | `public/login.html`, `public/js/supabaseClient.js` |
| Reports boot | `public/reports.html` → `public/js/report-boot.js` → `public/js/sandbox.js` + `public/css/sandbox.css` |
| Product / purchase sheets | `public/js/record-view.js` |
| Colour-module floors | `public/js/module-floor.js`, `public/js/hub-kit.js` |
| Chevron styles | `public/js/chevron.js`, Settings → Chevron styles |
| Inbox / bell | `public/js/inbox.js` |
| Academy / manuals | `public/js/academy-hub.js`, `public/js/essentials-hub.js`, `public/js/staff-manuals.js` |
| Roles / jobs | `public/js/rbac.js`, `public/js/staff-jobs.js`, `public/js/job-catalog.js` |
| SQL | `Our Project Updates/*.sql` and `public/sql/` |

Reports URL map (ERP Reports, not module reports):

- `/reports.html` — All Reports landing
- `/reports.html?t=pp` — Product Purchase Report
- `/reports.html?t=items` — Items Report
- `/reports.html?t=sell` — Product Sell Report
- plus stock, tax, expense, register, collections (`t=col-age` …), etc.

---

## 5. How to load this into our own LLM

Give the model **four layers**, in this order:

1. **`PROJECTS.md`** — which product is which (ERP vs KorBek vs Catalog vs BNPL vs ingest).
2. **`ERP-CONSTITUTION.md` / this file** as the system / constitution prompt.
3. **The site** as retrieval: `public/js/*.js`, `public/*.html` for hubs, `public/css/ultimate-pos.css`, SQL.
4. **Chat export JSON** as extra “owner said” evidence. If chat and code disagree, **code + constitution win**. Chat is how we got here; the folder is what is true.

Do **not** train on:

- Bank CSVs, Easybuy customer workbooks, staff phone numbers, passwords, Supabase keys, JWT secrets.
- Screenshot dumps of other people’s data.
- `node_modules`, `.git`, platform `__grok` chrome.

Suggested ingest globs:

```
PROJECTS.md
ERP-CONSTITUTION.md
LLM-HANDOFF.md
public/js/**/*.js
public/*.html
public/css/*.css
public/sql/**/*.sql
*.sql
LOCAL-RUN.txt
SOURCE.txt
```

Skip: `public/uploads/fk-catalog/**` (product photos, not language), `node_modules`, zip backups.

Public clone: https://github.com/axidamanyame/delkor-fiberk-llm-ingest

KorBek on the PC reads `knowledge/PROJECTS.md` + `knowledge/ERP-CONSTITUTION.md` via `knowledge.js`. Do not paste this into the KorBek chat.

---

## 6. Voice when the model talks about this ERP

- Speak in **product terms** (Reports, floors, tills, hire purchase), not ports, containers, or tool names.
- Owner tests locally, then uploads the same folder to Vercel. Respect that loop.
- If asked to “just add a table on Reports,” refuse and use a document card instead.
- If asked to seed Academy manuals for staff, refuse.
