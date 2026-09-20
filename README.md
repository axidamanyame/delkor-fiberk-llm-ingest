# Delkor-Fiberk — lock-step pack for other assistants

This zip / repo brings **other assistants** up to speed on what the ERP workspace built, so **three projects** (ERP, Supply Chain Catalog, KorBek AI) move in lock-step.

It is **not** a Vercel deploy. It is **not** an ollama-electron install. It is **not** a substitute for the live ERP folder.

The founder attaches this zip in the other Grok chats. Assistants read it themselves.

---

## Founder (one sitting)

1. Attach this zip in the Catalog chat and the KorBek chat.
2. Paste the sentence in `PASTE-THIS.txt`.

That is the whole job. Do not copy this onto a PC.

Public clone: https://github.com/axidamanyame/delkor-fiberk-llm-ingest

---

## Assistants (do this)

1. **`ATTACH-ME.md`** — hard stop. This zip is the briefing. Do not ask for a PC copy.
2. **`START-HERE.md`** — which of the three you are.
3. **`PROJECTS.md`** — which product is which.
4. **`LOCKSTEP.md`** — shared contract, owners, frozen rules.
5. **`WHAT-WE-BUILT.md`** — ERP snapshot. Do not redo it.
6. Your lane: ERP constitution + `erp/`, or `catalog/` training, or both if you are KorBek.
7. If chat and code disagree: **code + these docs win**.

Copy `agents/AGENTS.*.md` into your workspace `AGENTS.project.md` if you have one.

---

## What this pack is

| Path | Why it is here |
|---|---|
| `ATTACH-ME.md` | First file every other assistant reads. |
| `PASTE-THIS.txt` | The one sentence the founder pastes in the other two chats. |
| `FOR-FOUNDER.txt` | Attach this zip. That is the whole job. |
| `START-HERE.md` | Assistant entry after ATTACH-ME. |
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
- Any “copy this into ollama-electron” install. That workspace is not open.

To **run** the ERP on a computer, use the live folder (start-local.bat → login.html), not this pack.
