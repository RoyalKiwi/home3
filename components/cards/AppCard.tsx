'use client';

import { useState, useEffect } from 'react';
import type { Card } from '@/lib/types';
import styles from './AppCard.module.css';

interface AppCardProps {
  card: Card;
}

export default function AppCard({ card }: AppCardProps) {
  const [status, setStatus] = useState<'online' | 'warning' | 'offline'>('offline');

  // Parse gradient colors
  const getGradientStyle = () => {
    if (!card.gradient_colors) return {};

    try {
      const colors = JSON.parse(card.gradient_colors);
      if (!Array.isArray(colors) || colors.length === 0) return {};

      return {
        '--grad-1': colors[0] || '#3B82F6',
        '--grad-2': colors[1] || '#A855F7',
        '--grad-3': colors[2] || '#0a192f',
        '--grad-4': colors[3] || '#050608',
      } as any;
    } catch {
      return {};
    }
  };

  // Determine card size class
  const sizeClass = card.size === 'small' ? styles.small :
                    card.size === 'medium' ? styles.medium :
                    styles.large;

  // Determine if card should show gradient (large cards only)
  const showGradient = card.size === 'large' && card.gradient_colors;

  return (
    <a
      href={card.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${styles.card} ${sizeClass} ${showGradient ? styles.withGradient : ''}`}
      style={showGradient ? getGradientStyle() : {}}
    >
      <div className={styles.cardContent}>
        {/* Icon */}
        {card.icon_url && (
          <div className={styles.iconWrapper}>
            <img
              src={card.icon_url}
              alt={card.name}
              className={styles.icon}
            />
          </div>
        )}

        {/* Text Content */}
        <div className={styles.textContent}>
          <h3 className={styles.name}>{card.name}</h3>
          <p className={styles.subtext}>{card.subtext}</p>
        </div>

        {/* Status Indicator (if enabled) */}
        {card.show_status && (
          <div className={styles.statusIndicator}>
            <span className={`${styles.statusDot} ${styles[status]}`}></span>
          </div>
        )}
      </div>

      {/* Gradient Overlay for large cards */}
      {showGradient && <div className={styles.gradientOverlay}></div>}
    </a>
  );
}
