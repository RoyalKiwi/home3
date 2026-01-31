/**
 * Monitoring Orchestrator
 * Polls integrations on-demand with rate limiting based on poll_interval
 */

import { getDb } from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { createDriver } from './driverFactory';
import type { Integration, IntegrationCredentials, MetricCapability } from '@/lib/types';

class MonitoringService {
  /**
   * Check if enough time has passed since last poll (rate limiting)
   */
  private canPoll(integration: Integration): boolean {
    if (!integration.last_poll_at) {
      return true; // Never polled before
    }

    const lastPoll = new Date(integration.last_poll_at).getTime();
    const now = Date.now();
    const elapsed = now - lastPoll;

    // poll_interval is the minimum time between polls
    return elapsed >= integration.poll_interval;
  }

  /**
   * Poll a single integration
   */
  private async pollIntegration(integration: Integration) {
    try {
      if (!integration.credentials) {
        console.warn(`[Monitoring] No credentials for ${integration.service_name}`);
        return;
      }

      // Decrypt credentials
      const credentials = JSON.parse(
        decrypt(integration.credentials)
      ) as IntegrationCredentials;

      // Create driver
      const driver = createDriver(
        integration.id,
        integration.service_type,
        credentials
      );

      // Fetch all supported metrics
      const capabilities = driver.getCapabilities();
      const metricResults: Record<string, any> = {};

      for (const capability of capabilities) {
        try {
          const data = await driver.fetchMetric(capability);
          if (data) {
            metricResults[capability] = data;
          }
        } catch (error) {
          console.error(
            `[Monitoring] Failed to fetch ${capability} from ${integration.service_name}:`,
            error instanceof Error ? error.message : error
          );
        }
      }

      // Update last_poll_at and last_status
      const db = getDb();
      db.prepare(
        `UPDATE integrations
         SET last_poll_at = datetime('now'),
             last_status = ?,
             updated_at = datetime('now')
         WHERE id = ?`
      ).run(
        Object.keys(metricResults).length > 0 ? 'success' : 'partial',
        integration.id
      );

      // Broadcast results via SSE would happen here
      // For now, just log the results
      console.log(
        `[Monitoring] Polled ${integration.service_name}:`,
        Object.keys(metricResults)
      );

      return metricResults;
    } catch (error) {
      // Update status to failed
      const db = getDb();
      db.prepare(
        `UPDATE integrations
         SET last_poll_at = datetime('now'),
             last_status = 'failed',
             updated_at = datetime('now')
         WHERE id = ?`
      ).run(integration.id);

      throw error;
    }
  }

  /**
   * Poll a specific integration on demand (with rate limiting)
   */
  async pollIntegrationById(integrationId: number, force = false) {
    const db = getDb();

    const integration = db
      .prepare('SELECT * FROM integrations WHERE id = ?')
      .get(integrationId) as Integration | undefined;

    if (!integration) {
      throw new Error('Integration not found');
    }

    // Check rate limit unless forced
    if (!force && !this.canPoll(integration)) {
      const lastPoll = new Date(integration.last_poll_at!).getTime();
      const nextPoll = lastPoll + integration.poll_interval;
      const waitTime = Math.ceil((nextPoll - Date.now()) / 1000);

      throw new Error(
        `Rate limited: Please wait ${waitTime} seconds before polling again`
      );
    }

    return this.pollIntegration(integration);
  }
}

// Singleton instance
export const monitoringService = new MonitoringService();
