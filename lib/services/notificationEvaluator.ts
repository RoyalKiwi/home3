/**
 * Notification Evaluator
 * Subscribes to metrics event bus and evaluates notification rules
 * Sends alerts when conditions are met (with cooldown management)
 */

import { getDb } from '@/lib/db';
import { metricsEventBus, type MetricsPayload } from './metricsEventBus';
import { notificationService } from './notifications';
import type { NotificationPayload } from '@/lib/types';

interface CooldownEntry {
  ruleId: number;
  expiresAt: number;
}

class NotificationEvaluator {
  private cooldowns: Map<number, number> = new Map(); // ruleId -> expiresAt timestamp
  private isStarted = false;

  /**
   * Start the notification evaluator
   */
  start() {
    if (this.isStarted) {
      console.log('[NotificationEvaluator] Already started');
      return;
    }

    console.log('[NotificationEvaluator] Starting...');
    this.isStarted = true;

    // Subscribe to metrics event bus
    metricsEventBus.subscribe(this.handleMetrics.bind(this));

    console.log('[NotificationEvaluator] Subscribed to metrics event bus');
  }

  /**
   * Stop the notification evaluator
   */
  stop() {
    if (!this.isStarted) {
      return;
    }

    metricsEventBus.unsubscribe(this.handleMetrics.bind(this));
    this.isStarted = false;
    console.log('[NotificationEvaluator] Stopped');
  }

  /**
   * Handle incoming metrics data
   */
  private async handleMetrics(payload: MetricsPayload) {
    try {
      await this.evaluateRules(payload);
    } catch (error) {
      console.error('[NotificationEvaluator] Error evaluating rules:', error);
    }
  }

  /**
   * Evaluate all active rules for the given metrics payload
   */
  private async evaluateRules(payload: MetricsPayload) {
    try {
      const db = getDb();

      // Get all active rules for this integration
      const rules = db
        .prepare(
          `SELECT nr.*, wc.type as webhook_type, wc.config as webhook_config
           FROM notification_rules nr
           JOIN webhook_configs wc ON nr.webhook_id = wc.id
           WHERE nr.is_active = 1
             AND nr.integration_id = ?
           ORDER BY nr.id`
        )
        .all(payload.integration_id) as any[];

      if (rules.length === 0) {
        return;
      }

      console.log(`[NotificationEvaluator] Evaluating ${rules.length} rules for integration ${payload.integration_id}`);

      for (const rule of rules) {
        await this.evaluateRule(rule, payload);
      }
    } catch (error) {
      console.error('[NotificationEvaluator] Error in evaluateRules:', error);
    }
  }

  /**
   * Evaluate a single rule
   */
  private async evaluateRule(rule: any, payload: MetricsPayload) {
    try {
      // Check if metric exists in payload
      const metricValue = payload.data[rule.metric_key];
      if (metricValue === undefined || metricValue === null) {
        // Metric not available in this payload
        return;
      }

      // Ensure metric value is a number
      const numericValue = typeof metricValue === 'number' ? metricValue : parseFloat(metricValue);
      if (isNaN(numericValue)) {
        console.warn(`[NotificationEvaluator] Non-numeric value for ${rule.metric_key}: ${metricValue}`);
        return;
      }

      // Evaluate condition
      const triggered = this.evaluateCondition(numericValue, rule.operator, rule.threshold);

      if (!triggered) {
        return;
      }

      // Check cooldown
      if (this.isInCooldown(rule.id)) {
        console.log(`[NotificationEvaluator] Rule ${rule.id} (${rule.name}) is in cooldown, skipping`);
        return;
      }

      console.log(
        `[NotificationEvaluator] Rule triggered: ${rule.name} (${rule.metric_key} ${rule.operator} ${rule.threshold})`
      );

      // Send notification
      await this.sendNotification(rule, payload, numericValue);

      // Set cooldown
      this.setCooldown(rule.id, rule.cooldown_minutes || 30);

    } catch (error) {
      console.error(`[NotificationEvaluator] Error evaluating rule ${rule.id}:`, error);
    }
  }

  /**
   * Evaluate a condition
   */
  private evaluateCondition(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'gt':
        return value > threshold;
      case 'gte':
        return value >= threshold;
      case 'lt':
        return value < threshold;
      case 'lte':
        return value <= threshold;
      case 'eq':
        return value === threshold;
      default:
        console.warn(`[NotificationEvaluator] Unknown operator: ${operator}`);
        return false;
    }
  }

  /**
   * Check if a rule is in cooldown
   */
  private isInCooldown(ruleId: number): boolean {
    const expiresAt = this.cooldowns.get(ruleId);
    if (!expiresAt) {
      return false;
    }

    const now = Date.now();
    if (now >= expiresAt) {
      // Cooldown expired, remove it
      this.cooldowns.delete(ruleId);
      return false;
    }

    return true;
  }

  /**
   * Set cooldown for a rule
   */
  private setCooldown(ruleId: number, minutes: number) {
    const expiresAt = Date.now() + minutes * 60 * 1000;
    this.cooldowns.set(ruleId, expiresAt);
    console.log(`[NotificationEvaluator] Set cooldown for rule ${ruleId}: ${minutes} minutes`);
  }

  /**
   * Send notification
   */
  private async sendNotification(rule: any, payload: MetricsPayload, metricValue: number) {
    try {
      // Get capability metadata for this metric (for unit and display name)
      const capability = await this.getCapabilityMetadata(payload.integration_id, rule.metric_key);

      // Build notification payload
      const operatorDisplay = this.getOperatorDisplay(rule.operator);
      const metricDisplayName = capability?.displayName || rule.metric_key;
      const unit = capability?.unit || '';

      const notificationPayload: NotificationPayload = {
        alertType: rule.metric_key as any, // Use metric key as alert type (cpu, memory, etc.)
        title: `${rule.name}`,
        message: `${payload.integration_name}: ${metricDisplayName} is ${metricValue}${unit} (${operatorDisplay} ${rule.threshold}${unit})`,
        severity: rule.severity,
        metadata: {
          integrationName: payload.integration_name,
          integrationType: payload.integration_type,
          metricName: rule.metric_key,
          metricDisplayName: metricDisplayName,
          metricValue: metricValue,
          threshold: rule.threshold,
          unit: unit,
          operator: rule.operator,
        },
      };

      // Debug logging
      console.log('[NotificationEvaluator] Sending notification with metadata:', {
        metricValue,
        threshold: rule.threshold,
        unit,
        metricDisplayName,
        fullMetadata: notificationPayload.metadata
      });

      // Use notification service to send alert
      await notificationService.sendAlert(rule.id, notificationPayload);

      // Log to notification history
      const db = getDb();
      db.prepare(
        `INSERT INTO notification_history (
          rule_id, webhook_id, status, integration_id, metric_key,
          metric_value, threshold, sent_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).run(
        rule.id,
        rule.webhook_id,
        'sent',
        payload.integration_id,
        rule.metric_key,
        metricValue,
        rule.threshold
      );

      console.log(`[NotificationEvaluator] Sent notification for rule ${rule.id} (${rule.name})`);
    } catch (error) {
      console.error(`[NotificationEvaluator] Failed to send notification for rule ${rule.id}:`, error);

      // Log failure to history
      try {
        const db = getDb();
        db.prepare(
          `INSERT INTO notification_history (
            rule_id, webhook_id, status, integration_id, metric_key,
            metric_value, threshold, error_message, sent_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        ).run(
          rule.id,
          rule.webhook_id,
          'failed',
          payload.integration_id,
          rule.metric_key,
          metricValue,
          rule.threshold,
          error instanceof Error ? error.message : String(error)
        );
      } catch (dbError) {
        console.error('[NotificationEvaluator] Failed to log error to history:', dbError);
      }
    }
  }

  /**
   * Get capability metadata for a metric
   */
  private async getCapabilityMetadata(integrationId: number, metricKey: string): Promise<{ displayName: string; unit: string } | null> {
    try {
      const db = getDb();

      // Get integration details
      const integration = db.prepare('SELECT * FROM integrations WHERE id = ?').get(integrationId) as any;
      if (!integration) {
        return null;
      }

      // Import driver factory and decrypt utility
      const { createDriver } = await import('./driverFactory');
      const { decrypt } = await import('../crypto');

      // Parse credentials
      const credentials = JSON.parse(decrypt(integration.credentials));

      // Create driver
      const driver = createDriver(integrationId, integration.service_type, credentials);

      // Get capabilities
      const capabilities = await driver.getCapabilities();

      // Find the matching capability
      const capability = capabilities.find((cap: any) => cap.key === metricKey);

      return capability ? { displayName: capability.displayName, unit: capability.unit } : null;
    } catch (error) {
      console.error(`[NotificationEvaluator] Failed to get capability metadata for ${metricKey}:`, error);
      return null;
    }
  }

  /**
   * Get human-readable operator display
   */
  private getOperatorDisplay(operator: string): string {
    switch (operator) {
      case 'gt':
        return '>';
      case 'gte':
        return '>=';
      case 'lt':
        return '<';
      case 'lte':
        return '<=';
      case 'eq':
        return '==';
      default:
        return operator;
    }
  }
}

// Singleton instance
export const notificationEvaluator = new NotificationEvaluator();

// Auto-start in Node.js environment (not in browser/webpack)
if (typeof window === 'undefined' && typeof process !== 'undefined') {
  notificationEvaluator.start();
}
