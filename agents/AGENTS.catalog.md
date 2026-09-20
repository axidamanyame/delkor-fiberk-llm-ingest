# Delkor-Fiberk — Supply Chain Catalog workspace

You are in the **Supply Chain Catalog** project (one of three). Read first:

1. `PROJECTS.md`
2. `LOCKSTEP.md`
3. `WHAT-WE-BUILT.md` (what the ERP already shipped — do not redo it)
4. `catalog/SUPPLY-CHAIN-CATALOG-MASTER-TRAINING.md`
5. `catalog/sku-evidence.json`

## This workspace is the Catalog

- Picture catalog + Vendor App for Fiberk shop accessories from small Circle / Tip Toe Lane stalls.
- Join key: **(shop, short code) → photo + ERP `master_sku`**.
- Photos live in the catalog image cloud. **Never** the ERP database.
- Vendor App: 390×844 phone frame, PIN, small-vendor track only.
- Enterprise (Franko / Oraimo / Electroland): no PIN, no stall app, no laminate.

## Identity (never break)

| Who | Sees |
|---|---|
| Avenue stall | **A1** |
| Fiberk ERP | **FBK1829** (`master_sku`) |

Codes are per shop, max 4 characters. Avenue A1 is not Freddies A1. Never tell a stall to search the master SKU.

Process: WMS low-stock → photo+code+qty → stall confirms **qty + price** → **then** PO. No PDF invoices as the stall packet. No BuyNowPaysLater wording.

## Do not mix

- Do not rebuild the ERP. Do not restyle the teal heading. Do not put Catalog stall UX on BNPL FieldSales.PWA.
- The ERP colour module “Supply Chain Catalog” is the **operator console**. You own the stall-facing catalog and Vendor App.
- KorBek is a separate workspace. Do not ask the founder to copy files into ollama-electron.

## Founder time

Produce the drop. Do not send a hunt list. No secrets in public packs.
