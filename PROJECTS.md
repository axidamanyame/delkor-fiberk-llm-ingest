# Delkor-Fiberk — project map (all assistants)

**This is the shared map.** Every Grok session, KorBek, and any model trained from this pack must read it before mixing products.

Last updated: 2026-09-20

If chat history and this file disagree, **this file + live code win**.

**Other assistants: start at `ATTACH-ME.md`, then `START-HERE.md`, then `LOCKSTEP.md`.**
Do not ask the founder to drop files into `ollama-electron`. That folder is not this sitting’s build. This zip is how you get current.

---

## 0. One group, three lock-step projects (do not merge them)

Delkor-Fiberk Group (Ghana) is one company. The software is **not** one codebase.

The three projects that must move in lock-step:

| If they say | They mean | Do not treat it as |
|---|---|---|
| ERP, Reports, tills, floors, teal heading | **1. Delkor-Fiberk ERP** | Catalog, KorBek, field PWA |
| A1, Avenue, stall, laminate, vendor PIN, picture catalog | **2. Supply Chain Catalog** | ERP product photos, BNPL |
| KorBek, Ollama, our LLM, Master Intelligence | **3. KorBek AI** | The ERP UI, a PC copy job |

Related, not one of the three: BNPL field apps (`FieldSales.PWA` etc.) and this ingest pack.

Never dump Catalog photos into the ERP. Never send a stall our `master_sku`. Never rebuild the ERP as React. Never mix BNPL field-app copy into Catalog. Never ask the founder to courier files to a PC path.

---

## 1. The company

**Delkor-Fiberk Group** — real Ghana retail / hire-purchase / e-commerce.

Subsidiaries: Operations Hub, Axidigetek (e-comm HQ), BNPL (Hire Purchase), Delkor Logistics, Fiberk (Electronics).

Locations: Fiberk Shop, BNPL Market (Field), BNPL Online Shop, Axidigetek Online Store, Delkor Online, Delkor Furniture Market, Field Stock Hub.

Staff work on a **floor**. HQ works the full ERP. Cashiers, field agents, and Call Centre stay on their own desk.

GitHub account for group code: [axidamanyame](https://github.com/axidamanyame).

---

## 2. Product 1 — Delkor-Fiberk ERP (live)

The operating system of the group. Vanilla HTML / JS / CSS. Teal heading. Ultimate-pos left rail.

| | |
|---|---|
| **Source of truth** | ERP Grok workspace: `Our Project Updates/public`. In this pack: `erp/`. Do not edit `/workspace/erp-app` for new work. |
| **How the founder ships** | Test the **same folder** on the computer first (`start-local.bat` → login page). Then upload **that same folder** to Vercel as the project root. |
| **Auth / data** | Supabase (Postgres + Auth + RLS). Empty is empty. |
| **Not** | A React rewrite. A demo. A place to store product photos. |

Left rail: Home, Records, Operations, Purchases, Sales, Finance, Collections, Reports, System, then colour modules.

Hard rules (full text in `ERP-CONSTITUTION.md` / `LLM-HANDOFF.md` / `WHAT-WE-BUILT.md`):

1. Keep the teal heading. Do not restyle it to a sandbox mock header.
2. Colour modules have their own floor: Summary → topics → Reports → Setup. Module reports stay on that module.
3. Reports are **read-only documents** (items-card / blue-tbl / click-row sheets). Working lists live under Purchases, Sales, Operations, Records. No Actions tables, empty Record modals, or bar/pie/donut charts on Reports. PIN-00475 is the product-card reference.
4. HRM is for HR. No “Attendance in HRM” on staff dashboards.
5. Academy Knowledge Base stays empty until HQ writes real articles.
6. Bell: unread only. Clear / Mark all read persist in the database.
7. Chevrons + type size (14–120) apply to the **real left rail** (System → Settings → Chevron styles).
8. Speak in product terms. Do not send the founder hunting files.

---

## 3. Product 2 — Supply Chain Catalog (picture catalog + Vendor App)

Standalone catalog for Fiberk shop accessories from small Circle / Tip Toe Lane stalls. Plugs **two-way** into the ERP. Colour module: **Supply Chain Catalog** (orange) is the **operator console**, not the stall app. QR is a heading inside it, not the product name.

Join key: **(shop, short code) → photo + ERP `master_sku`**.

| World | Identity |
|---|---|
| Stall phone / laminate / WhatsApp | Picture + shop code (A1). Max 4 characters. Codes are **per shop**. Avenue A1 is not Freddies A1. |
| ERP | `master_sku` (FBK1829) — internal. Never tell a stall to search it. |
| Photos | Catalog image cloud. **Never** the ERP database. |

Two tracks — **do not mix**:

- **Small vendors** — Vendor App (390×844 phone frame, PIN), laminate, WhatsApp. Avenue, HKSHOP, Freddies Corner, Carlcare Circle, Blessing, God’s Grace, Kobby, EmmaTech.
- **Enterprise** — Franko, Oraimo, Electroland. No PIN, no stall app, no laminate.

Process: WMS low-stock → photo+code+qty → stall confirms **qty + price** → **then** PO → rider → Hub QA vs photo → WMS putaway. No PO before confirm. No PDF invoices as the stall packet. No BuyNowPaysLater wording.

Canonical training: `catalog/SUPPLY-CHAIN-CATALOG-MASTER-TRAINING.md`. Evidence: `catalog/sku-evidence.json` (Avenue + FBK1829 → **A1**).

---

## 4. Product 3 — KorBek AI (our own LLM)

The in-house model. One brain for the group.

**This is a separate workspace. It is not being built in the ERP workspace and it is not an ollama-electron copy job.**

| | |
|---|---|
| **How KorBek gets current** | The founder attaches **this zip** (or the public git). The KorBek assistant reads `ATTACH-ME.md` then `START-HERE.md`. |
| **Must load** | `PROJECTS.md`, `LOCKSTEP.md`, `ERP-CONSTITUTION.md`, catalog training, `WHAT-WE-BUILT.md` |
| **Live ERP writes** | Not connected yet. Propose and log. Never claim a remote apply. Never hold API keys. |
| **Later, when that desktop folder is open** | Electron + Ollama, default model `qwen2.5-coder:7b`. Until the founder opens it, do **not** ask them to copy files there. |

Smoke test when the model actually runs: “Using your training document, what does Avenue see for FBK1829?” → **A1**. Second: “What products are we building?” → this map, not one app.

---

## 5. Related — BNPL / hire-purchase field apps (not one of the three)

Hire purchase is a **real subsidiary**, not a demo. ERP Collections / Field Ops floors are **not** these apps.

| Repo | Role | Visibility |
|---|---|---|
| [FieldSales.PWA](https://github.com/axidamanyame/FieldSales.PWA) | BNPL Field Sales client (PWA, GitHub Pages). Agent-facing. | Public |
| [BNPL-Field-Agent-Monitoring](https://github.com/axidamanyame/BNPL-Field-Agent-Monitoring) | Monitor sales and stock movement of field agents. | Public |
| [bnpl-agentops](https://github.com/axidamanyame/bnpl-agentops) | Spec: BNPL Unified Master v2.2 (web) → Android (Capacitor). | Public |
| `bnpl-android` | Android track. | **Private** |

ERP still holds hire-purchase **back office** (collections, PTPs, field orders). The PWA / Android apps are what agents carry. Do not redesign the ERP Collections floor to look like the PWA, and do not put Catalog stall UX on the field-sales client.

---

## 6. This pack (public knowledge)

The pack other assistants (and later KorBek) ingest so they know what was built without hunting.

| | |
|---|---|
| **Public git** | https://github.com/axidamanyame/delkor-fiberk-llm-ingest |
| **What is in it** | `ATTACH-ME.md`, `START-HERE.md`, `LOCKSTEP.md`, `WHAT-WE-BUILT.md`, `PROJECTS.md`, constitutions, catalog training, sanitized `erp/` tree. |
| **What is out** | Photos, bank/customer CSVs, `.env`, live Supabase keys, patch zips, `node_modules`. |
| **Not** | A Vercel deploy. To run the ERP, use the live folder, not this pack. |
| **Not** | An ollama-electron install. |

Load order: `ATTACH-ME.md` → `START-HERE.md` → `PROJECTS.md` → `LOCKSTEP.md` → `WHAT-WE-BUILT.md` → your lane (ERP constitution / catalog training / both). Then index `erp/` with `INGEST-GLOBS.txt`. Chat loses to code + these docs.

---

## 7. Other GitHub (do not mix into group ops)

Private, **not** Delkor-Fiberk operating products. Do not answer ERP / Catalog / BNPL questions from these:

- `eve-chat-template`
- `star-atlas-berry-stone`

---

## 8. How assistants must behave

- **One map.** If you are in the ERP workspace, you still know Catalog and KorBek exist — and you do not turn this session into those apps unless asked.
- **Local folder first, then Vercel** for the ERP. Do not treat a zip as the ERP finish line.
- **This zip is the lock-step drop for other assistants.** Do not ask the founder to copy it onto a PC path.
- **Code + this map + constitution beat old chat.**
- **Empty is empty.** Do not invent stock, sales, customers, SKUs, or GL codes.
- **No secrets in public packs.** No service_role, JWTs, staff phones, bank files.
- **Founder time is scarce.** Produce the drop (file, zip, git). Do not send a hunt list.
- **Voice:** product terms (Reports, floors, tills, hire purchase, stall code). Not ports, containers, or tool names when talking to the founder.

### Quick refuse list

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
| Drop files into ollama-electron | No — KorBek workspace is not open. Attach this zip to that chat instead. |

---

## 9. Where this file lives (keep copies in sync)

| Place | Path |
|---|---|
| ERP workspace (Grok) | `Our Project Updates/PROJECTS.md` |
| This sandbox’s project instructions | `AGENTS.project.md` (points here) |
| Public ingest / lock-step pack | repo root `PROJECTS.md` |
| When a KorBek workspace is open | that workspace’s knowledge folder |

When you change the map, change **all** of those in the same pass, and re-attach this zip to the other two chats.
