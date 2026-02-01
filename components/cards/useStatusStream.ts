'use client';

/**
 * SSE Status Stream Hook
 * Connects to /api/stream/status and maintains real-time card status map
 */

import { useState, useEffect } from 'react';

export type CardStatus = 'online' | 'warning' | 'offline';

export function useStatusStream(): Map<number, CardStatus> {
  const [statuses, setStatuses] = useState<Map<number, CardStatus>>(new Map());

  useEffect(() => {
    let eventSource: EventSource | null = null;

    // Check if a status source is configured
    fetch('/api/settings/status-source')
      .then(res => res.json())
      .then(data => {
        if (!data.data || !data.data.integration_id) {
          // No source configured - keep all statuses as warning (default)
          console.log('[useStatusStream] No status source configured');
          return;
        }

        console.log('[useStatusStream] Status source configured, opening SSE connection');

        // Open SSE connection
        eventSource = new EventSource('/api/stream/status');

        eventSource.addEventListener('connected', (event) => {
          const data = JSON.parse(event.data);
          console.log('[useStatusStream] Connected:', data.client_id);
        });

        eventSource.addEventListener('status', (event) => {
          const payload = JSON.parse(event.data);

          // payload is either full map or diff
          setStatuses(prev => {
            const next = new Map(prev);
            Object.entries(payload).forEach(([cardIdStr, status]) => {
              const cardId = Number(cardIdStr);
              next.set(cardId, status as CardStatus);
            });
            return next;
          });
        });

        eventSource.addEventListener('error', (event) => {
          console.error('[useStatusStream] SSE error:', event);
          // EventSource will auto-reconnect unless we close it
          // Keep the connection for auto-retry
        });
      })
      .catch(err => {
        console.error('[useStatusStream] Failed to check status source:', err);
        // Fail silently - no status updates
      });

    // Cleanup on unmount
    return () => {
      if (eventSource) {
        console.log('[useStatusStream] Closing SSE connection');
        eventSource.close();
      }
    };
  }, []);

  return statuses;
}
