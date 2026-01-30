-- =============================================================================
-- HOMEPAGE3 DATABASE SCHEMA
-- Migration: 003_add_gradient_style
-- Description: Add gradient_style field to cards table for customizable gradients
-- =============================================================================

-- Add gradient_style column to cards table
-- Options: diagonal, four-corner, radial, conic, horizontal, vertical, double-diagonal
ALTER TABLE cards ADD COLUMN gradient_style TEXT DEFAULT 'diagonal'
  CHECK(gradient_style IN ('diagonal', 'four-corner', 'radial', 'conic', 'horizontal', 'vertical', 'double-diagonal'));

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
