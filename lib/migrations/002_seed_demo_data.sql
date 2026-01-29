-- =============================================================================
-- HOMEPAGE3 SEED DATA (OPTIONAL)
-- Migration: 002_seed_demo_data
-- Description: Optional demo data for development and testing
--
-- NOTE: This file is optional and can be deleted in production.
-- To skip this migration, simply delete this file before first run.
-- =============================================================================

-- Insert demo categories
INSERT INTO categories (name, order_index) VALUES
  ('Entertainment', 0),
  ('Productivity', 1),
  ('System', 2);

-- Insert demo subcategories
INSERT INTO subcategories (category_id, name, order_index, show_separator, admin_only) VALUES
  (1, 'Streaming', 0, 1, 0),
  (1, 'Media Management', 1, 1, 0),
  (2, 'Office', 0, 1, 0),
  (3, 'Server Management', 0, 1, 1),
  (3, 'Monitoring', 1, 1, 1);

-- Insert demo cards
INSERT INTO cards (subcategory_id, name, subtext, url, size, show_status, order_index) VALUES
  -- Streaming
  (1, 'Plex', 'Media streaming server', 'http://plex.local', 'large', 1, 0),
  (1, 'Jellyfin', 'Free software media system', 'http://jellyfin.local', 'medium', 1, 1),
  (1, 'Emby', 'Personal media server', 'http://emby.local', 'small', 1, 2),

  -- Media Management
  (2, 'Sonarr', 'TV show management', 'http://sonarr.local', 'small', 1, 0),
  (2, 'Radarr', 'Movie management', 'http://radarr.local', 'small', 1, 1),
  (2, 'Lidarr', 'Music management', 'http://lidarr.local', 'small', 1, 2),
  (2, 'Bazarr', 'Subtitle management', 'http://bazarr.local', 'small', 1, 3),

  -- Office
  (3, 'Nextcloud', 'Self-hosted cloud', 'http://nextcloud.local', 'medium', 1, 0),
  (3, 'Bitwarden', 'Password manager', 'http://bitwarden.local', 'small', 1, 1),

  -- Server Management (Admin Only)
  (4, 'Unraid', 'Server management', 'http://unraid.local', 'large', 1, 0),
  (4, 'Portainer', 'Container management', 'http://portainer.local', 'medium', 1, 1),

  -- Monitoring (Admin Only)
  (5, 'Grafana', 'Metrics dashboard', 'http://grafana.local', 'medium', 1, 0),
  (5, 'Uptime Kuma', 'Uptime monitoring', 'http://uptime.local', 'small', 1, 1),
  (5, 'Netdata', 'Real-time monitoring', 'http://netdata.local', 'small', 1, 2);

-- =============================================================================
-- END OF SEED DATA
-- =============================================================================
