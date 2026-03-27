const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_PATH || path.join(__dirname, '..', 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getConfig() {
  ensureDataDir();
  if (!fs.existsSync(CONFIG_FILE)) return null;
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
}

function saveConfig(data) {
  ensureDataDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
}

function isConfigured() {
  const config = getConfig();
  return config && config.apiId && config.apiToken;
}

function getUsers() {
  ensureDataDir();
  if (!fs.existsSync(USERS_FILE)) return [];
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function saveUsers(users) {
  ensureDataDir();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function findUser(email) {
  return getUsers().find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
}

function upsertUser(user) {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === user.id);
  if (idx >= 0) users[idx] = user;
  else users.push(user);
  saveUsers(users);
}

function deleteUser(id) {
  const users = getUsers().filter(u => u.id !== id);
  saveUsers(users);
}

module.exports = { getConfig, saveConfig, isConfigured, getUsers, saveUsers, findUser, upsertUser, deleteUser };
