import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'rice_prices.db');

let dbInstance;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function initializeSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_date TEXT NOT NULL,
      product_name TEXT NOT NULL,
      price REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (sale_date, product_name)
    );
  `);
}

export function getDb() {
  if (!dbInstance) {
    ensureDataDir();
    dbInstance = new Database(DB_PATH);
    initializeSchema(dbInstance);
  }

  return dbInstance;
}
