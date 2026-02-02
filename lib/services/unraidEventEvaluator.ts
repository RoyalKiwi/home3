/**
 * Unraid Event Evaluator Service - Phase 2
 *
 * Purpose: Process incoming Unraid webhook events and trigger notification rules
 * Integrates with existing notification system via notificationService
 */

import { getDb } from '../db';
import { notificationService } from './notifications';
import { MetricRegistry } from './metricRegistry';
import type { Severity } from '../types';

/**
 * Unraid webhook event payload
 */
export interface UnraidWebhookEvent {
  event: string;                    // Event type (e.g., 'array.started', 'parity.errors')
  subject: string;                  // Event title
  description: string;              // Event details
  importance?: 'normal' | 'warning' | 'alert'; // Event severity
  timestamp?: string;               // ISO timestamp
  metadata?: Record<string, any>;   // Additional event data
}

/**
 * Map Unraid event type to metric definition key
 */
function mapEventToMetricKey(eventType: string): string | null {
  const eventMap: Record<string, string> = {
    // Array events
    'array.started': 'unraid_array_started',
    'array.stopped': 'unraid_array_stopped',
    'array.offline': 'unraid_array_offline',

    // Parity events
    'parity.check.started': 'unraid_parity_check_started',
    'parity.check.finished': 'unraid_parity_check_finished',
    'parity.errors': 'unraid_parity_errors',

    // Docker events
    'docker.started': 'unraid_docker_started',
    'docker.stopped': 'unraid_docker_stopped',

    // Health events
    'drive.temperature.high': 'unraid_drive_temperature_high',
    'ups.battery.low': 'unraid_ups_battery_low',
    'disk.full': 'unraid_disk_full',

    // System events
    'server.reboot': 'unraid_server_reboot',
    'server.shutdown': 'unraid_server_shutdown',
  };

  return eventMap[eventType] || null;
}

/**
 * Map Unraid importance to notification severity
 */
function mapImportanceToSeverity(importance?: string): Severity {
  switch (importance) {
    case 'alert':
      return 'critical';
    case 'warning':
      return 'warning';
    case 'normal':
    default:
      return 'info';
  }
}

/**
 * Store incoming Unraid event in audit table
 */
function logEvent(event: UnraidWebhookEvent): number {
  const db = getDb();

  const result = db.prepare(`
    INSERT INTO unraid_events (
      event_type,
      subject,
      description,
      importance,
      event_data,
      processed
    ) VALUES (?, ?, ?, ?, ?, 0)
  `).run(
    event.event,
    event.subject,
    event.description,
    event.importance || 'normal',
    JSON.stringify(event.metadata || {})
  );

  return result.lastInsertRowid as number;
}

/**
 * Mark event as processed in audit table
 */
function markEventProcessed(eventId: number): void {
  const db = getDb();

  db.prepare(`
    UPDATE unraid_events
    SET processed = 1
    WHERE id = ?
  `).run(eventId);
}

/**
 * Process incoming Unraid webhook event
 * Evaluates notification rules and triggers alerts
 */
export async function processUnraidEvent(event: UnraidWebhookEvent): Promise<void> {
  try {
    // Log event to audit table
    const eventId = logEvent(event);
    console.log(`[UnraidEvent] Received event: ${event.event} (ID: ${eventId})`);

    // Map event type to metric definition
    const metricKey = mapEventToMetricKey(event.event);

    if (!metricKey) {
      console.warn(`[UnraidEvent] Unknown event type: ${event.event}`);
      return;
    }

    // Look up metric definition
    const metric = MetricRegistry.getMetricByKey(metricKey);

    if (!metric) {
      console.warn(`[UnraidEvent] Metric not found for key: ${metricKey}`);
      return;
    }

    // Get all active notification rules for this metric
    const db = getDb();
    const rules = db.prepare(`
      SELECT nr.*, wc.webhook_url, wc.provider_type, wc.name as webhook_name
      FROM notification_rules nr
      JOIN webhook_configs wc ON nr.webhook_id = wc.id
      WHERE nr.is_active = 1
        AND wc.is_active = 1
        AND (
          nr.metric_definition_id = ?
          OR nr.metric_type = ?
        )
        AND nr.condition_type = 'presence'
    `).all(metric.id, metricKey) as any[];

    if (rules.length === 0) {
      console.log(`[UnraidEvent] No active rules for metric: ${metricKey}`);
      markEventProcessed(eventId);
      return;
    }

    console.log(`[UnraidEvent] Found ${rules.length} matching rules for ${metricKey}`);

    // Determine severity from Unraid importance
    const severity = mapImportanceToSeverity(event.importance);

    // Trigger alerts for matching rules
    for (const rule of rules) {
      await notificationService.sendAlert(rule.id, {
        alertType: metricKey as any, // Cast to MetricType
        title: event.subject,
        message: event.description,
        severity: rule.severity as Severity || severity,
        metadata: {
          unraidEvent: event.event,
          importance: event.importance,
          timestamp: event.timestamp,
          eventId,
          ...event.metadata,
        },
      });
    }

    // Mark event as processed
    markEventProcessed(eventId);

    console.log(`[UnraidEvent] Event ${eventId} processed successfully`);
  } catch (error) {
    console.error('[UnraidEvent] Failed to process event:', error);
    throw error; // Re-throw so webhook endpoint can return 500
  }
}

/**
 * Validate incoming Unraid webhook event structure
 */
export function validateUnraidEvent(payload: any): payload is UnraidWebhookEvent {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }

  if (typeof payload.event !== 'string' || !payload.event) {
    return false;
  }

  if (typeof payload.subject !== 'string' || !payload.subject) {
    return false;
  }

  if (typeof payload.description !== 'string') {
    return false;
  }

  return true;
}

/**
 * Get recent Unraid events for admin UI
 */
export function getRecentUnraidEvents(limit: number = 50): any[] {
  const db = getDb();

  return db.prepare(`
    SELECT
      id,
      event_type,
      subject,
      description,
      importance,
      received_at,
      processed
    FROM unraid_events
    ORDER BY received_at DESC
    LIMIT ?
  `).all(limit);
}

/**
 * Get Unraid event statistics
 */
export function getUnraidEventStats(): {
  total: number;
  processed: number;
  unprocessed: number;
  last24Hours: number;
} {
  const db = getDb();

  const total = db.prepare('SELECT COUNT(*) as count FROM unraid_events').get() as { count: number };
  const processed = db.prepare('SELECT COUNT(*) as count FROM unraid_events WHERE processed = 1').get() as { count: number };
  const last24Hours = db.prepare(`
    SELECT COUNT(*) as count
    FROM unraid_events
    WHERE received_at >= datetime('now', '-1 day')
  `).get() as { count: number };

  return {
    total: total.count,
    processed: processed.count,
    unprocessed: total.count - processed.count,
    last24Hours: last24Hours.count,
  };
}
