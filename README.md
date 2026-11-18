# सामग्री सूची — Shared Shopping Checklist

A small web app with a home page showing 3 lists:
- राशन व हलवाई सूची (Ration & Halwai order)
- एकादशी उद्यापन सामग्री (Ekadashi Udyapan Samagri)
- सत्यनारायण उद्यापन सामग्री (Satyanarayan Udyapan Samagri)

Open a list, tap an item to mark it bought (it asks your name once per
device, so everyone can see who bought what) — tap again to undo.
State is stored on the server (SQLite), so **every device sees the same
list, with no login required.**

## Run locally

```bash
npm install
npm start
```

Open http://localhost:3000

## Deploy

This app needs a host with a **persistent filesystem** because it stores
data in a SQLite file (`data/state.db`). Good, free-tier-friendly options:

### Render.com (recommended, easiest)
1. Push this folder to a GitHub repo.
2. On Render: New → Web Service → connect the repo.
3. Build command: `npm install`
4. Start command: `npm start`
5. Add a **persistent disk** mounted at `/opt/render/project/src/data`
   (Render → your service → Disks) so the SQLite file survives restarts.
6. Deploy — you get a public URL, no login needed for anyone who opens it.

### Railway.app
1. Push to GitHub, then "New Project" → "Deploy from GitHub repo".
2. Railway auto-detects Node. Add a **volume** mounted at `/app/data`
   (Settings → Volumes) so `data/state.db` persists across deploys.
3. Deploy — you get a public URL.

### Fly.io / a VPS
Any host that gives you a normal persistent disk works the same way —
just make sure the `data/` folder is on persistent storage.

### ⚠️ Vercel will NOT work as-is
Vercel's serverless functions have a **read-only, ephemeral**
filesystem — every write to `data/state.db` disappears on the next
request/cold start, so items would un-check themselves randomly. If you
want to deploy to Vercel specifically, swap the storage layer in `db.js`
for a hosted database (Vercel KV, Vercel Postgres, Supabase, etc.) — the
routes in `server.js` and the whole frontend stay exactly the same,
only `db.js`'s internals change.

## Editing the lists

All item data lives in `data/lists.json` — edit names/quantities there
any time; no code changes needed. Add a 4th list by adding a new key
there and to the `LIST_CATALOGUE` array in `server.js`.

## How the "every device" sync works

- Checking/unchecking an item sends a request to the server, which
  saves it in SQLite immediately.
- Every open tab polls the server every 5 seconds and refreshes, so
  changes someone else makes show up automatically within a few seconds.
- No accounts: the app just asks for a display name once (stored in
  that browser's localStorage) so it can show "✓ Mayank ने लिया" next
  to items — it is not used for access control.
