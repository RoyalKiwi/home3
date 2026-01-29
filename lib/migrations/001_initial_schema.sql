-- =============================================================================
-- HOMEPAGE3 DATABASE SCHEMA
-- Migration: 001_initial_schema
-- Description: Initial database schema with all core tables
-- =============================================================================

-- Categories: Top-level organizational units
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_categories_order ON categories(order_index);

-- Subcategories: Second-tier organizational units within categories
CREATE TABLE IF NOT EXISTS subcategories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  show_separator BOOLEAN DEFAULT 1,
  admin_only BOOLEAN DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subcategories_category ON subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_order ON subcategories(order_index);
CREATE INDEX IF NOT EXISTS idx_subcategories_admin ON subcategories(admin_only);

-- Cards: Individual application/service entries
CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subcategory_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  subtext TEXT NOT NULL,
  url TEXT NOT NULL,
  icon_url TEXT,
  gradient_colors TEXT,
  size TEXT NOT NULL DEFAULT 'small' CHECK(size IN ('small', 'medium', 'large')),
  show_status BOOLEAN DEFAULT 1,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (subcategory_id) REFERENCES subcategories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cards_subcategory ON cards(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_cards_order ON cards(order_index);
CREATE INDEX IF NOT EXISTS idx_cards_show_status ON cards(show_status);

-- Integrations: Driver configurations for monitoring services
CREATE TABLE IF NOT EXISTS integrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_name TEXT NOT NULL,
  service_type TEXT NOT NULL,
  credentials TEXT,
  poll_interval INTEGER DEFAULT 5000,
  is_active BOOLEAN DEFAULT 1,
  last_poll_at TEXT,
  last_status TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_integrations_active ON integrations(is_active);
CREATE INDEX IF NOT EXISTS idx_integrations_type ON integrations(service_type);

-- Users: Admin account management
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK(role IN ('superuser', 'admin')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Widgets: Future feature for draggable dashboard widgets
CREATE TABLE IF NOT EXISTS widgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  widget_type TEXT NOT NULL,
  config TEXT,
  grid_position TEXT,
  is_visible BOOLEAN DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Settings: Global key-value configuration store
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Insert default settings
INSERT OR IGNORE INTO settings (key, value) VALUES ('maintenance_mode', 'false');
INSERT OR IGNORE INTO settings (key, value) VALUES ('server_name', 'Homepage3');
INSERT OR IGNORE INTO settings (key, value) VALUES ('onboarding_complete', 'false');

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
