/**
 * Unified Poller Service
 * Single polling service that fetches all integration data and broadcasts via SSE
 * Replaces separate metricPoller and statusPoller polling for notifications
 */

import { getDb } from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { createDriver } from './driverFactory';
import { metricsSSE } from '@/lib/sse-managers';
import { metricsEventBus } from './metricsEventBus';
import type { Integration, IntegrationCredentials, CapabilityMetadata } from '@/lib/types';

interface PollerConfig {
  pollInterval: number; // Default 30s
}

class UnifiedPoller {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private config: PollerConfig = {
    pollInterval: 30000, // 30 seconds
  };

  /**
   * Start the unified poller
   */
  start(config?: Partial<PollerConfig>) {
    if (this.isRunning) {
      console.log('[UnifiedPoller] Already running');
      return;
    }

    if (config) {
      this.config = { ...this.config, ...config };
    }

    console.log('[UnifiedPoller] Starting...');
    this.isRunning = true;

    // Initial poll
    this.pollCycle().catch(error => {
      console.error('[UnifiedPoller] Initial poll failed:', error);
    });

    // Schedule recurring polls
    this.intervalId = setInterval(() => {
      this.pollCycle().catch(error => {
        console.error('[UnifiedPoller] Poll cycle failed:', error);
      });
    }, this.config.pollInterval);

    console.log(`[UnifiedPoller] Started with ${this.config.pollInterval}ms interval`);
  }

  /**
   * Stop the unified poller
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[UnifiedPoller] Stopped');
  }

  /**
   * Check if poller is active
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Main polling cycle - fetch data from all integrations
   */
  private async pollCycle() {
    try {
      const db = getDb();
      const integrations = db
        .prepare(`
          SELECT id, service_name, service_type, credentials, poll_interval, is_active
          FROM integrations
          WHERE is_active = 1
          ORDER BY service_name
        `)
        .all() as Integration[];

      if (integrations.length === 0) {
        console.log('[UnifiedPoller] No active integrations to poll');
        return;
      }

      console.log(`[UnifiedPoller] Polling ${integrations.length} integrations`);

      // Poll each integration
      for (const integration of integrations) {
        await this.pollIntegration(integration);
      }

      console.log('[UnifiedPoller] Poll cycle complete');
    } catch (error) {
      console.error('[UnifiedPoller] Poll cycle error:', error);
    }
  }

  /**
   * Poll a single integration and broadcast results
   */
  private async pollIntegration(integration: Integration) {
    try {
      // Decrypt credentials
      if (!integration.credentials) {
        console.warn(`[UnifiedPoller] No credentials for ${integration.service_name}`);
        return;
      }

      const creds = JSON.parse(decrypt(integration.credentials)) as IntegrationCredentials;

      // Create driver
      const driver = createDriver(integration.id, integration.service_type, creds);

      // Fetch ALL capabilities
      const capabilities = await driver.getCapabilities();
      const metricData: Record<string, any> = {};
      let successCount = 0;
      let failCount = 0;

      for (const capability of capabilities) {
        try {
          const data = await driver.fetchMetric(capability.key);
          if (data) {
            metricData[capability.key] = data.value;
            successCount++;
          }
        } catch (error) {
          console.error(
            `[UnifiedPoller] Failed to fetch ${capability.key} from ${integration.service_name}:`,
            error instanceof Error ? error.message : error
          );
          failCount++;
        }
      }

      // Publish to event bus (internal subscribers like NotificationEvaluator)
      const payload = {
        integration_id: integration.id,
        integration_name: integration.service_name,
        integration_type: integration.service_type,
        timestamp: new Date().toISOString(),
        data: metricData,
      };

      metricsEventBus.publish(payload);

      // Also broadcast to SSE clients
      metricsSSE.broadcast('metrics', payload);

      console.log(
        `[UnifiedPoller] Published metrics for ${integration.service_name}: ${successCount} success, ${failCount} failed`
      );

      // Update last_poll_at in database
      const db = getDb();
      db.prepare(
        `UPDATE integrations
         SET last_poll_at = datetime('now'),
             last_status = ?,
             updated_at = datetime('now')
         WHERE id = ?`
      ).run(successCount > 0 ? 'success' : 'failed', integration.id);

    } catch (error) {
      console.error(
        `[UnifiedPoller] Failed to poll ${integration.service_name}:`,
        error instanceof Error ? error.message : error
      );

      // Update status to failed
      const db = getDb();
      db.prepare(
        `UPDATE integrations
         SET last_poll_at = datetime('now'),
             last_status = 'failed',
             updated_at = datetime('now')
         WHERE id = ?`
      ).run(integration.id);
    }
  }
}

// Singleton instance
export const unifiedPoller = new UnifiedPoller();
