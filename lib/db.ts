import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_PATH = process.env.DATA_PATH || './data';
const DB_PATH = path.join(DATA_PATH, 'homepage.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_PATH)) {
  fs.mkdirSync(DATA_PATH, { recursive: true });
}

// Initialize database connection
const db = new Database(DB_PATH, {
  verbose: process.env.LOG_LEVEL === 'DEBUG' ? console.log : undefined,
});

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

/**
 * Get database instance
 */
export function getDb() {
  return db;
}

/**
 * Close database connection (for graceful shutdown)
 */
export function closeDb() {
  db.close();
}

/**
 * Execute a migration SQL file
 */
export function executeMigration(sql: string) {
  db.exec(sql);
}

/**
 * Check if a table exists
 */
export function tableExists(tableName: string): boolean {
  const result = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
    )
    .get(tableName);
  return !!result;
}

/**
 * Get all users (for onboarding check)
 */
export function getUserCount(): number {
  const result = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  return result.count;
}

export default db;
