/**
 * Notification Service - Phase 7
 *
 * Purpose: Webhook-based notification system with provider abstraction
 * Supports: Discord, Telegram, Pushover
 * Features: Flood control, retry logic, severity-based formatting
 */

import { getDb } from '../db';
import { decrypt } from '../crypto';
import type {
  WebhookProviderType,
  NotificationPayload,
  Severity,
} from '../types';

// =============================================================================
// WEBHOOK PROVIDER INTERFACE
// =============================================================================

interface WebhookProvider {
  name: string;
  send(webhookUrl: string, payload: NotificationPayload): Promise<void>;
  testConnection(webhookUrl: string): Promise<boolean>;
}

// =============================================================================
// DISCORD PROVIDER
// =============================================================================

class DiscordProvider implements WebhookProvider {
  name = 'Discord';

  private getSeverityColor(severity: Severity): number {
    const colors = {
      info: 0x3B82F6,      // Blue
      warning: 0xF59E0B,   // Amber
      critical: 0xEF4444,  // Red
    };
    return colors[severity];
  }

  private getSeverityEmoji(severity: Severity): string {
    const emojis = {
      info: 'ℹ️',
      warning: '⚠️',
      critical: '🔴',
    };
    return emojis[severity];
  }

  async send(webhookUrl: string, payload: NotificationPayload): Promise<void> {
    const embed = {
      title: `${this.getSeverityEmoji(payload.severity)} ${payload.title}`,
      description: payload.message,
      color: this.getSeverityColor(payload.severity),
      timestamp: new Date().toISOString(),
      fields: [] as Array<{ name: string; value: string; inline?: boolean }>,
    };

    // Add metadata as fields
    if (payload.metadata) {
      if (payload.metadata.cardName) {
        embed.fields.push({
          name: 'Card',
          value: payload.metadata.cardName,
          inline: true,
        });
      }
      if (payload.metadata.metricValue !== undefined && payload.metadata.threshold !== undefined) {
        embed.fields.push({
          name: 'Current Value',
          value: `${payload.metadata.metricValue}`,
          inline: true,
        });
        embed.fields.push({
          name: 'Threshold',
          value: `${payload.metadata.threshold}`,
          inline: true,
        });
      }
      if (payload.metadata.oldStatus && payload.metadata.newStatus) {
        embed.fields.push({
          name: 'Status Change',
          value: `${payload.metadata.oldStatus} → ${payload.metadata.newStatus}`,
          inline: false,
        });
      }
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!response.ok) {
      throw new Error(`Discord webhook failed: ${response.status} ${response.statusText}`);
    }
  }

  async testConnection(webhookUrl: string): Promise<boolean> {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: '✅ Test Notification',
            description: 'This is a test notification from Homepage3',
            color: 0x22C55E, // Green
            timestamp: new Date().toISOString(),
          }],
        }),
      });
      return response.ok;
    } catch (error) {
      console.error('[Discord] Test connection failed:', error);
      return false;
    }
  }
}

// =============================================================================
// TELEGRAM PROVIDER
// =============================================================================

class TelegramProvider implements WebhookProvider {
  name = 'Telegram';

  private getSeverityEmoji(severity: Severity): string {
    const emojis = {
      info: 'ℹ️',
      warning: '⚠️',
      critical: '🔴',
    };
    return emojis[severity];
  }

  async send(webhookUrl: string, payload: NotificationPayload): Promise<void> {
    let message = `${this.getSeverityEmoji(payload.severity)} **${payload.title}**\n\n${payload.message}`;

    // Add metadata
    if (payload.metadata) {
      message += '\n\n';
      if (payload.metadata.cardName) {
        message += `Card: ${payload.metadata.cardName}\n`;
      }
      if (payload.metadata.metricValue !== undefined && payload.metadata.threshold !== undefined) {
        message += `Value: ${payload.metadata.metricValue} (Threshold: ${payload.metadata.threshold})\n`;
      }
      if (payload.metadata.oldStatus && payload.metadata.newStatus) {
        message += `Status: ${payload.metadata.oldStatus} → ${payload.metadata.newStatus}\n`;
      }
    }

    // Truncate to Telegram's 4096 character limit
    if (message.length > 4096) {
      message = message.substring(0, 4093) + '...';
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    if (!response.ok) {
      throw new Error(`Telegram webhook failed: ${response.status} ${response.statusText}`);
    }
  }

  async testConnection(webhookUrl: string): Promise<boolean> {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: '✅ **Test Notification**\n\nThis is a test notification from Homepage3',
          parse_mode: 'Markdown',
        }),
      });
      return response.ok;
    } catch (error) {
      console.error('[Telegram] Test connection failed:', error);
      return false;
    }
  }
}

// =============================================================================
// PUSHOVER PROVIDER
// =============================================================================

class PushoverProvider implements WebhookProvider {
  name = 'Pushover';

  private getSeverityPriority(severity: Severity): number {
    const priorities = {
      info: 0,        // Normal priority
      warning: 1,     // High priority
      critical: 2,    // Emergency priority (requires acknowledgment)
    };
    return priorities[severity];
  }

  async send(webhookUrl: string, payload: NotificationPayload): Promise<void> {
    // Pushover expects URL in format: https://api.pushover.net/1/messages.json
    // webhook_url should store: "token=APP_TOKEN&user=USER_KEY"

    let message = payload.message;

    // Add metadata to message
    if (payload.metadata) {
      if (payload.metadata.cardName) {
        message += `\n\nCard: ${payload.metadata.cardName}`;
      }
      if (payload.metadata.metricValue !== undefined && payload.metadata.threshold !== undefined) {
        message += `\nValue: ${payload.metadata.metricValue} (Threshold: ${payload.metadata.threshold})`;
      }
      if (payload.metadata.oldStatus && payload.metadata.newStatus) {
        message += `\nStatus: ${payload.metadata.oldStatus} → ${payload.metadata.newStatus}`;
      }
    }

    // Truncate to Pushover limits
    const title = payload.title.length > 250 ? payload.title.substring(0, 247) + '...' : payload.title;
    if (message.length > 1024) {
      message = message.substring(0, 1021) + '...';
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        title,
        message,
        priority: this.getSeverityPriority(payload.severity).toString(),
        timestamp: Math.floor(Date.now() / 1000).toString(),
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Pushover webhook failed: ${response.status} ${response.statusText}`);
    }
  }

  async testConnection(webhookUrl: string): Promise<boolean> {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          title: 'Test Notification',
          message: 'This is a test notification from Homepage3',
          priority: '0',
        }).toString(),
      });
      return response.ok;
    } catch (error) {
      console.error('[Pushover] Test connection failed:', error);
      return false;
    }
  }
}

// =============================================================================
// WEBHOOK PROVIDER FACTORY
// =============================================================================

class WebhookProviderFactory {
  private static providers: Map<WebhookProviderType, WebhookProvider> = new Map<WebhookProviderType, WebhookProvider>([
    ['discord', new DiscordProvider()],
    ['telegram', new TelegramProvider()],
    ['pushover', new PushoverProvider()],
  ]);

  static create(type: WebhookProviderType): WebhookProvider {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new Error(`Unsupported webhook provider: ${type}`);
    }
    return provider;
  }
}

// =============================================================================
// FLOOD CONTROL MANAGER
// =============================================================================

class FloodControlManager {
  private floodState: Map<number, number> = new Map(); // ruleId -> lastAlertTimestamp
  private settingsKey = 'notification_flood_state';

  constructor() {
    this.loadState();
  }

  private loadState(): void {
    try {
      const db = getDb();
      const result = db.prepare('SELECT value FROM settings WHERE key = ?').get(this.settingsKey) as { value: string } | undefined;

      if (result) {
        const state = JSON.parse(result.value) as Record<string, number>;
        this.floodState = new Map(Object.entries(state).map(([k, v]) => [Number(k), v]));
      }
    } catch (error) {
      console.error('[FloodControl] Failed to load state:', error);
    }
  }

  private saveState(): void {
    try {
      const db = getDb();
      const state = Object.fromEntries(this.floodState.entries());

      db.prepare(`
        UPDATE settings
        SET value = ?, updated_at = datetime('now')
        WHERE key = ?
      `).run(JSON.stringify(state), this.settingsKey);
    } catch (error) {
      console.error('[FloodControl] Failed to save state:', error);
    }
  }

  canSend(ruleId: number, cooldownMinutes: number): boolean {
    const lastAlert = this.floodState.get(ruleId);
    if (!lastAlert) {
      return true; // No previous alert
    }

    const cooldownMs = cooldownMinutes * 60 * 1000;
    const timeSinceLastAlert = Date.now() - lastAlert;

    return timeSinceLastAlert >= cooldownMs;
  }

  recordAlert(ruleId: number): void {
    this.floodState.set(ruleId, Date.now());
    this.saveState();
  }

  clear(ruleId: number): void {
    this.floodState.delete(ruleId);
    this.saveState();
  }
}

// =============================================================================
// NOTIFICATION SERVICE (MAIN ORCHESTRATOR)
// =============================================================================

class NotificationService {
  private floodControl = new FloodControlManager();
  private retryAttempts = 3;
  private retryDelays = [1000, 3000, 9000]; // Exponential backoff: 1s, 3s, 9s

  async sendAlert(
    ruleId: number,
    payload: NotificationPayload,
    bypassFloodControl = false
  ): Promise<void> {
    try {
      const db = getDb();

      // Get rule details with webhook
      const rule = db.prepare(`
        SELECT nr.*, wc.webhook_url, wc.provider_type, wc.name as webhook_name
        FROM notification_rules nr
        JOIN webhook_configs wc ON nr.webhook_id = wc.id
        WHERE nr.id = ? AND nr.is_active = 1 AND wc.is_active = 1
      `).get(ruleId) as any;

      if (!rule) {
        console.warn(`[Notifications] Rule ${ruleId} not found or inactive`);
        return;
      }

      // Check flood control (unless bypassed for testing)
      if (!bypassFloodControl && !this.floodControl.canSend(ruleId, rule.cooldown_minutes)) {
        console.log(`[Notifications] Rule ${ruleId} blocked by flood control (cooldown: ${rule.cooldown_minutes}m)`);
        return;
      }

      // Decrypt webhook URL
      const webhookUrl = decrypt(rule.webhook_url);

      // Get provider
      const provider = WebhookProviderFactory.create(rule.provider_type);

      // Send with retry logic
      await this.sendWithRetry(provider, webhookUrl, payload);

      // Record alert (update flood control state)
      if (!bypassFloodControl) {
        this.floodControl.recordAlert(ruleId);
      }

      console.log(`[Notifications] Alert sent via ${rule.webhook_name} (${provider.name}): ${payload.title}`);
    } catch (error) {
      console.error(`[Notifications] Failed to send alert for rule ${ruleId}:`, error);
      // Don't throw - we want system to continue even if notifications fail
    }
  }

  private async sendWithRetry(
    provider: WebhookProvider,
    webhookUrl: string,
    payload: NotificationPayload
  ): Promise<void> {
    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        await provider.send(webhookUrl, payload);
        return; // Success
      } catch (error) {
        if (attempt === this.retryAttempts - 1) {
          throw error; // Last attempt failed
        }

        const delay = this.retryDelays[attempt];
        console.warn(`[Notifications] Retry ${attempt + 1}/${this.retryAttempts} after ${delay}ms:`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async testWebhook(
    webhookId: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      const db = getDb();

      const webhook = db.prepare('SELECT * FROM webhook_configs WHERE id = ?').get(webhookId) as any;

      if (!webhook) {
        return { success: false, message: 'Webhook not found' };
      }

      const webhookUrl = decrypt(webhook.webhook_url);
      const provider = WebhookProviderFactory.create(webhook.provider_type);

      const success = await provider.testConnection(webhookUrl);

      return {
        success,
        message: success
          ? `Test notification sent successfully to ${webhook.name}`
          : `Failed to send test notification to ${webhook.name}`,
      };
    } catch (error) {
      console.error(`[Notifications] Test webhook ${webhookId} failed:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const notificationService = new NotificationService();
