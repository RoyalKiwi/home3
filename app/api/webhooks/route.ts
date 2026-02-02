import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { encrypt } from '@/lib/crypto';
import type { WebhookConfig, CreateWebhookRequest } from '@/lib/types';

/**
 * GET /api/webhooks
 * List all webhooks (admin-only, URLs masked)
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const db = getDb();

    const webhooks = db
      .prepare(
        `SELECT
          id,
          name,
          provider_type,
          is_active,
          created_at,
          updated_at
        FROM webhook_configs
        ORDER BY created_at DESC`
      )
      .all() as Omit<WebhookConfig, 'webhook_url'>[];

    // Add masked webhook URL (last 4 chars)
    const webhooksWithMasked = webhooks.map((webhook: any) => {
      const fullUrl = db.prepare('SELECT webhook_url FROM webhook_configs WHERE id = ?').get(webhook.id) as { webhook_url: string };
      const lastFour = fullUrl.webhook_url.slice(-4);
      return {
        ...webhook,
        webhook_url_masked: `...${lastFour}`,
      };
    });

    return NextResponse.json({
      success: true,
      data: webhooksWithMasked,
    });
  } catch (error) {
    console.error('Error fetching webhooks:', error);

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to fetch webhooks' }, { status: 500 });
  }
}

/**
 * POST /api/webhooks
 * Create a new webhook (admin-only)
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const body = (await request.json()) as CreateWebhookRequest;

    // Validate required fields
    if (!body.name || !body.provider_type || !body.webhook_url) {
      return NextResponse.json(
        { error: 'Missing required fields: name, provider_type, webhook_url' },
        { status: 400 }
      );
    }

    // Validate provider type
    const validProviders = ['discord', 'telegram', 'pushover'];
    if (!validProviders.includes(body.provider_type)) {
      return NextResponse.json(
        { error: `Invalid provider_type. Must be one of: ${validProviders.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate webhook URL format based on provider
    const urlValid = validateWebhookUrl(body.webhook_url, body.provider_type);
    if (!urlValid) {
      return NextResponse.json(
        {
          error: `Invalid webhook URL format for ${body.provider_type}. ${getUrlFormatHelp(body.provider_type)}`,
        },
        { status: 400 }
      );
    }

    const db = getDb();

    // Encrypt webhook URL
    const encryptedUrl = encrypt(body.webhook_url);

    // Insert webhook
    const result = db
      .prepare(
        `INSERT INTO webhook_configs (name, provider_type, webhook_url, is_active)
         VALUES (?, ?, ?, ?)`
      )
      .run(body.name, body.provider_type, encryptedUrl, body.is_active ?? true);

    const webhook = db
      .prepare('SELECT id, name, provider_type, is_active, created_at, updated_at FROM webhook_configs WHERE id = ?')
      .get(result.lastInsertRowid) as WebhookConfig;

    return NextResponse.json({
      success: true,
      data: webhook,
    });
  } catch (error) {
    console.error('Error creating webhook:', error);

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to create webhook' }, { status: 500 });
  }
}

/**
 * Validate webhook URL format based on provider
 */
function validateWebhookUrl(url: string, provider: string): boolean {
  const patterns: Record<string, RegExp> = {
    discord: /^https:\/\/(canary\.|ptb\.)?discord\.com\/api\/webhooks\/\d+\/.+$/,
    telegram: /^https:\/\/api\.telegram\.org\/bot[\w:-]+\/sendMessage$/,
    pushover: /^https:\/\/api\.pushover\.net\/1\/messages\.json(\?.*)?$/,
  };

  const pattern = patterns[provider];
  return pattern ? pattern.test(url) : false;
}

/**
 * Get URL format help message
 */
function getUrlFormatHelp(provider: string): string {
  const help: Record<string, string> = {
    discord: 'Must be a Discord webhook URL (https://discord.com/api/webhooks/...)',
    telegram: 'Must be a Telegram bot URL (https://api.telegram.org/bot.../sendMessage)',
    pushover: 'Must be a Pushover API URL with token and user parameters',
  };

  return help[provider] || 'Invalid URL format';
}
