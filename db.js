// Storage layer. SQLite file on disk — persistent on Render/Railway/Fly/VPS.
// Swap this file's internals for a hosted DB if deploying to Vercel.

const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const listsData = require("./data/lists.json");

const DB_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DB_DIR, "state.db");

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS item_state (
    list_id TEXT NOT NULL,
    item_key TEXT NOT NULL,
    checked INTEGER NOT NULL DEFAULT 0,
    checked_by TEXT DEFAULT '',
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (list_id, item_key)
  );
`);

const upsertStmt = db.prepare(`
  INSERT INTO item_state (list_id, item_key, checked, checked_by, updated_at)
  VALUES (@list_id, @item_key, @checked, @checked_by, datetime('now'))
  ON CONFLICT(list_id, item_key) DO UPDATE SET
    checked = excluded.checked,
    checked_by = excluded.checked_by,
    updated_at = excluded.updated_at
`);

const getStatesStmt = db.prepare(`
  SELECT item_key, checked, checked_by, updated_at
  FROM item_state WHERE list_id = ?
`);

const deleteListStmt = db.prepare(`DELETE FROM item_state WHERE list_id = ?`);

function itemKeyFor(sectionIdx, itemIdx) {
  return `${sectionIdx}_${itemIdx}`;
}

function getList(listId) {
  const base = listsData[listId];
  if (!base) return null;

  const states = getStatesStmt.all(listId);
  const stateMap = {};
  for (const row of states) {
    stateMap[row.item_key] = {
      checked: !!row.checked,
      checkedBy: row.checked_by || "",
      updatedAt: row.updated_at
    };
  }

  let total = 0;
  let done = 0;
  const sections = base.sections.map((section, sectionIdx) => {
    const items = section.items.map(([name, qty], itemIdx) => {
      const key = itemKeyFor(sectionIdx, itemIdx);
      const st = stateMap[key] || { checked: false, checkedBy: "", updatedAt: null };
      total++;
      if (st.checked) done++;
      return { key, name, qty, ...st };
    });
    return { category: section.category, items };
  });

  return {
    id: listId,
    title: base.title,
    subtitle: base.subtitle,
    total,
    done,
    sections
  };
}

function setItemState(listId, itemKey, checked, by) {
  if (!listsData[listId]) throw new Error("Unknown list");
  upsertStmt.run({
    list_id: listId,
    item_key: itemKey,
    checked: checked ? 1 : 0,
    checked_by: checked ? by : ""
  });
  return { ok: true, itemKey, checked, by };
}

function resetList(listId) {
  deleteListStmt.run(listId);
  return { ok: true };
}

function getListMeta(listId) {
  return listsData[listId] || null;
}

module.exports = { getList, setItemState, resetList, getListMeta };
