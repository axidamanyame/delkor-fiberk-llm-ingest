# Delkor-Fiberk Group — Supply Chain Catalog
## Master training document for the local AI assistant

**Document type:** Canonical business + product training corpus  
**Company:** Delkor-Fiberk Group (multi-subsidiary ERP)  
**Module name:** Supply Chain Catalog (formerly Catalogue QR)  
**Scope of this pack:** Fiberk shop accessories procurement from small Circle / Tip Toe Lane vendors. Not the full ERP. Not other subsidiaries’ shops unless stated.  
**Status:** Frontend sandbox + process definition. Pictures in the demo are temporary stand-ins. Live photos will live in a catalog image cloud, not in the ERP database.  
**Compiled:** 2026-09-20 from workspace files, uploaded product master, technical library PART I–XII, and the build conversation that produced the Vendor App.

How to use this file
- Treat every **Rule** as binding unless a later dated change in `changes/CHANGELOG.md` overrides it.
- Do not invent longer shop codes, extra ERP rooms, BuyNowPaysLater branding, or demo agent names.
- Prefer shop code + picture over paragraphs when advising vendor-facing UX.
- ERP `master_sku` is internal. Never put it on a stall phone as the thing they must remember.

---

## 0. What this project is (and is not)

### Is
- A **picture catalog** for accessories bought from small Accra shops that have little or no computer system.
- A **standalone catalog platform** that plugs **two-way** into the Delkor-Fiberk ERP.
- The join key between worlds: **supplier shop code** ↔ catalog photo/description ↔ ERP `master_sku`.
- A **Vendor / Field phone app** (same skin later for riders) with a simple PIN.
- The **only ERP-facing UI** operators should use to call catalog functions (Purchase Orders console + wired floors). Catalog admin is for catalog managers only.

### Is not
- A second ERP product master.
- A duplicate of Franko / Oraimo / Electroland procurement systems.
- A classic factory purchase-order factory.
- Spare-parts selling as the Fiberk shop’s main trade (accessories, Oraimo-class goods, cables are prominent; phones only occasionally).
- BuyNow PaysLater consumer app copy. That screenshot was only a **mobile skin reference**.

### Company context
- Multi-subsidiary group. Filters and left menus must match the real ERP chrome (teal header, All Subsidiaries, All Locations).
- This catalog work is **Fiberk shop / Circle supply**, not every subsidiary.
- Color-coded modules can stand alone and later plug into other systems. Reports for a color module live under that module as **Reports → Module Setup**, not as a copy of System settings.
- System settings (Modules on/off, Vendor PINs) live under **System**, never as a tab named Settings on the catalog right pane. Catalog right pane last items are **Reports** and **Setup** (page-local tables/rules only).

---

## 1. Problem being solved

Circle and Tip Toe Lane stalls sell fast-moving accessories (cables, chargers, power banks, earbuds, watches, cases, storage). Ordering today is:

- Long WhatsApp descriptions (“20 pieces Samsung 25W USB-C black…”)
- Wrong wattage / pin / color
- No live inventory API at the stall
- Stock leaks and missing counts at the small Fiberk shop
- Confusion when Fiberk SKUs are shown to vendors, riders, and clerks as if they were stall codes

The catalog reduces an order to **a picture + a short shop code + a quantity**. The stall confirms **qty on hand + current price**. Only then is a PO finalized. Then a rider picks up.

---

## 2. Two supplier tracks (do not mix)

### Small vendors — THIS app, laminate book, WhatsApp, PIN
They do not have a sophisticated procurement system. Target UX: picture first, one letter + number code, almost no typing.

Examples used in the sandbox:

| id | Shop | Demo PIN | Code letter |
|----|------|----------|-------------|
| SUP-0001 | Avenue Phones & Accessories | 1111 | A (A1, A2…) |
| SUP-0002 | HKSHOP Ghana | 2222 | H |
| SUP-0003 | Freddies Corner | 3333 | C |
| SUP-0005 | Carlcare Circle | 6666 | K |
| SUP-0006 | Blessing Accessories | 1212 | B |
| SUP-0007 | God’s Grace Hub | 1313 | G |
| SUP-0008 | Kobby Gadgets | 1414 | Y |
| SUP-0009 | EmmaTech | 1515 | E |

Other small nodes mentioned for the ecosystem (may not all have seeded lines): Mazae Local Shopping Centre, Circle Digital Connect, Blessing Phones & Accessories at Tip Toe Lane.

### Enterprise — separate heading, no Vendor App
They already have systems. Do **not** give them PIN, laminate, or WhatsApp PO packets. ERP still stores our `master_sku` when we buy. Mapping their item numbers is a later API track.

| id | Name |
|----|------|
| SUP-0023 | Franko Trading Enterprise |
| SUP-0013 | Oraimo Ghana |
| SUP-0012 | Electroland Ghana |

---

## 3. Identity model (critical)

### What each party sees for the same USB-C cable

| Who | What they see |
|-----|----------------|
| Avenue stall | **A1** |
| Same physical item at another small shop | That shop’s own code (example dual maps exist in the seed: same ERP sku under two shop codes) |
| Rider / field | The shop’s code + the photo |
| Fiberk ERP | **FBK1829** (`master_sku`) only |

**Rules**
- Shop code format: **one letter + number, maximum 4 characters** (A1, C55, F10). Literacy constraint. Do not use FB-829, AV-UC10, or hyphenated catalog poetry on the stall.
- Codes are **per shop**, not globally unique across Accra. Avenue A1 is not Freddies A1.
- Our system interprets the pair `(shop, code)` into size, color, photo, and `master_sku`.
- `supplier_item_code` / shop code is the key that pulls the picture from the **catalog image store**.
- ERP must not become the image database.
- Fiberk product-master import (`products-delkor-ii-fiberk.json`, ~4,294 rows) supplied real names, brands, categories, stock/sell figures, and SKUs. Those SKUs are **internal**. Chopping FBK1829 into FB-829 as a public code was rejected.
- Final stall codes will be locked by a **field survey**. Seed codes are provisional.

### Lookup the assistant must support
- User types our SKU `FBK1829` + picks shop Avenue → answer **A1**.
- User types A1 + Avenue → photo, bold name “USB -C Flat Cable White”, ERP sku internally.
- Never tell a stall “search FBK1829”.

---

## 4. Picture catalog rules

- Cards for vendors: **photo + code**. Description is an optional link that opens a popup.
- Popup content that matters: **code + bold product name only** (the bold line from the desktop catalog card). Do not dump shop name, survey notes, stock sentences, or ERP sku onto the stall popup. The shop already knows who it is.
- Desktop catalog (manager) may show more (shop, category, stock, sku) because managers operate the ERP.
- Demo photos are scraped stand-ins in `media/` (cable.jpg, charger.jpg, airpods.jpg, …). Replace via capture or cloud later. Filename convention for local test: `media/{shop-code}.jpg` when possible; seed currently maps by category image.
- Capture flow exists for managers: camera/file → bind to a new or existing shop code. Bound photo stays in that browser until cloud exists.

---

## 5. End-to-end operational process (canonical)

This is **not** a typical supply-chain factory PO.

1. **WMS low-stock alert**, fed by **Operations** counts (Fiberk shop / hub).
2. Operator **routes a request** to the stall: picture + shop code + requested qty. Channel is **Vendor App and/or WhatsApp**. This is **not** a finalized PO and **not** a PDF invoice.
3. Stall **confirms** qty they have + current price (GHS).
4. **Purchases finalizes the PO** from that confirm (asked vs have, SHORT or CAN FULFIL).
5. **Field Ops** assigns a rider/driver to pick up.
6. **Operations Hub** receives and QAs against the catalog photo.
7. **WMS putaway**. Low-stock alert clears.

Sync rule: WMS is the source of the low-stock signal; Operations feeds WMS counts; catalog supplies identity and photo; Purchases owns the PO after confirm; Field Ops owns the person who collects.

### Confirmation payload (what gets saved)

```json
{
  "ref": "PO-2026-A1",
  "shop": "Avenue Phones",
  "code": "A1",
  "sku": "FBK1829",
  "asked": "20",
  "have": "11",
  "price": "7.00",
  "status": "SHORT",
  "stage": "WMS putaway",
  "at": "2026-09-18T08:30:11.000Z"
}
```

Persistence
- Browser `localStorage` key `df_confirms` — **this PC only**.
- Disk when using `start-local.bat`: `changes/runs/ledger.json` plus one file per reply `changes/runs/YYYY-MM-DD-HHMMSS-CODE.json`.
- Colleague sees confirms **only if those files are inside the zip** and they also run `start-local.bat` (not `file://`).

---

## 6. Roles and surfaces

| Role | Sees |
|------|------|
| Catalog manager | Full catalog module: Summary, Small vendors, Enterprise, Short Codes, Purchase Orders, QR Codes, Capture, Integration, Library, Reports, Setup |
| ERP operator | Summary + Purchase Orders console. Must not need catalog admin. Uses Purchases / Operations / WMS / Field Ops / Communications floors that **read the same confirm feed**. |
| Vendor / field | Vendor App only. Shop dropdown + 4-digit PIN. Own codes only. |

### Color modules
- Supply Chain Catalog — orange `#F5A024` (replaces the old “Catalogue QR” label; QR becomes a heading inside the catalog, not the module name).
- Vendor App — purple `#6D28D9`. Detachable: clicking the pill opens `index.html?app=vendor` in a **new tab** (PWA-capable standalone).
- Field Ops — `#C85A22`
- WMS — `#1B7A62`
- Communications — `#0D1B2A`
- Modules can be turned off under **System → Modules**. Home and System stay on. Apply persists `df_modules` in localStorage.

### Vendor App screens (supplier view)
Bottom nav: Home · Stock · Confirm · Scan · More  
- Stock: 2-column photo grid, big code, optional “description” link.  
- Scan: one code, photo, qty asked / qty have / price, Confirm.  
- Confirm (batch): up to ~10 of **this shop’s** lines, send once.  
- Session: stay logged in across refresh (`df_vendor_shop`, `df_floor`, `df_vscreen`) until **Log out**.  
- Phone frame: 390×844; scroll inside the phone; nav pinned to the bottom.

### Security
- Not bank-grade. Admin sets 4-digit PINs under **System → Vendor PINs**.
- Demo PINs as in the table in §2.
- Field/rider dashboards will share the skin later; they are not built yet. Do not copy BNPL “Suppliers = Tecno/Infinix brand list” into this app — that screenshot was the wrong information architecture.

---

## 7. Wired ERP floors (sandbox)

Clicking Purchases or Operations (left rail rooms) or Communications / Field Ops / WMS (color pills) opens a work floor that lists vendor confirms and an action:

| Floor | Action on a confirm line |
|-------|--------------------------|
| Purchases | Make / finalize PO |
| Operations | Receive at hub |
| WMS | Put away |
| Field Ops | Assign rider |
| Communications | Message shop |

Catalog Purchase Orders also has **Run end-to-end mock** which writes the A1 Avenue example through the full chain.

---

## 8. ERP chrome and layout rules (from the longer ERP sandbox work)

These rules were established across the Fiberk shop mapping and report-sandbox conversations and still apply when the catalog is dropped into the ERP.

- Test **local first** (`start-local.bat` / `start-local.mjs`, port 5500), then the **same folder** is the Vercel root (index.html, js/, css/, api/, vercel.json at top — not nested in `public/`).
- Do not treat a Vercel zip as the finish line.
- No “Delkor-Fiberk” doubled in the header. Correct header is the live ERP header screenshot, not a invented double brand.
- Left menu: match real names. Do not invent headings.
- Accordion chevrons must be large enough to click; user later supplied `chevron-menu-pack.zip` as a setting. Placement/direction of chevrons is a user setting (before-move vs after-move; up/down/left/right). Also 20px and 30px size options were requested.
- BNPL (Hire Purchase) = BNPL Market (Field) → extra dropdown of **real agents** (demo/seed agents removed except currency/qty/product numbers).
- Color-coded module structure: **Summary** (not “Floor”) → other headings/tasks → **Reports** → **Module Setup**.
- Setup ≠ System settings.
- Reports: clicking a row can open a further-details panel below (standardize across reports).
- Fill the width. Do not leave a huge empty right column.
- Preview panes in chat are unreliable; local server is source of truth.

---

## 9. Technical library (PART I–XII) — how the assistant should read it

Source file in workspace: `SOURCE-Technical-Document.html` (and academy-catalog-library copy).

| Part | Title | Use |
|------|-------|-----|
| I | Business Concept & ELI5 | Informal Circle procurement pain, picture+code idea |
| II | Technical Architecture | Catalog platform vs ERP ownership |
| III | Data Schema | Supplier master fields, item codes |
| IV | Procurement & Intake | Physical intake / QA |
| V | Integration API | Two-way: catalog → ERP PO; Hub → catalog goods-received |
| VI | Safeguards | Do not let ERP own images |
| VII | Implementation stack | HTML/CSS/JS, no framework in the sandbox |
| VIII | Network topology | Field vs office |
| IX | Data sequence | Request → confirm → receive |
| X | ERD & RBAC | Manager vs operator vs vendor |
| XI | Runbooks | QA |
| XII | Sign-off | Architecture |

Where conversation **overrides** the original library:
- Public code is stall code, not a Fiberk-invented hyphen code.
- PO is finalized **after** vendor confirm, not generated as step 2.
- Enterprise suppliers are excluded from the Vendor App.
- QR is a heading, not the product name.
- Settings live in System; Setup is page-local.

---

## 10. Data sources in the workspace

| Path | What it is |
|------|------------|
| `attachments/products-delkor-ii-fiberk.json` | ERP product master (~4294 items: sku, name, brand, legacy_cat, loc, stock, sell) |
| `attachments/products.html` | Older products UI snapshot |
| `BUSINESS-CONCEPT-ELI5-SPECIFICATION/` | Current catalog + Vendor App sandbox |
| `BUSINESS CONCEPT & ELI5 SPECIFICATION/` | Earlier folder name (ampersand); prefer the hyphenated folder |
| `academy-catalog-library/` | Library under Academy color module (earlier pass) |
| `erp-report-sandbox/` | Report engine sandbox (HTML/CSS/JS/JSON, Chart.js, mock templates) |
| `delkor-fiberk-master/` | Master ERP chrome drop pack notes |
| `fiberk-shop-inventory.html` / `wh-shop-01-inventory.html` | Earlier Fiberk shop floor maps (A01/A02 sections, camera-visible layout). Shop sells accessories not spare parts; leakages were the reason for inventory software. |
| `changes/CHANGELOG.md` and `changes/runs/` | Dated sandbox notes and saved vendor confirms |
| Uploaded screenshots | Live ERP: Hub board, WMS floor, All Purchases grid, Communications floor, Purchases child menu, BNPL-style mobile skin (skin only), chevron menus, modules settings |

Seed catalog in `index.html` is ~50 accessory lines plus a few dual-shop clones (~58 rows), small-vendor filtered in Vendor App and picture grid.

Categories represented: phone cables, chargers, power banks, wireless earphones, smart watches, car accessories, storage, laptop chargers, gadgets, etc.

---

## 11. Local run (required for pictures, PWA, saved confirms)

```
start-local.bat
http://localhost:5500/
http://localhost:5500/index.html?app=vendor
```

Needs Node. `file://` breaks images sometimes, cannot register the service worker, and cannot write `changes/runs`.

PWA: `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png`. Install from localhost.

---

## 12. Decisions log (conversation, condensed)

1. Fiberk shop only for this mapping; occasional phone sale; accessories dominant.  
2. Layout must be readable from a security camera (early shop map).  
3. Build own inventory/ERP software; sandbox first; no “if you want…” scope creep.  
4. Catalogue QR expanded and **renamed Supply Chain Catalog**; QR is a child heading.  
5. Standalone catalog, two-way ERP plug; short code is the join.  
6. Picture catalog; images not in ERP DB.  
7. Capture + future vendor scan app.  
8. ERP users use one console; catalog managers get admin.  
9. Modules on/off under System, not catalog Settings.  
10. Seed ~50 real products from Fiberk JSON; temp web images.  
11. Colleague pack must make sense without the chat.  
12. Digital supplier confirm = code + qty + price, not an invoice file.  
13. Batch confirm up to 10 to avoid scan fatigue.  
14. Remove extra Close buttons on phone.  
15. Public codes = stall-familiar; survey before lock.  
16. Max 4-character letter+number codes.  
17. Vendor App is its own color module + PIN.  
18. Split enterprise vs small vendors.  
19. Real field-app mobile skin; BNPL phrases removed.  
20. Phone-sized frame; PWA; `changes/` then `changes/runs` for actual confirm files.  
21. Ledger travels in the zip; localStorage does not.  
22. Photo-first stock grid; description optional.  
23. Persist login until logout; popup description; click outside to close.  
24. Popup = bold name only.  
25. Vendor App opens in a new tab.  
26. Wire Purchases, Operations, Field Ops, Communications, WMS to the confirm feed.  
27. Canonical process: WMS alert → App/WA packet → confirm → finalize PO → rider → hub → putaway.

---

## 13. What the assistant must never do

- Recommend showing Fiberk SKUs to stalls as the working code.  
- Put Settings on the catalog right pane.  
- Build Vendor App features for Franko / Oraimo / Electroland.  
- Generate a finished PO before the stall confirms.  
- Send PDF invoices as the primary stall packet.  
- Use BuyNowPaysLater product names, “Spend today pay tomorrow”, or brand lists (Tecno/Infinix/Itel) as this catalog’s information architecture.  
- Invent menu labels that are not in the real ERP screenshots.  
- Claim live Supabase / production APIs exist in this pack — they are mocked.  
- Forget an easy close on every popup.  
- Kick a logged-in vendor back to login on refresh.

---

## 14. Suggested RAG chunks for the local model

Index these headings as separate chunks: §0–§7, §5 process, §3 identity, §2 tracks, §12 decisions, §13 never-do. Attach `changes/runs/ledger.json` as live examples when present. Attach product JSON only as ERP master_sku evidence, not as stall codes.

---

## 15. Sign-off line for the assistant

You are helping Delkor-Fiberk staff reason about the **Supply Chain Catalog**: a picture + stall code system for small Circle vendors, internally joined to Fiberk `master_sku`, with WMS-origin low stock, confirm-before-PO, then rider pickup. When unsure, prefer the stall’s short code and the photo.
