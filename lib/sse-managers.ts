/**
 * SSE Managers - Centralized Server-Sent Events Management
 *
 * Purpose: Singleton SSE managers for different event streams
 * Streams: Maintenance mode, status updates, ticker stats
 */

import { SSEManager } from './sse';

// =============================================================================
// SINGLETON SSE MANAGERS
// =============================================================================

/**
 * Maintenance Mode SSE Manager
 * Broadcasts maintenance mode state changes to all connected clients
 */
export const maintenanceSSE = new SSEManager();

/**
 * Status Updates SSE Manager
 * Future: Could migrate statusPoller to use this instead of its own manager
 */
export const statusSSE = new SSEManager();

/**
 * Ticker Stats SSE Manager
 * Future: Admin tactical ticker broadcasts
 */
export const tickerSSE = new SSEManager();
