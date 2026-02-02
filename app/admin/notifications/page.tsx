'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

type Tab = 'rules' | 'webhooks' | 'maintenance';

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('rules');
  const [rules, setRules] = useState<any[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load data on mount
  useEffect(() => {
    loadRules();
    loadWebhooks();
    loadMaintenanceMode();
  }, []);

  async function loadRules() {
    try {
      const res = await fetch('/api/notification-rules');
      const data = await res.json();
      setRules(data.data || []);
    } catch (error) {
      console.error('Failed to load rules:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadWebhooks() {
    try {
      const res = await fetch('/api/webhooks');
      const data = await res.json();
      setWebhooks(data.data || []);
    } catch (error) {
      console.error('Failed to load webhooks:', error);
    }
  }

  async function loadMaintenanceMode() {
    try {
      const res = await fetch('/api/settings/maintenance');
      const data = await res.json();
      setMaintenanceEnabled(data.data?.enabled || false);
    } catch (error) {
      console.error('Failed to load maintenance mode:', error);
    }
  }

  async function handleDeleteWebhook(id: number, name: string) {
    if (!confirm(`Delete webhook "${name}"? This will also delete all associated rules.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/webhooks/${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadWebhooks();
        loadRules(); // Reload rules since they may have been cascaded
        alert('Webhook deleted successfully');
      } else {
        alert('Failed to delete webhook');
      }
    } catch (error) {
      alert('Failed to delete webhook');
    }
  }

  async function handleTestWebhook(id: number) {
    try {
      const res = await fetch(`/api/webhooks/${id}/test`, { method: 'POST' });
      const data = await res.json();
      alert(data.message || (data.success ? 'Test sent successfully!' : 'Test failed'));
    } catch (error) {
      alert('Failed to send test notification');
    }
  }

  async function handleDeleteRule(id: number, name: string) {
    if (!confirm(`Delete rule "${name}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/notification-rules/${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadRules();
        alert('Rule deleted successfully');
      } else {
        alert('Failed to delete rule');
      }
    } catch (error) {
      alert('Failed to delete rule');
    }
  }

  async function handleTestRule(id: number) {
    try {
      const res = await fetch(`/api/notification-rules/${id}/test`, { method: 'POST' });
      const data = await res.json();
      alert(data.message || (data.success ? 'Test sent successfully!' : 'Test failed'));
    } catch (error) {
      alert('Failed to test rule');
    }
  }

  async function handleToggleMaintenanceMode() {
    try {
      const res = await fetch('/api/settings/maintenance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !maintenanceEnabled }),
      });

      if (res.ok) {
        setMaintenanceEnabled(!maintenanceEnabled);
      } else {
        alert('Failed to toggle maintenance mode');
      }
    } catch (error) {
      alert('Failed to toggle maintenance mode');
    }
  }

  function formatCondition(rule: any): string {
    if (rule.condition_type === 'threshold' && rule.threshold_operator && rule.threshold_value !== null) {
      const operators: Record<string, string> = { gt: '>', lt: '<', gte: '≥', lte: '≤', eq: '=' };
      return `${rule.metric_type} ${operators[rule.threshold_operator] || rule.threshold_operator} ${rule.threshold_value}`;
    } else if (rule.condition_type === 'status_change') {
      const from = rule.from_status || 'any';
      const to = rule.to_status || 'any';
      return `${from} → ${to}`;
    }
    return rule.condition_type;
  }

  function getProviderEmoji(provider: string): string {
    const emojis: Record<string, string> = {
      discord: '💬',
      telegram: '✈️',
      pushover: '📱',
    };
    return emojis[provider] || '🔔';
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Notifications</h1>
        <p className={styles.subtitle}>
          Configure webhook-based alerts and maintenance mode
        </p>
      </div>

      {/* Tab Navigation */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'rules' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('rules')}
        >
          Rules ({rules.length})
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'webhooks' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('webhooks')}
        >
          Webhooks ({webhooks.length})
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'maintenance' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('maintenance')}
        >
          Maintenance
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.content}>
        {/* RULES TAB */}
        {activeTab === 'rules' && (
          <div className={styles.tabContent}>
            <div className={styles.sectionHeader}>
              <h2>Notification Rules</h2>
              <p className={styles.hint}>
                Rules define what to notify about. Each rule targets a webhook and specifies conditions.
              </p>
            </div>

            {rules.length === 0 ? (
              <div className={styles.emptyState}>
                <p>No notification rules configured.</p>
                <p className={styles.hint}>
                  Create rules to receive alerts about server status changes or threshold breaches.
                </p>
              </div>
            ) : (
              <div className={styles.table}>
                <div className={styles.tableHeader}>
                  <div className={styles.col1}>Name</div>
                  <div className={styles.col2}>Condition</div>
                  <div className={styles.col3}>Webhook</div>
                  <div className={styles.col4}>Status</div>
                  <div className={styles.col5}>Actions</div>
                </div>
                {rules.map(rule => (
                  <div key={rule.id} className={styles.tableRow}>
                    <div className={styles.col1}>
                      <strong>{rule.name}</strong>
                      <span className={styles.badge}>{rule.severity}</span>
                    </div>
                    <div className={styles.col2}>{formatCondition(rule)}</div>
                    <div className={styles.col3}>
                      {getProviderEmoji(rule.webhook_provider_type)} {rule.webhook_name}
                    </div>
                    <div className={styles.col4}>
                      <span className={rule.is_active ? styles.statusActive : styles.statusInactive}>
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className={styles.col5}>
                      <button
                        className={styles.btnSmall}
                        onClick={() => handleTestRule(rule.id)}
                      >
                        Test
                      </button>
                      <button
                        className={styles.btnSmallDanger}
                        onClick={() => handleDeleteRule(rule.id, rule.name)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.hint}>
              <strong>Note:</strong> To create rules, use the API or create a UI form. See{' '}
              <code>/api/notification-rules</code> endpoint.
            </div>
          </div>
        )}

        {/* WEBHOOKS TAB */}
        {activeTab === 'webhooks' && (
          <div className={styles.tabContent}>
            <div className={styles.sectionHeader}>
              <h2>Webhooks</h2>
              <p className={styles.hint}>
                Webhooks define where notifications are sent (Discord, Telegram, Pushover).
              </p>
            </div>

            {webhooks.length === 0 ? (
              <div className={styles.emptyState}>
                <p>No webhooks configured.</p>
                <p className={styles.hint}>
                  Add webhooks to start receiving notifications.
                </p>
              </div>
            ) : (
              <div className={styles.webhookGrid}>
                {webhooks.map(webhook => (
                  <div key={webhook.id} className={styles.webhookCard}>
                    <div className={styles.webhookHeader}>
                      <span className={styles.webhookIcon}>
                        {getProviderEmoji(webhook.provider_type)}
                      </span>
                      <span className={styles.webhookName}>{webhook.name}</span>
                      {webhook.is_active ? (
                        <span className={styles.statusDot}></span>
                      ) : (
                        <span className={styles.statusDotInactive}></span>
                      )}
                    </div>
                    <div className={styles.webhookProvider}>
                      {webhook.provider_type}
                    </div>
                    <div className={styles.webhookUrl}>
                      URL: {webhook.webhook_url_masked}
                    </div>
                    <div className={styles.webhookActions}>
                      <button
                        className={styles.btnPrimary}
                        onClick={() => handleTestWebhook(webhook.id)}
                      >
                        Test
                      </button>
                      <button
                        className={styles.btnDanger}
                        onClick={() => handleDeleteWebhook(webhook.id, webhook.name)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.hint}>
              <strong>Note:</strong> To add webhooks, use the API. See{' '}
              <code>/api/webhooks</code> endpoint.
            </div>
          </div>
        )}

        {/* MAINTENANCE TAB */}
        {activeTab === 'maintenance' && (
          <div className={styles.tabContent}>
            <div className={styles.sectionHeader}>
              <h2>Maintenance Mode</h2>
              <p className={styles.hint}>
                When enabled, displays a global banner to all users indicating system maintenance.
              </p>
            </div>

            <div className={styles.maintenanceSection}>
              <div className={styles.toggleRow}>
                <div className={styles.toggleInfo}>
                  <strong>Enable Maintenance Banner</strong>
                  <p>Banner appears instantly via SSE to all connected users</p>
                </div>
                <button
                  className={`${styles.toggleBtn} ${maintenanceEnabled ? styles.toggleBtnActive : ''}`}
                  onClick={handleToggleMaintenanceMode}
                >
                  {maintenanceEnabled ? 'ON' : 'OFF'}
                </button>
              </div>

              {maintenanceEnabled && (
                <div className={styles.maintenancePreview}>
                  <div className={styles.previewLabel}>Preview:</div>
                  <div className={styles.previewBanner}>
                    <span>⚠️</span>
                    <span>Maintenance Mode Active - System may be unavailable or experiencing updates</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
