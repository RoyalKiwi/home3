/**
 * Status Stream SSE Endpoint
 * GET: Server-Sent Events stream for real-time card status updates (public)
 */

import { NextRequest } from 'next/server';
import { statusPoller } from '@/lib/services/statusPoller';

/**
 * GET /api/stream/status
 * Opens an SSE connection and streams status updates
 */
export async function GET(request: NextRequest) {
  // Ensure status poller is started
  await statusPoller.start();

  // Create a TransformStream for SSE
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  // Generate unique client ID
  const clientId = `client-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  // Create a ReadableStream that manages the SSE connection
  const readableStream = new ReadableStream({
    start(controller) {
      // Register client with status poller
      statusPoller.registerClient(clientId, controller);

      // Send connection established event
      const connectMessage = `event: connected\ndata: ${JSON.stringify({ client_id: clientId })}\n\n`;
      controller.enqueue(encoder.encode(connectMessage));

      console.log(`[SSE] Client ${clientId} connected`);
    },
    cancel() {
      // Client disconnected
      statusPoller.unregisterClient(clientId);
      console.log(`[SSE] Client ${clientId} disconnected`);
    },
  });

  // Return SSE response
  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
