#!/usr/bin/env node

/**
 * Database Migration Runner
 *
 * Executes SQL migration files in order.
 * This can be run manually via `npm run db:migrate`
 * or automatically on application startup.
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_PATH = process.env.DATA_PATH || './data';
const DB_PATH = path.join(DATA_PATH, 'homepage.db');
const MIGRATIONS_DIR = __dirname;

// Ensure data directory exists
if (!fs.existsSync(DATA_PATH)) {
  fs.mkdirSync(DATA_PATH, { recursive: true });
}

// Initialize database
const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

// Create migrations tracking table
db.exec(`
  CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    executed_at TEXT DEFAULT (datetime('now'))
  );
`);

/**
 * Get list of executed migrations
 */
function getExecutedMigrations() {
  const rows = db.prepare('SELECT name FROM _migrations ORDER BY id').all();
  return rows.map(row => row.name);
}

/**
 * Mark migration as executed
 */
function markMigrationExecuted(name) {
  db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(name);
}

/**
 * Get all SQL migration files in order
 */
function getMigrationFiles() {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(file => file.endsWith('.sql'))
    .sort();
  return files;
}

/**
 * Execute a single migration
 */
function executeMigration(filename) {
  const filepath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filepath, 'utf-8');

  console.log(`🔄 Executing migration: ${filename}`);

  try {
    db.exec(sql);
    markMigrationExecuted(filename);
    console.log(`✅ Migration completed: ${filename}`);
  } catch (error) {
    console.error(`❌ Migration failed: ${filename}`);
    console.error(error);
    process.exit(1);
  }
}

/**
 * Run all pending migrations
 */
function runMigrations() {
  console.log('📦 Starting database migrations...');

  const executed = getExecutedMigrations();
  const allMigrations = getMigrationFiles();
  const pending = allMigrations.filter(m => !executed.includes(m));

  if (pending.length === 0) {
    console.log('✨ Database is up to date. No migrations needed.');
    return;
  }

  console.log(`📋 Found ${pending.length} pending migration(s)`);

  for (const migration of pending) {
    executeMigration(migration);
  }

  console.log('🎉 All migrations completed successfully!');
}

// Run migrations
try {
  runMigrations();
  db.close();
} catch (error) {
  console.error('💥 Migration process failed:', error);
  db.close();
  process.exit(1);
}
