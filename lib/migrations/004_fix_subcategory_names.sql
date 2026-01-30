-- =============================================================================
-- HOMEPAGE3 DATABASE SCHEMA
-- Migration: 004_fix_subcategory_names
-- Description: Remove trailing "0" from subcategory names where admin_only = 0
-- =============================================================================

-- Fix subcategory names that have "0" appended when admin_only is false
UPDATE subcategories
SET name = REPLACE(name, '0', '')
WHERE admin_only = 0
  AND name LIKE '%0';

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
