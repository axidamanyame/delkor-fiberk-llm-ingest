# START HERE — you are an assistant

If you just opened this zip, read **`ATTACH-ME.md` first** (hard stop: do not ask the founder to copy files onto a PC). Then come back here.

The founder attached this zip so **three projects move in lock-step**.
You are one of those assistants. This is not a PC install. This is not a Vercel deploy.

**Do not ask the founder to drop files into `ollama-electron` or any other folder on their computer.**
KorBek is not being built in that folder yet. If you need knowledge, **you** read this pack.

Last updated: 2026-09-20

---

## 1. Which of the three projects are you?

| # | Project | You do | You do not |
|---|---|---|---|
| 1 | **Delkor-Fiberk ERP** | Vanilla HTML/JS, teal heading, floors, reports-as-documents, back office | Rebuild as React. Store product photos. Mix in Catalog stall UX or the field PWA |
| 2 | **Supply Chain Catalog** | Picture catalog, Vendor App, stall codes, two supplier tracks, image cloud | Put photos in the ERP. Tell a stall to search `FBK1829`. Mix enterprise vendors into the PIN app |
| 3 | **KorBek AI** | Load this pack as knowledge. Answer from the map. Propose ERP writes | Claim live Supabase writes. Mix the products. Send the founder a hunt list or a PC copy step |

BNPL field apps (`FieldSales.PWA`, monitoring, agentops) already live on GitHub. They are **not** one of these three. Do not absorb them.

If you are unsure which you are: read `PROJECTS.md`, then `LOCKSTEP.md`, then stop and stay in your lane.

---

## 2. Load order (do this yourself)

1. **`ATTACH-ME.md`** — hard stop. This zip is the briefing.
2. **`PROJECTS.md`** — which product is which.
3. **`LOCKSTEP.md`** — the contract the three of you share. Frozen rules. Who owns what.
4. **`WHAT-WE-BUILT.md`** — what the ERP workspace already shipped. Do not redo it. Do not contradict it.
5. Your lane:
   - ERP → `ERP-CONSTITUTION.md` + `LLM-HANDOFF.md` + `erp/`
   - Catalog → `catalog/SUPPLY-CHAIN-CATALOG-MASTER-TRAINING.md` + `catalog/sku-evidence.json`
   - KorBek → all of the above as retrieval. `agents/AGENTS.korbek.md` is your project instructions.
6. Optional: `FILEMAP.md` when you need a file. `erp/` is sanitized source (keys redacted, no photos).

Code + these docs **beat old chat**. Empty is empty.

---

## 3. Hard lines every assistant keeps

- Stall sees **A1**. ERP sees **FBK1829**. Never tell Avenue to search the master SKU.
- Photos live on the Catalog image cloud. Never dump them into the ERP.
- ERP Reports are **read-only documents** (items-card / sheets). No Actions tables, empty Record modals, or charts.
- Keep the teal heading. Colour modules: Summary → topics → Reports → Setup.
- Staff stay on their floor. Academy KB stays empty until HQ writes. Bell is unread-only and persists.
- Founder tests the ERP folder on the computer, then uploads **that same folder** to Vercel. A zip is not the ERP finish line.
- **No secrets** in anything you publish. No `service_role`, JWTs, staff phones, bank files, live Supabase keys.
- Founder time is scarce. Produce the drop. Do not send a hunt list. Do not invent a PC copy step.

---

## 4. Project-instruction files you may copy

If your Grok workspace has `AGENTS.project.md`, replace it with the matching file:

- ERP workspace → `agents/AGENTS.erp.md`
- Catalog workspace → `agents/AGENTS.catalog.md`
- KorBek workspace → `agents/AGENTS.korbek.md`

Then keep `PROJECTS.md` and `LOCKSTEP.md` next to it.

Public clone of this pack: https://github.com/axidamanyame/delkor-fiberk-llm-ingest
