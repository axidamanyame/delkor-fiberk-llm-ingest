# Delkor-Fiberk LLM ingest pack

This zip / repo is the **knowledge pack** for our own AI LLM.
It is not a Vercel deploy and it is not a substitute for the live ERP folder.

Drop this next to your model. Do not make the founder hunt files.

---

## Load order (do this)

1. Put **`PROJECTS.md` first** — which product is which (ERP vs KorBek vs Catalog vs BNPL vs this pack).
2. Put `SYSTEM-PROMPT.md` / `ERP-CONSTITUTION.md` in the model’s **system / constitution** slot.
3. Index the `erp/` tree as retrieval (RAG). Use `INGEST-GLOBS.txt`.
4. Later, drop Grok chat export JSON into `chat-export/` (see `CHAT-EXPORT.md`).
5. If chat and code disagree: **code + PROJECTS.md + SYSTEM-PROMPT win**. Chat is how we got here.

## What this pack is

| Path | Why it is here |
|---|---|
| `PROJECTS.md` | Shared map for every assistant. Read this first. |
| `SYSTEM-PROMPT.md` | Paste this. Owner rules that override generic ERP habits. |
| `ERP-CONSTITUTION.md` | Same rules, KorBek knowledge filename. |
| `LLM-HANDOFF.md` | Longer constitution: floors, reports, people, files. |
| `CHAT-EXPORT.md` | How to add full Grok history without the founder hunting. |
| `FILEMAP.md` | What each important file does. |
| `INGEST-GLOBS.txt` | Exact globs for your indexer. |
| `erp/` | Sanitized site: HTML, JS, CSS, SQL, start-local, api. |

## What was left out on purpose

- Product photos (`uploads/fk-catalog`)
- Bank statements, Easybuy books, customer / user CSVs
- `.env`, live Supabase publishable keys (replaced with placeholders)
- Patch zips and `node_modules`
- Secrets. Do not train on passwords, JWTs, or staff phones.

To **run** the ERP on a computer, use the live folder (start-local.bat → login.html), not this pack.

KorBek on the PC: copy `PROJECTS.md` + `ERP-CONSTITUTION.md` into `C:\Users\delko\ollama-electron\knowledge\` and overwrite `knowledge.js` so Electron actually loads them.

## Git

Public clone (same contents as this zip):

https://github.com/axidamanyame/delkor-fiberk-llm-ingest
