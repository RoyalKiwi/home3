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

// Run migrations on startup
function runMigrations() {
  try {
    console.log('📦 Running database migrations...');

    // Create migrations tracking table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        executed_at TEXT DEFAULT (datetime('now'))
      );
    `);

    // Get executed migrations
    const executedMigrations = db
      .prepare('SELECT name FROM _migrations ORDER BY id')
      .all()
      .map((row: any) => row.name);

    // Get migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('ℹ️  No migrations directory found');
      return;
    }

    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    const pendingMigrations = migrationFiles.filter(
      (file) => !executedMigrations.includes(file)
    );

    if (pendingMigrations.length === 0) {
      console.log('✨ Database is up to date');
      return;
    }

    console.log(`📋 Found ${pendingMigrations.length} pending migration(s)`);

    // Execute pending migrations
    for (const migrationFile of pendingMigrations) {
      const migrationPath = path.join(migrationsDir, migrationFile);
      const sql = fs.readFileSync(migrationPath, 'utf-8');

      console.log(`🔄 Executing migration: ${migrationFile}`);

      db.exec(sql);
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(migrationFile);

      console.log(`✅ Migration completed: ${migrationFile}`);
    }

    console.log('🎉 All migrations completed successfully!');
  } catch (error) {
    console.error('💥 Migration failed:', error);
    throw error;
  }
}

// Run migrations immediately
runMigrations();

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
