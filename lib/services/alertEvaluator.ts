/**
 * Alert Evaluator Service - Phase 7 + Phase 1 Expansion
 *
 * Purpose: Centralized logic for evaluating notification rules against metrics
 * Evaluates: Threshold rules (CPU > 80°C) and status change rules (online → offline)
 * Phase 1: Added support for dynamic metrics from metric_definitions table
 */

import { getDb } from '../db';
import { notificationService } from './notifications';
import { MetricRegistry } from './metricRegistry';
import type { MetricType, ThresholdOperator, Severity } from '../types';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Evaluate threshold operator
 * @param value Current metric value
 * @param operator Comparison operator (gt, lt, gte, lte, eq)
 * @param threshold Threshold value to compare against
 * @returns true if condition is met
 */
function evaluateOperator(
  value: number,
  operator: ThresholdOperator,
  threshold: number
): boolean {
  switch (operator) {
    case 'gt':
      return value > threshold;
    case 'lt':
      return value < threshold;
    case 'gte':
      return value >= threshold;
    case 'lte':
      return value <= threshold;
    case 'eq':
      return value === threshold;
    default:
      return false;
  }
}

/**
 * Get unit for metric type (Phase 1: Dynamic lookup)
 * @param metricKey The metric key (can be legacy MetricType or new metric_key)
 * @param metricDefinitionId Optional metric definition ID for direct lookup
 * @returns Unit string (°C, %, Mbps, etc.)
 */
function getUnit(metricKey: string, metricDefinitionId?: number | null): string {
  // Try dynamic lookup first
  if (metricDefinitionId) {
    const metric = MetricRegistry.getMetricById(metricDefinitionId);
    if (metric?.unit) return metric.unit;
  }

  // Try lookup by key
  const metric = MetricRegistry.getMetricByKey(metricKey);
  if (metric?.unit) return metric.unit;

  // Fallback to legacy hardcoded values for backward compatibility
  const units: Record<string, string> = {
    cpu_temperature: '°C',
    drive_temperature: '°C',
    cpu_usage: '%',
    memory_usage: '%',
    disk_usage: '%',
    ups_battery_level: '%',
    network_bandwidth: 'Mbps',
  };
  return units[metricKey] || '';
}

/**
 * Get display name for metric type (Phase 1: Dynamic lookup)
 * @param metricKey The metric key (can be legacy MetricType or new metric_key)
 * @param metricDefinitionId Optional metric definition ID for direct lookup
 * @returns Human-readable name
 */
function getMetricDisplayName(metricKey: string, metricDefinitionId?: number | null): string {
  // Try dynamic lookup first
  if (metricDefinitionId) {
    const metric = MetricRegistry.getMetricById(metricDefinitionId);
    if (metric?.display_name) return metric.display_name;
  }

  // Try lookup by key
  const metric = MetricRegistry.getMetricByKey(metricKey);
  if (metric?.display_name) return metric.display_name;

  // Fallback to legacy hardcoded values for backward compatibility
  const names: Record<string, string> = {
    cpu_temperature: 'CPU Temperature',
    drive_temperature: 'Drive Temperature',
    cpu_usage: 'CPU Usage',
    memory_usage: 'Memory Usage',
    disk_usage: 'Disk Usage',
    ups_battery_level: 'UPS Battery Level',
    network_bandwidth: 'Network Bandwidth',
    docker_container_status: 'Docker Container Status',
    array_status: 'Array Status',
    server_offline: 'Server Offline',
    server_online: 'Server Online',
    server_warning: 'Server Warning',
  };
  return names[metricKey] || metricKey;
}

/**
 * Get operator symbol for display
 * @param operator Threshold operator
 * @returns Symbol (>, <, ≥, ≤, =)
 */
function getOperatorSymbol(operator: ThresholdOperator): string {
  const symbols: Record<ThresholdOperator, string> = {
    gt: '>',
    lt: '<',
    gte: '≥',
    lte: '≤',
    eq: '=',
  };
  return symbols[operator] || operator;
}

// =============================================================================
// THRESHOLD RULE EVALUATION
// =============================================================================

/**
 * Evaluate threshold-based notification rules
 * Called by monitoring service after fetching metrics from integration drivers
 *
 * @param metrics Object containing metric values (e.g., { cpu_temperature: 85, disk_usage: 92 })
 * @param integrationId The integration ID that these metrics came from
 */
export async function evaluateThresholdRules(
  metrics: Record<string, number>,
  integrationId: number
): Promise<void> {
  try {
    const db = getDb();

    // Get all active threshold rules targeting this integration or all
    const rules = db.prepare(`
      SELECT nr.*, wc.webhook_url, wc.provider_type, wc.name as webhook_name
      FROM notification_rules nr
      JOIN webhook_configs wc ON nr.webhook_id = wc.id
      WHERE nr.is_active = 1
        AND wc.is_active = 1
        AND nr.condition_type = 'threshold'
        AND (
          nr.target_type = 'all'
          OR (nr.target_type = 'integration' AND nr.target_id = ?)
        )
    `).all(integrationId) as any[];

    if (rules.length === 0) {
      return; // No rules to evaluate
    }

    // Get integration name for display
    const integration = db.prepare('SELECT service_name FROM integrations WHERE id = ?')
      .get(integrationId) as { service_name: string } | undefined;

    const integrationName = integration?.service_name || `Integration ${integrationId}`;

    // Evaluate each rule
    for (const rule of rules) {
      const metricValue = metrics[rule.metric_type];

      // Skip if metric not present in data
      if (metricValue === undefined || metricValue === null) {
        continue;
      }

      // Evaluate threshold condition
      const conditionMet = evaluateOperator(
        metricValue,
        rule.threshold_operator,
        rule.threshold_value
      );

      if (conditionMet) {
        // Phase 1: Support both legacy metric_type and new metric_definition_id
        const metricKey = rule.metric_type;
        const metricDefId = rule.metric_definition_id;

        const unit = getUnit(metricKey, metricDefId);
        const metricDisplayName = getMetricDisplayName(metricKey, metricDefId);
        const operatorSymbol = getOperatorSymbol(rule.threshold_operator);

        await notificationService.sendAlert(rule.id, {
          alertType: rule.metric_type,
          title: rule.name,
          message: `${integrationName}: ${metricDisplayName} is ${metricValue}${unit} (${operatorSymbol} ${rule.threshold_value}${unit})`,
          severity: rule.severity as Severity,
          metadata: {
            integrationId,
            integrationName,
            metricValue,
            threshold: rule.threshold_value,
            metricType: rule.metric_type,
            metricDefinitionId: metricDefId,
          },
        });
      }
    }
  } catch (error) {
    console.error('[AlertEvaluator] Failed to evaluate threshold rules:', error);
    // Don't throw - system should continue even if alert evaluation fails
  }
}

// =============================================================================
// STATUS CHANGE RULE EVALUATION
// =============================================================================

/**
 * Evaluate status change notification rules
 * Called by statusPoller when card status changes
 *
 * @param cardId The card ID whose status changed
 * @param oldStatus Previous status (online, offline, warning)
 * @param newStatus New status (online, offline, warning)
 * @param cardName Card display name (for message)
 */
export async function evaluateStatusChangeRules(
  cardId: number,
  oldStatus: string,
  newStatus: string,
  cardName: string
): Promise<void> {
  try {
    const db = getDb();

    // Get all active status change rules targeting this card or all
    const rules = db.prepare(`
      SELECT nr.*, wc.webhook_url, wc.provider_type, wc.name as webhook_name
      FROM notification_rules nr
      JOIN webhook_configs wc ON nr.webhook_id = wc.id
      WHERE nr.is_active = 1
        AND wc.is_active = 1
        AND nr.condition_type = 'status_change'
        AND (
          nr.target_type = 'all'
          OR (nr.target_type = 'card' AND nr.target_id = ?)
        )
    `).all(cardId) as any[];

    if (rules.length === 0) {
      return; // No rules to evaluate
    }

    // Evaluate each rule
    for (const rule of rules) {
      // Check if status transition matches rule
      // NULL values in from_status/to_status mean "any status"
      const fromMatches = rule.from_status === null || rule.from_status === oldStatus;
      const toMatches = rule.to_status === null || rule.to_status === newStatus;

      if (fromMatches && toMatches) {
        // Determine metric type based on new status
        let metricType: MetricType;
        if (newStatus === 'offline') {
          metricType = 'server_offline';
        } else if (newStatus === 'online') {
          metricType = 'server_online';
        } else {
          metricType = 'server_warning';
        }

        await notificationService.sendAlert(rule.id, {
          alertType: metricType,
          title: rule.name,
          message: `${cardName}: Status changed from ${oldStatus} to ${newStatus}`,
          severity: rule.severity as Severity,
          metadata: {
            cardName,
            cardId,
            oldStatus,
            newStatus,
          },
        });
      }
    }
  } catch (error) {
    console.error('[AlertEvaluator] Failed to evaluate status change rules:', error);
    // Don't throw - system should continue even if alert evaluation fails
  }
}

// =============================================================================
// BULK STATUS EVALUATION (FOR STATUS POLLER)
// =============================================================================

/**
 * Evaluate status change rules for multiple cards at once
 * Optimized for statusPoller which processes diffs in batches
 *
 * @param statusChanges Array of status change events
 */
export async function evaluateBulkStatusChanges(
  statusChanges: Array<{
    cardId: number;
    oldStatus: string;
    newStatus: string;
  }>
): Promise<void> {
  try {
    const db = getDb();

    // Get card names in bulk
    const cardIds = statusChanges.map(sc => sc.cardId);
    const placeholders = cardIds.map(() => '?').join(',');
    const cards = db.prepare(`SELECT id, name FROM cards WHERE id IN (${placeholders})`)
      .all(...cardIds) as Array<{ id: number; name: string }>;

    const cardNameMap = new Map(cards.map(c => [c.id, c.name]));

    // Evaluate each status change
    for (const change of statusChanges) {
      const cardName = cardNameMap.get(change.cardId) || `Card ${change.cardId}`;
      await evaluateStatusChangeRules(
        change.cardId,
        change.oldStatus,
        change.newStatus,
        cardName
      );
    }
  } catch (error) {
    console.error('[AlertEvaluator] Failed to evaluate bulk status changes:', error);
  }
}
