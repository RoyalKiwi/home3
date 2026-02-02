import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { notificationService } from '@/lib/services/notifications';

/**
 * POST /api/webhooks/[id]/test
 * Test a webhook by sending a test notification (admin-only, bypasses flood control)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();

    const webhookId = parseInt(params.id);
    if (isNaN(webhookId)) {
      return NextResponse.json({ error: 'Invalid webhook ID' }, { status: 400 });
    }

    // Test the webhook
    const result = await notificationService.testWebhook(webhookId);

    return NextResponse.json({
      success: result.success,
      message: result.message,
    }, { status: result.success ? 200 : 500 });
  } catch (error) {
    console.error('Error testing webhook:', error);

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to test webhook', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
