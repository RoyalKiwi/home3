'use client';

import { useState, useEffect } from 'react';
import styles from './WebhookSection.module.css';
import type { WebhookConfig } from '@/lib/types';

/**
 * Webhook Section Component
 * Manages webhook configurations in API Settings page
 */
export default function WebhookSection() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const fetchWebhooks = async () => {
    try {
      const res = await fetch('/api/webhooks');
      const data = await res.json();
      if (res.ok) {
        setWebhooks(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch webhooks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async (id: number) => {
    try {
      const res = await fetch(`/api/webhooks/${id}/test`, { method: 'POST' });
      const data = await res.json();
      alert(res.ok ? 'Test notification sent!' : data.error);
    } catch (error) {
      alert('Failed to send test notification');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this webhook? Associated notification rules will also be deleted.')) {
      return;
    }

    try {
      const res = await fetch(`/api/webhooks/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchWebhooks();
      }
    } catch (error) {
      alert('Failed to delete webhook');
    }
  };

  if (loading) return <div>Loading webhooks...</div>;

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2>Webhook Configurations</h2>
        <button className={styles.btnPrimary} onClick={() => setShowModal(true)}>
          Add Webhook
        </button>
      </div>

      <p className={styles.description}>
        Configure webhooks to receive notifications from Homepage3.
        Webhooks can be used with Discord, Telegram, and Pushover.
      </p>

      {webhooks.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No webhooks configured</p>
          <p className={styles.hint}>Click "Add Webhook" to get started</p>
        </div>
      ) : (
        <div className={styles.webhookGrid}>
          {webhooks.map((webhook) => (
            <div key={webhook.id} className={styles.webhookCard}>
              <div className={styles.webhookHeader}>
                <span className={styles.webhookIcon}>
                  {webhook.provider_type === 'discord' && '💬'}
                  {webhook.provider_type === 'telegram' && '✈️'}
                  {webhook.provider_type === 'pushover' && '📱'}
                </span>
                <span className={styles.webhookName}>{webhook.name}</span>
                <span className={webhook.is_active ? styles.statusDot : styles.statusDotInactive} />
              </div>
              <p className={styles.webhookProvider}>{webhook.provider_type}</p>
              <p className={styles.webhookUrl}>
                ...{webhook.webhook_url?.slice(-4) || 'encrypted'}
              </p>
              <div className={styles.webhookActions}>
                <button
                  className={styles.btnSmall}
                  onClick={() => handleTest(webhook.id)}
                >
                  Test
                </button>
                <button
                  className={styles.btnSmallDanger}
                  onClick={() => handleDelete(webhook.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal would go here - using existing modal from notifications page */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <p>Webhook modal - See notifications page for full implementation</p>
            <button onClick={() => setShowModal(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
