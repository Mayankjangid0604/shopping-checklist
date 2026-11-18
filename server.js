// Samagri List App — shared checklist server
// Three lists (Ration, Ekadashi Udyapan, Satyanarayan Udyapan).
// Anyone with the link can open a list and tick/untick items; the state
// is stored server-side in SQLite so every device sees the same thing,
// with no login required.
//
// IMPORTANT DEPLOYMENT NOTE:
// This uses a SQLite file on disk for storage. That works great on hosts
// with a persistent filesystem (Render, Railway, Fly.io, a VPS, etc).
// It will NOT persist on Vercel, because Vercel's serverless functions
// have a read-only/ephemeral filesystem — every write would vanish on
// the next cold start. If you deploy to Vercel, swap the storage layer
// in db.js for a hosted database (Vercel KV / Postgres / Supabase) —
// the rest of the app (routes, frontend) does not need to change.

const express = require("express");
const path = require("path");
const { getList, setItemState, resetList, getListMeta } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// List catalogue for the home page
const LIST_CATALOGUE = [
  { id: "ration", label: "राशन व हलवाई सूची", sub: "Ration & Halwai Order" },
  { id: "ekadashi", label: "एकादशी उद्यापन सामग्री", sub: "Ekadashi Udyapan Samagri" },
  { id: "satyanarayan", label: "सत्यनारायण उद्यापन सामग्री", sub: "Satyanarayan Udyapan Samagri" }
];

app.get("/api/lists", (req, res) => {
  res.json(LIST_CATALOGUE);
});

// Get a list with its items + current checked state + who/when checked
app.get("/api/lists/:listId", (req, res) => {
  const { listId } = req.params;
  try {
    const data = getList(listId);
    if (!data) return res.status(404).json({ error: "List not found" });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Toggle / set an item's bought state
// body: { checked: boolean, by: string (optional name of whoever is buying) }
app.post("/api/lists/:listId/items/:itemKey", (req, res) => {
  const { listId, itemKey } = req.params;
  const { checked, by } = req.body || {};
  if (typeof checked !== "boolean") {
    return res.status(400).json({ error: "checked (boolean) is required" });
  }
  try {
    const result = setItemState(listId, itemKey, checked, by || "");
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Reset all items in a list back to not-bought
app.post("/api/lists/:listId/reset", (req, res) => {
  const { listId } = req.params;
  try {
    resetList(listId);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Samagri list app running on http://localhost:${PORT}`);
});
