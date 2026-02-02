import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { processUnraidEvent, validateUnraidEvent } from '@/lib/services/unraidEventEvaluator';

/**
 * POST /api/unraid-webhook
 * Receive webhook events from Unraid OS
 * Authentication: Bearer token (API key stored in settings)
 *
 * Unraid sends notifications to this endpoint when system events occur:
 * - Array started/stopped
 * - Parity check events
 * - Docker container events
 * - Drive temperature alerts
 * - System health warnings
 */
export async function POST(request: NextRequest) {
  try {
    // Check if webhook receiver is enabled
    const db = getDb();
    const enabledSetting = db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get('unraid_webhook_enabled') as { value: string } | undefined;

    if (enabledSetting?.value !== 'true') {
      return NextResponse.json(
        { error: 'Unraid webhook receiver is disabled' },
        { status: 403 }
      );
    }

    // Verify API key from Authorization header
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header. Expected: Bearer <API_KEY>' },
        { status: 401 }
      );
    }

    const providedKey = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Get stored API key from settings
    const apiKeySetting = db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get('unraid_webhook_api_key') as { value: string } | undefined;

    if (!apiKeySetting?.value) {
      return NextResponse.json(
        { error: 'Unraid webhook API key not configured. Please set up in admin settings.' },
        { status: 500 }
      );
    }

    // Compare API keys
    if (providedKey !== apiKeySetting.value) {
      console.warn('[UnraidWebhook] Invalid API key attempt');
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    // Parse and validate event payload
    const payload = await request.json();

    if (!validateUnraidEvent(payload)) {
      return NextResponse.json(
        {
          error: 'Invalid event payload',
          details: 'Expected fields: event (string), subject (string), description (string)',
        },
        { status: 400 }
      );
    }

    // Process event (evaluate notification rules and send alerts)
    await processUnraidEvent(payload);

    console.log(`[UnraidWebhook] Successfully processed event: ${payload.event}`);

    return NextResponse.json({
      success: true,
      message: 'Event received and processed',
      event: payload.event,
    });
  } catch (error) {
    console.error('[UnraidWebhook] Error processing webhook:', error);

    return NextResponse.json(
      {
        error: 'Failed to process webhook event',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/unraid-webhook
 * Get webhook configuration and status (admin-only)
 * Returns webhook URL and API key for Unraid setup
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Add requireAuth() when ready to test
    // await requireAuth();

    const db = getDb();

    // Get configuration
    const enabledSetting = db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get('unraid_webhook_enabled') as { value: string } | undefined;

    const apiKeySetting = db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get('unraid_webhook_api_key') as { value: string } | undefined;

    const enabled = enabledSetting?.value === 'true';
    const hasApiKey = !!apiKeySetting?.value;

    // Get webhook URL (construct from request)
    const baseUrl = new URL(request.url).origin;
    const webhookUrl = `${baseUrl}/api/unraid-webhook`;

    // Get recent event stats
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN processed = 1 THEN 1 ELSE 0 END) as processed,
        SUM(CASE WHEN received_at >= datetime('now', '-1 day') THEN 1 ELSE 0 END) as last24h
      FROM unraid_events
    `).get() as { total: number; processed: number; last24h: number };

    return NextResponse.json({
      success: true,
      data: {
        enabled,
        configured: hasApiKey,
        webhookUrl,
        apiKey: hasApiKey ? apiKeySetting!.value : null, // Show API key for admin setup
        stats: {
          totalEvents: stats?.total || 0,
          processedEvents: stats?.processed || 0,
          eventsLast24h: stats?.last24h || 0,
        },
      },
    });
  } catch (error) {
    console.error('[UnraidWebhook] Error fetching configuration:', error);

    return NextResponse.json(
      { error: 'Failed to fetch webhook configuration' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/unraid-webhook
 * Update webhook configuration (admin-only)
 * Enables/disables receiver and generates/updates API key
 */
export async function PATCH(request: NextRequest) {
  try {
    // TODO: Add requireAuth() when ready to test
    // await requireAuth();

    const body = await request.json();
    const db = getDb();

    // Update enabled state
    if (typeof body.enabled === 'boolean') {
      db.prepare(`
        UPDATE settings
        SET value = ?, updated_at = datetime('now')
        WHERE key = 'unraid_webhook_enabled'
      `).run(body.enabled ? 'true' : 'false');
    }

    // Generate new API key if requested
    if (body.generateApiKey === true) {
      // Generate random API key (32 characters)
      const apiKey = Array.from(crypto.getRandomValues(new Uint8Array(24)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      db.prepare(`
        UPDATE settings
        SET value = ?, updated_at = datetime('now')
        WHERE key = 'unraid_webhook_api_key'
      `).run(apiKey);

      return NextResponse.json({
        success: true,
        message: 'API key generated successfully',
        apiKey,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook configuration updated',
    });
  } catch (error) {
    console.error('[UnraidWebhook] Error updating configuration:', error);

    return NextResponse.json(
      { error: 'Failed to update webhook configuration' },
      { status: 500 }
    );
  }
}
