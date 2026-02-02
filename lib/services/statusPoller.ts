/**
 * Status Poller Service
 * Background polling service for monitoring card status via SSE
 */

import { getDb } from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { createDriver } from './driverFactory';
import { UptimeKumaDriver } from '@/drivers/uptime-kuma';
import { UnraidDriver } from '@/drivers/unraid';
import type { Integration, IntegrationCredentials, Card } from '@/lib/types';

export type CardStatus = 'online' | 'warning' | 'offline';

interface CardMapping {
  integrationId: number;
  monitorName: string;
}

interface SSEClient {
  id: string;
  controller: ReadableStreamDefaultController;
}

class StatusPoller {
  // In-memory caches
  private monitorCacheByIntegration: Map<number, Map<string, 'up' | 'down'>> = new Map();
  private cardStatusCache: Map<number, CardStatus> = new Map();
  private cardMappings: Map<number, CardMapping> = new Map();
  private integrationReachable: Map<number, boolean> = new Map();

  // SSE management
  private sseClients: Set<SSEClient> = new Set();

  // Polling management
  private pollInterval: NodeJS.Timeout | null = null;
  private currentSourceId: number | null = null;
  private isStarted = false;

  /**
   * Start the status polling service
   */
  async start() {
    if (this.isStarted) {
      console.log('[StatusPoller] Already started');
      return;
    }

    console.log('[StatusPoller] Starting...');
    this.isStarted = true;

    const db = getDb();
    const setting = db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get('status_source_id') as { value: string | null } | undefined;

    const sourceId = setting?.value ? parseInt(setting.value, 10) : null;

    if (!sourceId) {
      console.log('[StatusPoller] No status source configured - setting all cards to warning');
      await this.loadCardMappings();
      this.setAllCardsToWarning();
      return;
    }

    this.currentSourceId = sourceId;
    await this.loadCardMappings();

    // Do immediate first poll
    await this.pollCycle();

    // Get poll interval from integration
    const integration = db
      .prepare('SELECT poll_interval FROM integrations WHERE id = ?')
      .get(sourceId) as { poll_interval: number } | undefined;

    const interval = integration?.poll_interval || 30000;

    // Start interval polling
    this.pollInterval = setInterval(() => this.pollCycle(), interval);
    console.log(`[StatusPoller] Started with interval ${interval}ms`);
  }

  /**
   * Stop the polling service
   */
  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isStarted = false;
    console.log('[StatusPoller] Stopped');
  }

  /**
   * Restart the polling service (after config change)
   */
  async restart() {
    console.log('[StatusPoller] Restarting...');
    this.stop();
    this.monitorCacheByIntegration.clear();
    this.cardStatusCache.clear();
    this.cardMappings.clear();
    this.integrationReachable.clear();
    await this.start();
  }

  /**
   * Load card-to-monitor mappings from database
   */
  private async loadCardMappings() {
    const db = getDb();
    const cards = db
      .prepare(`SELECT id, status_source_id, status_monitor_name
                FROM cards
                WHERE show_status = 1`)
      .all() as Array<{
        id: number;
        status_source_id: number | null;
        status_monitor_name: string | null;
      }>;

    this.cardMappings.clear();

    for (const card of cards) {
      // Use card-specific source or fall back to global
      const integrationId = card.status_source_id ?? this.currentSourceId;

      if (integrationId && card.status_monitor_name) {
        this.cardMappings.set(card.id, {
          integrationId,
          monitorName: card.status_monitor_name,
        });
      }
    }

    console.log(`[StatusPoller] Loaded ${this.cardMappings.size} card mappings`);
  }

  /**
   * Set all cards to warning status
   */
  private setAllCardsToWarning() {
    const db = getDb();
    const cards = db
      .prepare('SELECT id FROM cards WHERE show_status = 1')
      .all() as Array<{ id: number }>;

    const previousCache = new Map(this.cardStatusCache);

    cards.forEach(card => {
      this.cardStatusCache.set(card.id, 'warning');
    });

    // Broadcast if there are changes
    const diff = this.computeDiff(previousCache, this.cardStatusCache);
    if (diff) {
      this.broadcast(diff);
    }
  }

  /**
   * Main polling cycle
   */
  private async pollCycle() {
    if (!this.currentSourceId) {
      return;
    }

    const db = getDb();

    // Get all unique integration IDs (global + per-card overrides)
    const uniqueIntegrationIds = new Set<number>();

    // Add global source
    if (this.currentSourceId) {
      uniqueIntegrationIds.add(this.currentSourceId);
    }

    // Add per-card sources
    this.cardMappings.forEach(mapping => {
      uniqueIntegrationIds.add(mapping.integrationId);
    });

    // Poll each integration
    for (const integrationId of uniqueIntegrationIds) {
      await this.pollIntegration(integrationId, db);
    }

    // Build new card status map
    const previousCache = new Map(this.cardStatusCache);
    this.buildCardStatusMap();

    // Compute diff and broadcast
    const diff = this.computeDiff(previousCache, this.cardStatusCache);
    if (diff) {
      // Evaluate notification rules for status changes
      await this.evaluateNotificationRules(diff, previousCache);

      this.broadcast(diff);
    }

    const totalMonitors = Array.from(this.monitorCacheByIntegration.values())
      .reduce((sum, cache) => sum + cache.size, 0);
    console.log(`[StatusPoller] Poll complete - ${totalMonitors} total monitors, ${this.cardStatusCache.size} cards`);
  }

  /**
   * Poll a single integration and update its monitor cache
   */
  private async pollIntegration(integrationId: number, db: any) {
    const integration = db
      .prepare('SELECT * FROM integrations WHERE id = ?')
      .get(integrationId) as Integration | undefined;

    if (!integration) {
      console.error(`[StatusPoller] Integration ${integrationId} not found`);
      this.integrationReachable.set(integrationId, false);
      return;
    }

    try {
      // Decrypt credentials
      if (!integration.credentials) {
        throw new Error('No credentials configured');
      }

      const credentials = JSON.parse(
        decrypt(integration.credentials)
      ) as IntegrationCredentials;

      // Create driver and fetch monitors
      const driver = createDriver(
        integration.id,
        integration.service_type,
        credentials
      );

      let monitors: Array<{ name: string; status: 'up' | 'down' }> = [];

      if (integration.service_type === 'uptime-kuma') {
        monitors = await (driver as UptimeKumaDriver).fetchMonitorList();
      } else if (integration.service_type === 'unraid') {
        const dockerData = await (driver as UnraidDriver).fetchDocker();
        const containers = dockerData.metadata?.containers || [];
        monitors = containers.map((c: any) => ({
          name: (Array.isArray(c.name) ? c.name[0] : c.name) || c.id, // Unraid driver stores names array as 'name'
          status: c.state?.toLowerCase() === 'running' ? ('up' as const) : ('down' as const),
        }));
      }

      // Update monitor cache for this integration (lowercase keys for case-insensitive lookup)
      const integrationCache = new Map<string, 'up' | 'down'>();
      monitors.forEach(monitor => {
        integrationCache.set(monitor.name.toLowerCase(), monitor.status);
      });
      this.monitorCacheByIntegration.set(integrationId, integrationCache);

      this.integrationReachable.set(integrationId, true);

      console.log(`[StatusPoller] Polled integration ${integrationId} (${integration.service_name}): ${monitors.length} monitors`);
    } catch (error) {
      console.error(`[StatusPoller] Failed to poll integration ${integrationId}:`, error instanceof Error ? error.message : error);
      this.integrationReachable.set(integrationId, false);
    }
  }

  /**
   * Build card status map from monitor cache
   */
  private buildCardStatusMap() {
    const db = getDb();
    const allCards = db
      .prepare('SELECT id FROM cards WHERE show_status = 1')
      .all() as Array<{ id: number }>;

    allCards.forEach(card => {
      const mapping = this.cardMappings.get(card.id);

      if (!mapping) {
        // No mapping → warning
        this.cardStatusCache.set(card.id, 'warning');
        return;
      }

      // Check if the integration for this card is reachable
      const isReachable = this.integrationReachable.get(mapping.integrationId);
      if (isReachable === false) {
        // Integration unreachable → warning
        this.cardStatusCache.set(card.id, 'warning');
        return;
      }

      // Get monitor cache for this card's integration
      const integrationCache = this.monitorCacheByIntegration.get(mapping.integrationId);
      if (!integrationCache) {
        // No cache for this integration → warning
        this.cardStatusCache.set(card.id, 'warning');
        return;
      }

      // Lookup monitor status (case-insensitive)
      const monitorStatus = integrationCache.get(mapping.monitorName.toLowerCase());

      if (!monitorStatus) {
        // Monitor not found in poll results → warning
        this.cardStatusCache.set(card.id, 'warning');
        return;
      }

      // Monitor found → online or offline based on status
      this.cardStatusCache.set(
        card.id,
        monitorStatus === 'up' ? 'online' : 'offline'
      );
    });
  }

  /**
   * Compute diff between two status maps
   */
  private computeDiff(
    oldMap: Map<number, CardStatus>,
    newMap: Map<number, CardStatus>
  ): Record<number, CardStatus> | null {
    const diff: Record<number, CardStatus> = {};

    newMap.forEach((status, cardId) => {
      if (oldMap.get(cardId) !== status) {
        diff[cardId] = status;
      }
    });

    return Object.keys(diff).length > 0 ? diff : null;
  }

  /**
   * Broadcast status update to all SSE clients
   */
  private broadcast(data: Record<number, CardStatus>) {
    const message = `event: status\ndata: ${JSON.stringify(data)}\n\n`;

    this.sseClients.forEach(client => {
      try {
        client.controller.enqueue(new TextEncoder().encode(message));
      } catch (error) {
        console.error('[StatusPoller] Failed to send to client:', error);
        this.sseClients.delete(client);
      }
    });
  }

  /**
   * Evaluate notification rules for status changes
   */
  private async evaluateNotificationRules(
    diff: Record<number, CardStatus>,
    previousCache: Map<number, CardStatus>
  ) {
    try {
      const { evaluateBulkStatusChanges } = await import('./alertEvaluator');

      // Convert diff to status change events
      const statusChanges: Array<{
        cardId: number;
        oldStatus: string;
        newStatus: string;
      }> = [];

      for (const [cardIdStr, newStatus] of Object.entries(diff)) {
        const cardId = Number(cardIdStr);
        const oldStatus = previousCache.get(cardId);

        if (oldStatus && oldStatus !== newStatus) {
          statusChanges.push({
            cardId,
            oldStatus,
            newStatus,
          });
        }
      }

      if (statusChanges.length > 0) {
        await evaluateBulkStatusChanges(statusChanges);
      }
    } catch (error) {
      console.error('[StatusPoller] Failed to evaluate notification rules:', error);
      // Don't throw - polling should continue even if notifications fail
    }
  }

  /**
   * Register a new SSE client
   */
  registerClient(clientId: string, controller: ReadableStreamDefaultController) {
    const client: SSEClient = { id: clientId, controller };
    this.sseClients.add(client);

    // Send current full state immediately
    const initialState = Object.fromEntries(this.cardStatusCache);
    const message = `event: status\ndata: ${JSON.stringify(initialState)}\n\n`;

    try {
      controller.enqueue(new TextEncoder().encode(message));
    } catch (error) {
      console.error('[StatusPoller] Failed to send initial state:', error);
      this.sseClients.delete(client);
    }

    console.log(`[StatusPoller] Client ${clientId} connected (${this.sseClients.size} total)`);
  }

  /**
   * Unregister an SSE client
   */
  unregisterClient(clientId: string) {
    const client = Array.from(this.sseClients).find(c => c.id === clientId);
    if (client) {
      this.sseClients.delete(client);
      console.log(`[StatusPoller] Client ${clientId} disconnected (${this.sseClients.size} remaining)`);
    }
  }

  /**
   * Get current card status map (for initial SSE payload)
   */
  getCurrentStatus(): Record<number, CardStatus> {
    return Object.fromEntries(this.cardStatusCache);
  }
}

// Singleton instance
export const statusPoller = new StatusPoller();
