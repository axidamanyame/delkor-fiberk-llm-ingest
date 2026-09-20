# Lock-step contract — three projects, one company

Delkor-Fiberk Group is one company. The software is **three active projects** plus related GitHub that must not be mixed in.

If this file and chat disagree, **this file + live code win**.

Last updated: 2026-09-20

---

## The three

| # | Project | Where it is built | Source of truth in this pack |
|---|---|---|---|
| 1 | **Delkor-Fiberk ERP** | This ERP Grok workspace. Vanilla HTML/JS. Founder tests the folder locally, then the same folder to Vercel. | `erp/` + `ERP-CONSTITUTION.md` + `WHAT-WE-BUILT.md` |
| 2 | **Supply Chain Catalog** | A **separate** assistant / workspace. Picture catalog + Vendor App. Orange colour module in the ERP is the **operator console**, not a second catalog. | `catalog/SUPPLY-CHAIN-CATALOG-MASTER-TRAINING.md` |
| 3 | **KorBek AI** | A **separate** assistant / workspace. Not open in the ERP workspace. Not an ollama-electron copy job. | This whole pack as knowledge |

Related, **not** one of the three:

- BNPL field apps — `FieldSales.PWA`, `BNPL-Field-Agent-Monitoring`, `bnpl-agentops` (public), `bnpl-android` (private). Hire-purchase **back office** stays in the ERP (Collections / Field Ops floors). Agents carry the PWA / Android apps.
- This ingest pack itself — knowledge only. Not a deploy.

Private and **not** group ops: `eve-chat-template`, `star-atlas-berry-stone`.

---

## Who owns what

### ERP owns

- The operating system of the group: tills, records, purchases, sales, finance, collections **back office**, people/jobs, System, teal heading, left rail, chevrons.
- Colour-module **floors** (Summary → topics → Reports → Setup) as operator desks inside the ERP.
- Hire-purchase ledgers, PTPs, field **orders** as ERP documents — not the agent phone app.
- Auth / data: Supabase. Empty is empty.

### Catalog owns

- Pictures. Image cloud. Never the ERP database.
- Stall identity: **(shop, short code)**. Max 4 characters. Per shop. Avenue A1 ≠ Freddies A1.
- Vendor App (390×844, PIN), laminate, WhatsApp packet — **small vendors only**.
- Enterprise track (Franko / Oraimo / Electroland): no PIN, no stall app, no laminate.
- Process: WMS low-stock → photo+code+qty → stall confirms **qty + price** → **then** PO → rider → Hub QA vs photo → WMS putaway.

### KorBek owns

- The in-house model’s knowledge and answers.
- Loading this pack so it does not mix products.
- **Proposing** ERP writes. Logging them. Never claiming a live apply. Never holding API keys.

When the KorBek workspace is actually open, **that assistant** puts `PROJECTS.md`, `LOCKSTEP.md`, `ERP-CONSTITUTION.md`, and catalog training into its own knowledge folder. The founder is not a courier to `ollama-electron`.

---

## Frozen rules (all three honour these)

1. **Do not mix products.** Catalog photos stay out of the ERP. Field-sales PWA copy stays out of Catalog. ERP stays vanilla HTML/JS — no React rewrite.
2. **Identity.** Stall / laminate / WhatsApp / Vendor App → shop + short code (**A1**). ERP → `master_sku` (**FBK1829**). Evidence: `catalog/sku-evidence.json`.
3. **No PO before confirm.** Stall confirms qty on hand + current price first.
4. **Reports are documents** in the ERP (items-card / blue-tbl / click-row sheets). No Actions tables, empty Record modals, bar/pie/donut charts on Reports.
5. **Teal heading stays.** Chevrons + type size 14–120 apply to the real left rail (System → Settings → Chevron styles).
6. **Staff stay on their floor.** No HRM shortcuts on cashier / Call Centre desks. Academy Knowledge Base stays empty until HQ writes.
7. **Bell:** unread only. Clear / Mark all read persist in the database.
8. **Empty is empty.** Do not invent stock, sales, customers, SKUs, or GL codes.
9. **No secrets** in public packs or in anything you tell the founder to publish.
10. **Founder time.** Produce the file / zip / git. Do not send a hunt list. Do not invent a PC drop into ollama-electron.

---

## Interfaces the three must keep stable

| From | To | Contract |
|---|---|---|
| Catalog | ERP | Join key `(shop, short code) → photo + master_sku`. Two-way. Photos never stored as ERP product media. |
| ERP Purchases | Catalog | PO is created **after** stall confirm (asked vs have, SHORT or CAN FULFIL). |
| ERP WMS / Operations | Catalog | Low-stock signal and Hub QA against the catalog photo. |
| KorBek | ERP | Propose + log. No live write. No keys. |
| KorBek | Catalog | Avenue + FBK1829 → **A1**. Never “search FBK1829” to a stall. |
| ERP Collections | BNPL field apps | Back office vs phone app. Do not redesign Collections to look like the PWA. |

---

## What each assistant may change

| You are | You may change | You must not change |
|---|---|---|
| ERP | `erp/` vanilla files, constitution if a **dated** rule is added, this pack’s `WHAT-WE-BUILT.md` when you ship | Catalog identity model. Vendor App frame. BNPL PWA. KorBek as a React desk inside the ERP |
| Catalog | Vendor App, laminate, picture cards, shop codes (field survey), image cloud | ERP Reports engine. Teal heading. master_sku as a stall-facing code. Enterprise vendors on PIN |
| KorBek | How the model loads this pack, its own desk later | The ERP UI. The Catalog stall UX. Asking the founder to copy files onto a PC path |

When you add a **shared** rule (identity, reports-as-documents, no-mix), update `LOCKSTEP.md` + `PROJECTS.md` in the same sitting and put a dated line in `catalog/CHANGELOG.md` (or a pack CHANGELOG). Tell the founder to re-attach this zip to the other two chats. Do not make them hunt.

---

## Refuse list (all three)

| Ask | Answer |
|---|---|
| Add an Actions table on ERP Reports | No — document card / sheet. |
| Seed Academy manuals for Call Centre | No — empty until HQ writes. |
| Shortcut cashiers into HRM | No. |
| Store product photos in the ERP | No — Catalog image cloud. |
| Tell Avenue to search FBK1829 | No — they see **A1**. |
| Generate a PO before the stall confirms qty+price | No. |
| Claim KorBek already wrote to live Supabase | No — propose only. |
| Rebuild the ERP in React / TanStack | No. |
| Drop files into ollama-electron so we can “start KorBek” | No — that workspace is not open. Load this zip. |
| Mix BNPL field-app copy into Catalog, or Catalog stall UX into the PWA | No. |
