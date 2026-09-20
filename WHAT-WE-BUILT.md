# What the ERP workspace already built (2026-09-20)

This is the snapshot the other two assistants must not redo or contradict.
The live product is vanilla HTML / JS / CSS. Source in this pack: `erp/`.

If chat says otherwise, **this file + `erp/` win**.

---

## Product shape

- **Delkor-Fiberk ERP** — operating system of the group. Not a demo. Not a React app.
- Shell: **teal heading**, ultimate-pos left rail.
- Auth / data: Supabase (Postgres + Auth + RLS). Preview demo sessions are sandbox-only.
- How it ships: founder tests the **same folder** on the computer (`start-local.bat` → login page), then uploads that folder to Vercel as the project root (`index.html`, `js/`, `css/`, `api/`, `vercel.json` at the top).
- In the Grok ERP workspace the site lives at `Our Project Updates/public`. Do not edit `/workspace/erp-app` for new work.

Left rail: Home, Records, Operations, Purchases, Sales, Finance, Collections, Reports, System, then colour modules.

Colour modules (Academy, Accounting, AI Assistance, Asset Management, Call Centre, **Supply Chain Catalog**, Communications, Connector, CRM, Custom Dashboards, Field Ops, HRM, Manufacturing, Project, Repair, Spreadsheet, WMS, WooCommerce) have their **own floor**: **Summary → topics → Reports → Setup**. Module reports stay on that module, not under ERP Reports. Module Setup is not System settings.

---

## Shipped rules (do not reverse)

### Reports are documents

Working lists live under Purchases, Sales, Operations, Records.

ERP Reports look like the sandbox drop:

- Landing: grouped list (Purchase / Inventory / Sales / Finance / Collections / System), not a card grid titled “Reports engine.”
- Items / product reports: **items-page / items-card / blue-tbl** (SKU, brand, prices, stock). PIN-00475 is the reference card.
- Purchase / sell reports: purchase details / sell details **sheets**. Click a row for the sheet.

**Forbidden on Reports:** listing tables with Actions, empty Record modals, bar / pie / donut charts.

Files: `erp/public/reports.html` → `erp/public/js/report-boot.js` → `erp/public/js/sandbox.js` + `erp/public/css/sandbox.css`. Product / purchase sheets: `erp/public/js/record-view.js`.

URL map: `/reports.html` landing; `?t=pp` Product Purchase; `?t=items` Items; `?t=sell` Product Sell; plus stock, tax, expense, register, collections (`t=col-age` …).

### People, Academy, bell, chevrons

- HRM is for HR. No “Attendance in HRM” on staff dashboards.
- Academy Knowledge Base stays **empty until HQ writes**. No seeded manuals (clock in, MoMo vs cash, docs 01–06) in Call Centre, KB, User Manual, Policies, AI assist, chatbot, or desk-manual. `STAFF_MANUALS = []`.
- Bell: unread only. Clear / Mark all read persist in the database. No Send test / Bell test / Ping my bell / unread log.
- No helper crumbs on staff desks (Academy i-pills, deskHow, infoIcon).
- Chevrons + type size **14–120** apply to the **real left rail** (System → Settings → Chevron styles), not only a sandbox page. Files: `erp/public/js/chevron.js`, `erp/public/js/ultimate-shell.js`.

### Catalog vs ERP (already decided)

- Product photos live on the Supply Chain Catalog, not in the ERP.
- Stall identity is shop + short code (**A1**). ERP `master_sku` (**FBK1829**) stays internal.
- The ERP colour module **Supply Chain Catalog** is the operator console into the catalog. The stall Vendor App is a Catalog product.

Evidence row: Avenue + USB-C Flat Cable White = shop code **A1**, ERP sku **FBK1829** (`catalog/sku-evidence.json`).

### Data honesty

- Empty is empty. Do not invent stock, sales, or customers.
- Mock sandbox numbers are layout-only until swapped to live Supabase rows.

---

## Main files (ERP)

| Area | File |
|---|---|
| Shell, header, left rail, SPA | `erp/public/js/ultimate-shell.js`, `erp/public/css/ultimate-pos.css` |
| Login | `erp/public/login.html`, `erp/public/js/supabaseClient.js` (keys **redacted** in this pack) |
| Reports | `erp/public/js/report-boot.js`, `sandbox.js`, `css/sandbox.css`, `record-view.js` |
| Colour-module floors | `erp/public/js/module-floor.js`, `hub-kit.js`, `module-books.js` |
| Chevrons | `erp/public/js/chevron.js`, `settings.html` |
| Inbox / bell | `erp/public/js/inbox.js` |
| Academy / manuals | `academy-hub.js`, `essentials-hub.js`, `staff-manuals.js` |
| Roles / jobs | `rbac.js`, `staff-jobs.js`, `job-catalog.js`, `access-rules.js` |
| SQL | `erp/*.sql`, `erp/public/sql/` |
| Local run | `erp/start-local.bat` → login.html |

Full retrieval map: `FILEMAP.md`. Indexer globs: `INGEST-GLOBS.txt`.

---

## Intentionally not in this pack

- Product photos (`uploads/fk-catalog`)
- Bank statements, Easybuy books, customer / user CSVs
- `.env`, live Supabase keys (placeholders only)
- Patch zips, `node_modules`
- Secrets

To **run** the ERP, use the live folder, not this pack.

---

## Not done / do not fake

- KorBek is **not** writing to live Supabase. Propose only.
- KorBek is **not** being built in `ollama-electron` in this sitting. Other assistants load this zip.
- Academy KB is empty on purpose.
- Catalog live image cloud is not the ERP database. Demo pictures in Catalog are stand-ins.
- ERP Reports live preview vs demo-session bounce may still need founder eyes on the **folder**, not a zip.
- BNPL field apps are separate GitHub products. Do not “finish” them inside the ERP.

---

## Company (so every assistant uses the same names)

**Delkor-Fiberk Group** — Ghana retail / hire-purchase / e-commerce.

Subsidiaries: Operations Hub, Axidigetek (e-comm HQ), BNPL (Hire Purchase), Delkor Logistics, Fiberk (Electronics).

Locations: Fiberk Shop, BNPL Market (Field), BNPL Online Shop, Axidigetek Online Store, Delkor Online, Delkor Furniture Market, Field Stock Hub.

Staff work on a **floor**. HQ works the full ERP. Cashiers, field agents, and Call Centre stay on their own desk.

GitHub for group code: [axidamanyame](https://github.com/axidamanyame).
