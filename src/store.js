const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const INDEX_FILE = path.join(DATA_DIR, 'index.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function load() {
  if (!fs.existsSync(INDEX_FILE)) return { channels: {}, records: {} };
  try {
    return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
  } catch {
    return { channels: {}, records: {} };
  }
}

const state = load();

function save() {
  // Atomic-ish write: write to a temp file then rename, so a crash mid-write
  // can't leave a corrupt index.json behind.
  const tmpFile = `${INDEX_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(state));
  fs.renameSync(tmpFile, INDEX_FILE);
}

module.exports = {
  getChannelId(table) {
    return state.channels[table] || null;
  },
  setChannelId(table, channelId) {
    state.channels[table] = channelId;
    save();
  },
  upsertRecord(table, key, messageId, data) {
    if (!state.records[table]) state.records[table] = {};
    state.records[table][key] = { messageId, data, updatedAt: Date.now() };
    save();
  },
  getRecord(table, key) {
    const row = state.records[table]?.[key];
    if (!row) return null;
    return { key, data: row.data, updatedAt: row.updatedAt, messageId: row.messageId };
  },
  listRecords(table) {
    const rows = state.records[table] || {};
    return Object.entries(rows)
      .map(([key, row]) => ({ key, data: row.data, updatedAt: row.updatedAt, messageId: row.messageId }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
  deleteRecord(table, key) {
    if (state.records[table]) delete state.records[table][key];
    save();
  },
  listTables() {
    return Object.keys(state.channels);
  },
};
