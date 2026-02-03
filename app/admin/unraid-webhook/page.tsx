'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

export default function UnraidWebhookPage() {
  const [webhook, setWebhook] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generatingApiKey, setGeneratingApiKey] = useState(false);

  useEffect(() => {
    loadWebhook();
  }, []);

  async function loadWebhook() {
    try {
      const res = await fetch('/api/unraid-webhook');
      const data = await res.json();
      setWebhook(data.data || null);
    } catch (error) {
      console.error('Failed to load Unraid webhook:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleWebhook() {
    try {
      const res = await fetch('/api/unraid-webhook', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !webhook?.enabled }),
      });

      if (res.ok) {
        await loadWebhook();
      } else {
        alert('Failed to toggle Unraid webhook');
      }
    } catch (error) {
      alert('Failed to toggle Unraid webhook');
    }
  }

  async function handleGenerateApiKey() {
    if (!confirm('Generate a new API key? This will invalidate the previous key and require updating your Unraid configuration.')) {
      return;
    }

    setGeneratingApiKey(true);
    try {
      const res = await fetch('/api/unraid-webhook', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generateApiKey: true }),
      });

      const data = await res.json();

      if (res.ok) {
        await loadWebhook();
        alert(`New API key generated successfully!\n\nKey: ${data.apiKey}\n\nPlease update your Unraid notification configuration.`);
      } else {
        alert('Failed to generate API key');
      }
    } catch (error) {
      alert('Failed to generate API key');
    } finally {
      setGeneratingApiKey(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Unraid Webhook Receiver</h1>
        <p className={styles.subtitle}>
          Configure Homepage3 to receive event notifications from Unraid OS
        </p>
      </div>

      <div className={styles.content}>
        {webhook && (
          <>
            {/* Enable/Disable Toggle */}
            <div className={styles.section}>
              <div className={styles.toggleRow}>
                <div>
                  <h2 className={styles.sectionTitle}>Webhook Receiver</h2>
                  <p className={styles.hint}>
                    Allow Unraid to send event notifications to this server
                  </p>
                </div>
                <button
                  className={`${styles.toggleBtn} ${webhook.enabled ? styles.toggleBtnActive : ''}`}
                  onClick={handleToggleWebhook}
                >
                  {webhook.enabled ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>
            </div>

            {/* Configuration Section */}
            {webhook.configured ? (
              <>
                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>Configuration</h2>
                  <div className={styles.configGrid}>
                    <div className={styles.configField}>
                      <label className={styles.configLabel}>Webhook URL</label>
                      <div className={styles.inputGroup}>
                        <input
                          type="text"
                          readOnly
                          value={webhook.webhookUrl}
                          className={styles.configInput}
                        />
                        <button
                          className={styles.btnCopy}
                          onClick={() => copyToClipboard(webhook.webhookUrl)}
                        >
                          Copy
                        </button>
                      </div>
                    </div>

                    <div className={styles.configField}>
                      <label className={styles.configLabel}>API Key (Bearer Token)</label>
                      <div className={styles.inputGroup}>
                        <input
                          type="text"
                          readOnly
                          value={webhook.apiKey || ''}
                          className={styles.configInput}
                        />
                        <button
                          className={styles.btnCopy}
                          onClick={() => copyToClipboard(webhook.apiKey)}
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    className={styles.btnGenerate}
                    onClick={handleGenerateApiKey}
                    disabled={generatingApiKey}
                  >
                    {generatingApiKey ? 'Generating...' : 'Generate New API Key'}
                  </button>
                </div>

                {/* Statistics */}
                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>Event Statistics</h2>
                  <div className={styles.statsGrid}>
                    <div className={styles.statCard}>
                      <div className={styles.statValue}>{webhook.stats?.totalEvents || 0}</div>
                      <div className={styles.statLabel}>Total Events</div>
                    </div>
                    <div className={styles.statCard}>
                      <div className={styles.statValue} style={{ color: '#22C55E' }}>
                        {webhook.stats?.processedEvents || 0}
                      </div>
                      <div className={styles.statLabel}>Processed</div>
                    </div>
                    <div className={styles.statCard}>
                      <div className={styles.statValue} style={{ color: '#3B82F6' }}>
                        {webhook.stats?.eventsLast24h || 0}
                      </div>
                      <div className={styles.statLabel}>Last 24 Hours</div>
                    </div>
                  </div>
                </div>

                {/* Setup Instructions */}
                <div className={styles.section}>
                  <div className={styles.instructions}>
                    <h2 className={styles.sectionTitle}>📝 Unraid Setup Instructions</h2>
                    <ol className={styles.instructionsList}>
                      <li>Go to <strong>Settings → Notifications</strong> in your Unraid web interface</li>
                      <li>Click <strong>Add Notification Agent</strong></li>
                      <li>Select <strong>Webhook</strong> as the agent type</li>
                      <li>Paste the <strong>Webhook URL</strong> from above</li>
                      <li>Set Authentication Method to <strong>Bearer Token</strong></li>
                      <li>Paste the <strong>API Key</strong> from above</li>
                      <li>Select which events you want to forward (array, parity, docker, health, etc.)</li>
                      <li>Click <strong>Test</strong> to verify the connection</li>
                      <li>Save your configuration</li>
                    </ol>
                    <p className={styles.hint} style={{ marginTop: '16px' }}>
                      After setup, create notification rules in the <strong>Notifications</strong> page to receive alerts for specific Unraid events.
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.section}>
                <div className={styles.warning}>
                  <h3>⚠️ No API Key Configured</h3>
                  <p>Generate an API key to start receiving Unraid webhook events.</p>
                  <button
                    className={styles.btnGenerate}
                    onClick={handleGenerateApiKey}
                    disabled={generatingApiKey}
                  >
                    {generatingApiKey ? 'Generating...' : 'Generate API Key'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
