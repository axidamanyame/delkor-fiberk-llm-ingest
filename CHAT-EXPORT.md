# Adding Grok chat history (founder, one sitting)

The code in `erp/` is what is true. Chat is the owner’s “why.” Put the JSON in `chat-export/` and point your indexer at that folder.

## This thread only

On grok.com: Share (top right) → copy link.

Revoke later: https://grok.com/share-links

Do not post that link on the open web if the thread ever had logins, keys, or customer data. Treat it as internal even if the code repo is public.

## All Grok chats (what the model actually needs)

1. Open https://accounts.x.ai/data (or grok.com → profile → Settings → Data).
2. Request Download account data.
3. Wait for the email, download the ZIP/JSON.
4. Copy the conversations file into this pack:

```
chat-export/grok-conversations.json
```

That file is the full back-and-forth across ERP work: reports as documents, colour floors, chevrons, notifications, Academy empty-until-HQ, staff stay on their floor.

## After it is in the folder

Re-run your ingest. Do not fine-tune on secrets if they appear in old chats — strip passwords, keys, and bank files first.

If chat says one thing and `erp/` plus SYSTEM-PROMPT.md say another, follow the code and the prompt.
