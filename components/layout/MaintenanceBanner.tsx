'use client';

import { useEffect, useState } from 'react';
import styles from './MaintenanceBanner.module.css';

export default function MaintenanceBanner() {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Fetch initial state
    fetch('/api/settings/maintenance')
      .then(r => r.json())
      .then(({ data }) => {
        if (data?.enabled) {
          setIsMaintenanceMode(true);
          // Delay visibility for slide-down animation
          setTimeout(() => setIsVisible(true), 100);
        }
      })
      .catch(error => console.error('Failed to fetch maintenance mode:', error));

    // Subscribe to SSE for real-time updates
    const eventSource = new EventSource('/api/stream/maintenance');

    eventSource.addEventListener('MT_STATE_CHANGE', (e) => {
      try {
        const { enabled } = JSON.parse(e.data);

        if (enabled) {
          setIsMaintenanceMode(true);
          // Delay visibility for slide-down animation
          setTimeout(() => setIsVisible(true), 100);
        } else {
          // Hide immediately (slide up)
          setIsVisible(false);
          // Remove from DOM after animation
          setTimeout(() => setIsMaintenanceMode(false), 300);
        }
      } catch (error) {
        console.error('Failed to parse maintenance mode event:', error);
      }
    });

    eventSource.addEventListener('error', (error) => {
      console.error('Maintenance mode SSE error:', error);
      // Auto-reconnect is handled by EventSource
    });

    return () => {
      eventSource.close();
    };
  }, []);

  if (!isMaintenanceMode) return null;

  return (
    <div className={`${styles.banner} ${isVisible ? styles.visible : ''}`}>
      <div className={styles.content}>
        <span className={styles.icon}>⚠️</span>
        <span className={styles.text}>
          Maintenance Mode Active - System may be unavailable or experiencing updates
        </span>
      </div>
    </div>
  );
}
