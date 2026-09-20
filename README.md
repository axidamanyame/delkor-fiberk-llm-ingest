# Delkor-Fiberk — lock-step pack for other assistants

This zip / repo brings **other assistants** up to speed on what the ERP workspace built, so **three projects** (ERP, Supply Chain Catalog, KorBek AI) move in lock-step.

It is **not** a Vercel deploy. It is **not** an ollama-electron install. It is **not** a substitute for the live ERP folder.

The founder attaches this zip in the other Grok chats. Assistants read it themselves.

---

## Founder (one sitting)

1. Attach this zip in the Catalog chat and the KorBek chat.
2. Say: `Read START-HERE.md. Stay in lock-step with this pack.`

That is the whole job. Do not copy this onto a PC.

Public clone: https://github.com/axidamanyame/delkor-fiberk-llm-ingest

---

## Assistants (do this)

1. **`START-HERE.md`** — which of the three you are, and what you must not ask the founder to do.
2. **`PROJECTS.md`** — which product is which.
3. **`LOCKSTEP.md`** — shared contract, owners, frozen rules.
4. **`WHAT-WE-BUILT.md`** — ERP snapshot. Do not redo it.
5. Your lane: ERP constitution + `erp/`, or `catalog/` training, or both if you are KorBek.
6. If chat and code disagree: **code + these docs win**.

Copy `agents/AGENTS.*.md` into your workspace `AGENTS.project.md` if you have one.

---

## What this pack is

| Path | Why it is here |
|---|---|
| `FOR-FOUNDER.txt` | The only founder steps: attach this zip to the other two chats. |
| `START-HERE.md` | Assistant entry. Read first. |
| `LOCKSTEP.md` | Contract between the three projects. |
| `WHAT-WE-BUILT.md` | What the ERP already shipped. |
| `PROJECTS.md` | Shared map. |
| `SYSTEM-PROMPT.md` / `ERP-CONSTITUTION.md` | Hard rules. |
| `LLM-HANDOFF.md` | Longer ERP constitution. |
| `FILEMAP.md` | What each important file does. |
| `INGEST-GLOBS.txt` | Exact globs for an indexer. |
| `agents/` | Drop-in project instructions per lane. |
| `catalog/` | Master Catalog training + sku evidence (Avenue / FBK1829 → A1). |
| `erp/` | Sanitized site: HTML, JS, CSS, SQL, start-local, api. Keys redacted. No photos. |

## What was left out on purpose

- Product photos (`uploads/fk-catalog`)
- Bank statements, Easybuy books, customer / user CSVs
- `.env`, live Supabase publishable keys (replaced with placeholders)
- Patch zips and `node_modules`
- Secrets. Do not train on passwords, JWTs, or staff phones.

To **run** the ERP on a computer, use the live folder (start-local.bat → login.html), not this pack.
