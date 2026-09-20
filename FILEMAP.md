# File map — what to retrieve first

Start here when the model needs to change or explain a surface.

## Shell and people

| File | Role |
|---|---|
| `erp/public/js/ultimate-shell.js` | Header, left rail, SPA, bell, nav, chevrons on the real menu |
| `erp/public/css/ultimate-pos.css` | Teal heading, sidebar, cards |
| `erp/public/login.html` | Welcome / sign-in |
| `erp/public/js/supabaseClient.js` | Auth session, demo vs live (keys redacted in this pack) |
| `erp/public/js/rbac.js` | Permissions, page access |
| `erp/public/js/staff-jobs.js` | Job vs security role |
| `erp/public/js/job-catalog.js` | Delkor jobs |
| `erp/public/js/access-rules.js` | HQ / owner / floor rules |
| `erp/public/dashboard.html` | Home — HQ vs staff floor |

## Reports (documents, not lists)

| File | Role |
|---|---|
| `erp/public/reports.html` | Reports page |
| `erp/public/js/report-boot.js` | Boots sandbox look inside the live shell |
| `erp/public/js/sandbox.js` | Landing grouped list, items-card, purchase/sell sheets |
| `erp/public/css/sandbox.css` | items-page, blue-tbl, mod-tabs, kpi-grid |
| `erp/public/js/record-view.js` | PIN-00475-style product sheet, purchase sheet |
| `erp/public/js/reports-hub.js` | Older painter — do not put listing tables back |

## Colour modules

| File | Role |
|---|---|
| `erp/public/js/module-floor.js` | Summary → topics → Reports → Setup |
| `erp/public/js/hub-kit.js` | Floor nav: mod-tabs, mod-chip, kpi-grid |
| `erp/public/js/module-books.js` | Per-module report/setup links (stay off ERP Reports) |
| `erp/public/js/chevron.js` | Chevron family, size, placement on the live rail |
| `erp/public/settings.html` | Business Settings including Chevron styles |

## Inbox, Academy, staff

| File | Role |
|---|---|
| `erp/public/js/inbox.js` | Bell persist Clear / Mark all read |
| `erp/public/js/academy-hub.js` | Academy — empty manuals until HQ writes |
| `erp/public/js/essentials-hub.js` | KB must stay unseeded |
| `erp/public/js/staff-manuals.js` | `STAFF_MANUALS = []` |
| `erp/public/js/ai-assist.js` | No dumped staff manuals |
| `erp/public/js/chatbot.js` | Same |
| `erp/public/js/desk-manual.js` | Same |

## SQL and run

| File | Role |
|---|---|
| `erp/*.sql` and `erp/public/sql/` | Who-is-who, RLS, roles, modules, tills |
| `erp/start-local.bat` | Founder’s computer (port 5500, login.html) |
| `erp/vercel.json` | Same folder to Vercel |
| `erp/api/ai.js` | `/api/ai` |

Reports URLs: `/reports.html`, `?t=pp` product purchase, `?t=items` items card, `?t=sell` sell sheet, collections `?t=col-age` … Module reports stay on that module’s Reports heading.
