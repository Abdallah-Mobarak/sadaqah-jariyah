// Simple JSON-backed data store — no native libraries.
// Writes safely (temp file then rename) and loads into memory at startup.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const DEFAULT = { deceased: [], duas: [] };

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT, null, 2), 'utf8');
  }
}

let cache = null;

function load() {
  ensure();
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    console.error('Could not read the database, starting fresh:', e.message);
    cache = JSON.parse(JSON.stringify(DEFAULT));
  }
  if (!cache.deceased) cache.deceased = [];
  if (!cache.duas) cache.duas = [];
  return cache;
}

function save() {
  ensure();
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2), 'utf8');
  fs.renameSync(tmp, DB_FILE); // atomic op to avoid corrupting the file
}

function id() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ===== Deceased =====
function addDeceased({ name, bio, photo, deeds }) {
  const db = load();
  const item = {
    id: id(),
    name: String(name || '').trim(),
    bio: String(bio || '').trim(),
    photo: photo || null,
    deeds: Array.isArray(deeds) ? deeds : [],
    status: 'pending',
    readCount: 0,
    prayCount: 0,
    createdAt: new Date().toISOString(),
  };
  db.deceased.unshift(item);
  save();
  return item;
}

function getDeceased(idVal) {
  return load().deceased.find((d) => d.id === idVal) || null;
}

function listDeceased(status) {
  const all = load().deceased;
  if (!status) return all;
  return all.filter((d) => d.status === status);
}

function setStatus(idVal, status) {
  const d = getDeceased(idVal);
  if (!d) return null;
  d.status = status;
  save();
  return d;
}

// Update a deceased's fields (admin only) — only allowed fields are changed
function updateDeceased(idVal, fields) {
  const d = getDeceased(idVal);
  if (!d) return null;
  if (typeof fields.name === 'string' && fields.name.trim()) d.name = fields.name.trim();
  if (typeof fields.bio === 'string') d.bio = fields.bio.trim();
  if (Array.isArray(fields.deeds)) d.deeds = fields.deeds;
  if (typeof fields.status === 'string') d.status = fields.status;
  if (fields.photo !== undefined) d.photo = fields.photo; // null removes the photo, or a new path
  save();
  return d;
}

function removeDeceased(idVal) {
  const db = load();
  const i = db.deceased.findIndex((d) => d.id === idVal);
  if (i === -1) return false;
  db.deceased.splice(i, 1);
  db.duas = db.duas.filter((x) => x.deceasedId !== idVal);
  save();
  return true;
}

function incr(idVal, field) {
  const d = getDeceased(idVal);
  if (!d) return null;
  d[field] = (d[field] || 0) + 1;
  save();
  return d[field];
}

// ===== Duas =====
function addDua({ deceasedId, name, text }) {
  const db = load();
  const item = {
    id: id(),
    deceasedId: deceasedId || null,
    name: String(name || 'مجهول').trim().slice(0, 40) || 'مجهول',
    text: String(text || '').trim().slice(0, 500),
    likes: 0,
    createdAt: new Date().toISOString(),
  };
  if (!item.text) return null;
  db.duas.unshift(item);
  save();
  return item;
}

function listDuas(deceasedId) {
  const all = load().duas;
  if (deceasedId === undefined) return all;
  return all.filter((x) => x.deceasedId === deceasedId);
}

function removeDua(idVal) {
  const db = load();
  const i = db.duas.findIndex((x) => x.id === idVal);
  if (i === -1) return false;
  db.duas.splice(i, 1);
  save();
  return true;
}

function likeDua(idVal) {
  const dua = load().duas.find((x) => x.id === idVal);
  if (!dua) return null;
  dua.likes = (dua.likes || 0) + 1;
  save();
  return dua.likes;
}

function unlikeDua(idVal) {
  const dua = load().duas.find((x) => x.id === idVal);
  if (!dua) return null;
  dua.likes = Math.max(0, (dua.likes || 0) - 1);
  save();
  return dua.likes;
}

module.exports = {
  addDeceased, getDeceased, listDeceased, setStatus, updateDeceased, removeDeceased, incr,
  addDua, listDuas, removeDua, likeDua, unlikeDua,
};
