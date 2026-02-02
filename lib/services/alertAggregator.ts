/**
 * Alert Aggregator Service - Phase 4A
 *
 * Purpose: Batch similar alerts to reduce notification spam
 * Groups alerts by rule ID within a configurable time window
 */

import { getDb } from '../db';
import type { NotificationPayload, Severity } from '../types';

/**
 * Pending alert batch
 */
interface AlertBatch {
  ruleId: number;
  ruleName: string;
  alerts: NotificationPayload[];
  firstAlertTime: number;
  timeoutId: NodeJS.Timeout;
}

/**
 * Alert aggregator configuration
 */
interface AggregatorConfig {
  windowMs: number;        // Aggregation window in milliseconds (default: 60000 = 60s)
  enabled: boolean;        // Whether aggregation is globally enabled
}

/**
 * Alert Aggregator Class
 * Singleton pattern to maintain state across requests
 */
class AlertAggregator {
  private batches: Map<number, AlertBatch> = new Map();
  private config: AggregatorConfig = {
    windowMs: 60000,        // Default: 60 seconds
    enabled: true,          // Default: enabled
  };

  constructor() {
    this.loadConfig();
  }

  /**
   * Load aggregation configuration from settings
   */
  private loadConfig(): void {
    try {
      const db = getDb();

      // Get aggregation window
      const windowSetting = db
        .prepare('SELECT value FROM settings WHERE key = ?')
        .get('aggregation_window_ms') as { value: string } | undefined;

      if (windowSetting?.value) {
        this.config.windowMs = parseInt(windowSetting.value, 10);
      }

      // Get enabled state
      const enabledSetting = db
        .prepare('SELECT value FROM settings WHERE key = ?')
        .get('aggregation_enabled') as { value: string } | undefined;

      if (enabledSetting?.value !== undefined) {
        this.config.enabled = enabledSetting.value === 'true';
      }
    } catch (error) {
      console.error('[AlertAggregator] Failed to load config:', error);
    }
  }

  /**
   * Check if aggregation is enabled for a specific rule
   */
  private isAggregationEnabled(ruleId: number): boolean {
    if (!this.config.enabled) {
      return false;
    }

    // Check per-rule aggregation setting (future enhancement)
    // For now, use global setting
    return true;
  }

  /**
   * Add alert to aggregation batch
   * Returns true if alert was batched, false if it should be sent immediately
   */
  addAlert(
    ruleId: number,
    ruleName: string,
    payload: NotificationPayload,
    sendCallback: (aggregatedPayload: NotificationPayload) => Promise<void>
  ): boolean {
    // If aggregation disabled for this rule, send immediately
    if (!this.isAggregationEnabled(ruleId)) {
      return false;
    }

    const now = Date.now();

    // Check if batch exists for this rule
    const existingBatch = this.batches.get(ruleId);

    if (existingBatch) {
      // Add to existing batch
      existingBatch.alerts.push(payload);
      console.log(
        `[AlertAggregator] Added alert to batch for rule ${ruleId} (${existingBatch.alerts.length} alerts)`
      );
      return true;
    }

    // Create new batch
    const timeoutId = setTimeout(async () => {
      await this.flushBatch(ruleId, sendCallback);
    }, this.config.windowMs);

    const newBatch: AlertBatch = {
      ruleId,
      ruleName,
      alerts: [payload],
      firstAlertTime: now,
      timeoutId,
    };

    this.batches.set(ruleId, newBatch);

    console.log(
      `[AlertAggregator] Created new batch for rule ${ruleId} (window: ${this.config.windowMs}ms)`
    );

    return true;
  }

  /**
   * Flush a batch and send aggregated notification
   */
  private async flushBatch(
    ruleId: number,
    sendCallback: (payload: NotificationPayload) => Promise<void>
  ): Promise<void> {
    const batch = this.batches.get(ruleId);

    if (!batch) {
      return;
    }

    // Remove batch from map
    this.batches.delete(ruleId);
    clearTimeout(batch.timeoutId);

    const alertCount = batch.alerts.length;

    if (alertCount === 0) {
      return;
    }

    console.log(`[AlertAggregator] Flushing batch for rule ${ruleId} (${alertCount} alerts)`);

    // If only one alert, send it as-is
    if (alertCount === 1) {
      await sendCallback(batch.alerts[0]);
      return;
    }

    // Aggregate multiple alerts into single notification
    const firstAlert = batch.alerts[0];
    const severity = this.getHighestSeverity(batch.alerts);

    const aggregatedPayload: NotificationPayload = {
      alertType: firstAlert.alertType,
      title: `${batch.ruleName} (${alertCount} alerts)`,
      message: this.buildAggregatedMessage(batch),
      severity,
      metadata: {
        ...firstAlert.metadata,
        aggregated: true,
        alertCount,
        timeWindow: `${this.config.windowMs / 1000}s`,
        alerts: batch.alerts.map((a) => ({
          title: a.title,
          message: a.message,
          severity: a.severity,
        })),
      },
    };

    await sendCallback(aggregatedPayload);
  }

  /**
   * Build aggregated message from multiple alerts
   */
  private buildAggregatedMessage(batch: AlertBatch): string {
    const alertCount = batch.alerts.length;
    const timeWindowSeconds = this.config.windowMs / 1000;

    let message = `${alertCount} alerts triggered within ${timeWindowSeconds}s:\n\n`;

    // Show summary of alerts (max 10)
    const displayAlerts = batch.alerts.slice(0, 10);

    for (let i = 0; i < displayAlerts.length; i++) {
      const alert = displayAlerts[i];
      const severityEmoji = this.getSeverityEmoji(alert.severity);
      message += `${i + 1}. ${severityEmoji} ${alert.message}\n`;
    }

    if (alertCount > 10) {
      message += `\n...and ${alertCount - 10} more alerts`;
    }

    return message;
  }

  /**
   * Get highest severity from alert batch
   */
  private getHighestSeverity(alerts: NotificationPayload[]): Severity {
    const severityOrder: Record<Severity, number> = {
      critical: 3,
      warning: 2,
      info: 1,
    };

    let highest: Severity = 'info';
    let highestValue = 0;

    for (const alert of alerts) {
      const value = severityOrder[alert.severity];
      if (value > highestValue) {
        highest = alert.severity;
        highestValue = value;
      }
    }

    return highest;
  }

  /**
   * Get emoji for severity level
   */
  private getSeverityEmoji(severity: Severity): string {
    switch (severity) {
      case 'critical':
        return '🔴';
      case 'warning':
        return '🟡';
      case 'info':
        return '🔵';
      default:
        return '⚪';
    }
  }

  /**
   * Get current aggregation statistics
   */
  getStats(): {
    activeBatches: number;
    totalAlertsInBatches: number;
    enabled: boolean;
    windowMs: number;
  } {
    let totalAlerts = 0;

    for (const batch of this.batches.values()) {
      totalAlerts += batch.alerts.length;
    }

    return {
      activeBatches: this.batches.size,
      totalAlertsInBatches: totalAlerts,
      enabled: this.config.enabled,
      windowMs: this.config.windowMs,
    };
  }

  /**
   * Update aggregation configuration
   */
  updateConfig(config: Partial<AggregatorConfig>): void {
    if (config.windowMs !== undefined) {
      this.config.windowMs = config.windowMs;

      // Persist to database
      const db = getDb();
      db.prepare(`
        INSERT OR REPLACE INTO settings (key, value, updated_at)
        VALUES ('aggregation_window_ms', ?, datetime('now'))
      `).run(config.windowMs.toString());
    }

    if (config.enabled !== undefined) {
      this.config.enabled = config.enabled;

      // Persist to database
      const db = getDb();
      db.prepare(`
        INSERT OR REPLACE INTO settings (key, value, updated_at)
        VALUES ('aggregation_enabled', ?, datetime('now'))
      `).run(config.enabled ? 'true' : 'false');
    }

    console.log('[AlertAggregator] Config updated:', this.config);
  }

  /**
   * Flush all pending batches immediately
   * Used during shutdown or for testing
   */
  async flushAll(sendCallback: (payload: NotificationPayload) => Promise<void>): Promise<void> {
    console.log(`[AlertAggregator] Flushing all batches (${this.batches.size})`);

    const batches = Array.from(this.batches.keys());

    for (const ruleId of batches) {
      await this.flushBatch(ruleId, sendCallback);
    }
  }
}

// Singleton instance
export const alertAggregator = new AlertAggregator();
