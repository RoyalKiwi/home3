/**
 * Metric Poller Service
 * Automatically polls integrations for threshold-based metrics
 *
 * THIS IS THE MISSING PIECE - without this, threshold notifications never trigger!
 *
 * Status change notifications work because statusPoller.ts runs automatically.
 * This service provides the same functionality for threshold-based metrics.
 *
 * Runs every 60 seconds, polls all active Netdata/Unraid integrations,
 * triggers evaluation chain: Poll → Collect → Evaluate → Alert
 */

import { getDb } from '@/lib/db';
import { monitoringService } from './monitoring';

export class MetricPoller {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private pollInterval = 60000; // 1 minute (60,000ms)

  /**
   * Start the background polling service
   * Safe to call multiple times - won't start if already running
   */
  start() {
    if (this.isRunning) {
      console.log('[MetricPoller] Already running, skipping start');
      return;
    }

    console.log('[MetricPoller] Starting background metric polling...');
    this.isRunning = true;

    // Run initial poll immediately on startup
    this.pollCycle();

    // Schedule recurring polls every 60 seconds
    this.intervalId = setInterval(() => {
      this.pollCycle();
    }, this.pollInterval);

    console.log(`[MetricPoller] Polling every ${this.pollInterval / 1000} seconds`);
  }

  /**
   * Stop the background polling service
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[MetricPoller] Stopped');
  }

  /**
   * Check if the poller is currently running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Poll cycle - executed every 60 seconds
   * Polls all active Netdata and Unraid integrations
   */
  private async pollCycle() {
    try {
      const db = getDb();

      // Get all active integrations that support threshold metrics
      // Netdata: cpu, memory, disk, network metrics
      // Unraid: cpu, memory, disk, docker, temperature metrics
      // NOT uptime-kuma: uses statusPoller for status change notifications
      const integrations = db.prepare(`
        SELECT id, service_name, service_type, poll_interval
        FROM integrations
        WHERE is_active = 1
          AND service_type IN ('netdata', 'unraid')
        ORDER BY service_name
      `).all() as Array<{
        id: number;
        service_name: string;
        service_type: string;
        poll_interval: number;
      }>;

      if (integrations.length === 0) {
        console.log('[MetricPoller] No active metric integrations found');
        return;
      }

      console.log(`[MetricPoller] Polling ${integrations.length} integrations`);

      // Poll each integration
      for (const integration of integrations) {
        try {
          // Call monitoring service to poll this integration
          // This will:
          // 1. Fetch metrics from driver (cpu, memory, etc.)
          // 2. Call evaluateThresholdRules() (added in Phase 2)
          // 3. Trigger alerts if thresholds exceeded
          await monitoringService.pollIntegrationById(integration.id);

          console.log(`[MetricPoller] Successfully polled ${integration.service_name}`);
        } catch (error) {
          // Log error but continue polling other integrations
          console.error(
            `[MetricPoller] Failed to poll ${integration.service_name}:`,
            error instanceof Error ? error.message : error
          );
        }
      }

      console.log('[MetricPoller] Poll cycle complete');
    } catch (error) {
      console.error('[MetricPoller] Poll cycle error:', error);
    }
  }
}

// Singleton instance - only one poller should run
export const metricPoller = new MetricPoller();

// Auto-start on server initialization
// Only runs on server-side (not in browser)
if (typeof window === 'undefined') {
  try {
    metricPoller.start();
    console.log('[MetricPoller] Auto-started on server load');
  } catch (error) {
    console.error('[MetricPoller] Failed to auto-start:', error);
  }
}
