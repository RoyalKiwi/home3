import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { maintenanceSSE } from '@/lib/sse-managers';

/**
 * GET /api/stream/maintenance
 * SSE stream for maintenance mode state changes (public)
 */
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const clientId = Math.random().toString(36).substring(7);

      // Register client with SSE manager
      maintenanceSSE.registerClient(clientId, (eventType, data) => {
        const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      });

      // Send initial state
      const db = getDb();
      const setting = db
        .prepare('SELECT value FROM settings WHERE key = ?')
        .get('maintenance_mode') as { value: string } | undefined;

      const enabled = setting?.value === 'true';

      const initialMessage = `event: MT_STATE_CHANGE\ndata: ${JSON.stringify({ enabled })}\n\n`;
      controller.enqueue(encoder.encode(initialMessage));

      // Keep-alive ping every 30 seconds
      const keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(':keep-alive\n\n'));
        } catch (error) {
          // Client disconnected
          clearInterval(keepAliveInterval);
        }
      }, 30000);

      // Cleanup on disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(keepAliveInterval);
        maintenanceSSE.deregisterClient(clientId);
        try {
          controller.close();
        } catch (error) {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
