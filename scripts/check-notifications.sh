#!/bin/bash
# Quick script to check notification system database

echo "=== Checking Notification System Database ==="
echo ""

echo "1. Templates in database:"
docker exec homepage3 sqlite3 /app/data/database.db "SELECT id, name, is_active FROM notification_templates;"
echo ""

echo "2. Metric definitions count:"
docker exec homepage3 sqlite3 /app/data/database.db "SELECT COUNT(*) as count FROM metric_definitions;"
echo ""

echo "3. Sample metrics:"
docker exec homepage3 sqlite3 /app/data/database.db "SELECT id, metric_key, display_name FROM metric_definitions LIMIT 5;"
echo ""

echo "4. Webhooks:"
docker exec homepage3 sqlite3 /app/data/database.db "SELECT id, name, provider_type FROM webhook_configs;"
echo ""

echo "5. Notification rules:"
docker exec homepage3 sqlite3 /app/data/database.db "SELECT id, name, metric_type FROM notification_rules;"
