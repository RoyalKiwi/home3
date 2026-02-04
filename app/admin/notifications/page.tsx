'use client';

import { useState, useEffect, useMemo } from 'react';
import styles from './page.module.css';
import type { CapabilityMetadata } from '@/lib/types';

type Tab = 'rules' | 'templates' | 'maintenance';

interface Rule {
  id?: number;
  name: string;

  // Direct integration targeting
  integration_id: number | null;

  // Dynamic metric reference
  metric_key: string;

  // Threshold condition
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  threshold: number | null;

  // Notification settings
  webhook_id: number | null;
  template_id: number | null;
  severity: 'info' | 'warning' | 'critical';
  cooldown_minutes: number;

  // State
  is_active: boolean;

  // Joined fields from API
  webhook_name?: string;
  webhook_provider_type?: string;
  integration_name?: string;
  integration_type?: string;
}

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('rules');
  const [rules, setRules] = useState<Rule[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [capabilities, setCapabilities] = useState<CapabilityMetadata[]>([]);
  const [loadingCapabilities, setLoadingCapabilities] = useState(false);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  // Cascading dropdown state
  const [selectedIntegration, setSelectedIntegration] = useState<number | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [selectedMetric, setSelectedMetric] = useState<string>('');

  // Editing state
  const [editingId, setEditingId] = useState<number | null | 'new'>(null);
  const [editForm, setEditForm] = useState<Rule | null>(null);

  // Derived state for cascading dropdowns
  const availableTargets = useMemo(() => {
    if (!selectedIntegration || capabilities.length === 0) return [];
    // Get unique targets from capabilities
    return [...new Set(capabilities.map(c => c.target))].sort();
  }, [capabilities, selectedIntegration]);

  const availableMetrics = useMemo(() => {
    if (!selectedTarget || capabilities.length === 0) return [];
    // Filter capabilities by selected target
    return capabilities.filter(c => c.target === selectedTarget);
  }, [capabilities, selectedTarget]);

  useEffect(() => {
    loadData();
  }, []);

  // When capabilities load and we're editing a rule, extract target/metric from metric_key
  useEffect(() => {
    if (editForm && editForm.metric_key && capabilities.length > 0) {
      const capability = capabilities.find(c => c.key === editForm.metric_key);
      if (capability) {
        setSelectedTarget(capability.target);
        setSelectedMetric(capability.metric);
      }
    }
  }, [capabilities, editForm?.metric_key]);

  async function loadData() {
    await Promise.all([
      loadRules(),
      loadWebhooks(),
      loadIntegrations(),
      loadTemplates(),
      loadMaintenanceMode(),
    ]);
    setLoading(false);
  }

  async function loadRules() {
    try {
      const res = await fetch('/api/notification-rules');
      const data = await res.json();
      setRules(data.data || []);
    } catch (error) {
      console.error('Failed to load rules:', error);
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

  async function loadIntegrations() {
    try {
      const res = await fetch('/api/integrations');
      const data = await res.json();
      setIntegrations(data.data || []);
    } catch (error) {
      console.error('Failed to load integrations:', error);
    }
  }

  async function loadTemplates() {
    try {
      const res = await fetch('/api/notification-templates');
      if (!res.ok) {
        console.error('[Templates] Failed to load:', res.status, res.statusText);
        return;
      }
      const data = await res.json();
      console.log('[Templates] Loaded:', data.data?.length || 0, 'templates');
      setTemplates(data.data || []);

      if ((data.data || []).length === 0) {
        console.warn('[Templates] No templates found. Check server logs for initialization status.');
      }
    } catch (error) {
      console.error('[Templates] Load error:', error);
    }
  }

  async function loadCapabilities(integrationId: number) {
    try {
      setLoadingCapabilities(true);
      const res = await fetch(`/api/integrations/${integrationId}/capabilities`);

      if (!res.ok) {
        console.error('[Capabilities] Failed to load:', res.status, res.statusText);
        setCapabilities([]);
        return;
      }

      const data = await res.json();
      console.log('[Capabilities] Loaded:', data.data?.capabilities || []);
      setCapabilities(data.data?.capabilities || []);
    } catch (error) {
      console.error('[Capabilities] Load error:', error);
      setCapabilities([]);
    } finally {
      setLoadingCapabilities(false);
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

  function handleAddRule() {
    const newRule: Rule = {
      name: '',
      integration_id: integrations[0]?.id || null,
      metric_key: '',
      operator: 'gt',
      threshold: null,
      webhook_id: webhooks[0]?.id || null,
      template_id: null,
      severity: 'warning',
      cooldown_minutes: 30,
      is_active: true,
    };

    // Reset cascading selections
    setSelectedIntegration(integrations[0]?.id || null);
    setSelectedTarget('');
    setSelectedMetric('');

    // Load capabilities for first integration
    if (integrations[0]?.id) {
      loadCapabilities(integrations[0].id);
    }

    setEditForm(newRule);
    setEditingId('new');
  }

  function handleEditRule(rule: Rule) {
    setEditForm({ ...rule });
    setEditingId(rule.id!);

    // Set cascading state for editing
    setSelectedIntegration(rule.integration_id);

    // Load capabilities for this integration
    if (rule.integration_id) {
      loadCapabilities(rule.integration_id);

      // Try to extract target and metric from rule.metric_key
      // Note: This is approximate since we don't have the capability data yet
      // The actual target/metric will be set once capabilities load
      const capability = capabilities.find(c => c.key === rule.metric_key);
      if (capability) {
        setSelectedTarget(capability.target);
        setSelectedMetric(capability.metric);
      } else {
        setSelectedTarget('');
        setSelectedMetric('');
      }
    }
  }

  function handleCancelEdit() {
    setEditForm(null);
    setEditingId(null);
  }

  async function handleSaveRule() {
    if (!editForm) return;

    try {
      const isNew = editingId === 'new';
      const url = isNew ? '/api/notification-rules' : `/api/notification-rules/${editingId}`;
      const method = isNew ? 'POST' : 'PATCH';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (res.ok) {
        await loadRules();
        handleCancelEdit();
        alert(isNew ? 'Rule created successfully!' : 'Rule updated successfully!');
      } else {
        const data = await res.json();
        alert(`Failed to save rule: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to save rule');
    }
  }

  async function handleDeleteRule(id: number, name: string) {
    if (!confirm(`Delete rule "${name}"?`)) return;

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

  function formatIntegration(rule: Rule): string {
    if (rule.integration_name) {
      return `${rule.integration_name} (${rule.integration_type || 'unknown'})`;
    }
    return rule.integration_id ? `Integration #${rule.integration_id}` : 'Unknown';
  }

  function formatCondition(rule: Rule): string {
    const operators: Record<string, string> = {
      gt: '>',
      lt: '<',
      gte: '≥',
      lte: '≤',
      eq: '='
    };

    const operatorSymbol = operators[rule.operator] || rule.operator;

    // Try to find capability metadata to get display info
    const capability = capabilities.find(c => c.key === rule.metric_key);

    if (capability) {
      return `${capability.target} ${capability.metric} ${operatorSymbol} ${rule.threshold}${capability.unit}`;
    }

    // Fallback to plain metric key if capability not found
    return `${rule.metric_key} ${operatorSymbol} ${rule.threshold}`;
  }

  function getProviderEmoji(provider: string): string {
    const emojis: Record<string, string> = {
      discord: '💬',
      telegram: '✈️',
      pushover: '📱',
    };
    return emojis[provider] || '🔔';
  }

  function renderEditRow(rule: Rule, isNew: boolean) {
    return (
      <div className={styles.tableRow} key={isNew ? 'new' : rule.id}>
        {/* Rule Name */}
        <div>
          <input
            type="text"
            className={styles.inlineInput}
            value={rule.name}
            onChange={(e) => setEditForm({ ...rule, name: e.target.value })}
            placeholder="Rule name..."
            autoFocus
          />
        </div>

        {/* Source Selector (Cascading Step 1) */}
        <div>
          <select
            className={styles.inlineSelect}
            value={rule.integration_id || ''}
            onChange={(e) => {
              const integrationId = parseInt(e.target.value);
              setEditForm({
                ...rule,
                integration_id: integrationId,
                metric_key: '' // Reset metric when integration changes
              });

              // Reset cascading selections
              setSelectedIntegration(integrationId || null);
              setSelectedTarget('');
              setSelectedMetric('');

              // Load capabilities for selected integration
              if (integrationId) {
                loadCapabilities(integrationId);
              } else {
                setCapabilities([]);
              }
            }}
          >
            <option value="">Select integration...</option>
            {integrations.map(i => (
              <option key={i.id} value={i.id}>
                {i.service_name} ({i.service_type})
              </option>
            ))}
          </select>
        </div>

        {/* Target Selector (Cascading Step 2) */}
        <div>
          <select
            className={styles.inlineSelect}
            value={selectedTarget}
            onChange={(e) => {
              setSelectedTarget(e.target.value);
              setSelectedMetric(''); // Reset metric when target changes
              setEditForm({ ...rule, metric_key: '' }); // Reset metric_key in form
            }}
            disabled={!rule.integration_id || loadingCapabilities || availableTargets.length === 0}
          >
            <option value="">
              {loadingCapabilities ? 'Loading...' : availableTargets.length === 0 ? 'No targets available' : 'Select target...'}
            </option>
            {availableTargets.map((target) => (
              <option key={target} value={target}>
                {target.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Metric Selector (Cascading Step 3) */}
        <div>
          <select
            className={styles.inlineSelect}
            value={rule.metric_key}
            onChange={(e) => {
              setSelectedMetric(e.target.value);
              setEditForm({ ...rule, metric_key: e.target.value });
            }}
            disabled={!selectedTarget || availableMetrics.length === 0}
          >
            <option value="">
              {selectedTarget ? 'Select metric...' : 'Select target first...'}
            </option>
            {availableMetrics.map((cap) => (
              <option key={cap.key} value={cap.key} title={cap.description}>
                {cap.metric.toUpperCase()} ({cap.unit}) - {cap.description}
              </option>
            ))}
          </select>

          {/* Operator + Threshold */}
          <div className={styles.inlineFlex}>
            <select
              className={styles.inlineSelectSmall}
              value={rule.operator}
              onChange={(e) => setEditForm({ ...rule, operator: e.target.value as any })}
            >
              <option value="gt">&gt;</option>
              <option value="gte">≥</option>
              <option value="lt">&lt;</option>
              <option value="lte">≤</option>
              <option value="eq">=</option>
            </select>
            <input
              type="number"
              className={styles.inlineInputSmall}
              value={rule.threshold || ''}
              onChange={(e) => setEditForm({ ...rule, threshold: parseFloat(e.target.value) || null })}
              placeholder="Value"
            />
          </div>
        </div>

        {/* Webhook */}
        <div>
          <select
            className={styles.inlineSelect}
            value={rule.webhook_id || ''}
            onChange={(e) => setEditForm({ ...rule, webhook_id: parseInt(e.target.value) })}
          >
            <option value="">Select webhook...</option>
            {webhooks.map(w => (
              <option key={w.id} value={w.id}>
                {getProviderEmoji(w.provider_type)} {w.name}
              </option>
            ))}
          </select>
        </div>

        {/* Severity */}
        <div>
          <select
            className={styles.inlineSelect}
            value={rule.severity}
            onChange={(e) => setEditForm({ ...rule, severity: e.target.value as any })}
          >
            <option value="info">ℹ️ Info</option>
            <option value="warning">⚠️ Warning</option>
            <option value="critical">🔴 Critical</option>
          </select>
        </div>

        {/* Template (Optional) */}
        <div>
          <select
            className={styles.inlineSelect}
            value={rule.template_id || ''}
            onChange={(e) => setEditForm({ ...rule, template_id: e.target.value ? parseInt(e.target.value) : null })}
          >
            <option value="">Default</option>
            {templates.map((t: any) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div>
          <label className={styles.inlineCheckbox}>
            <input
              type="checkbox"
              checked={rule.is_active}
              onChange={(e) => setEditForm({ ...rule, is_active: e.target.checked })}
            />
            <span>Active</span>
          </label>
        </div>

        {/* Actions */}
        <div className={styles.inlineActions}>
          <button className={styles.btnSave} onClick={handleSaveRule}>
            Save
          </button>
          <button className={styles.btnCancel} onClick={handleCancelEdit}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  function renderRuleRow(rule: Rule) {
    if (editingId === rule.id) {
      return renderEditRow(rule, false);
    }

    const severityEmojis = {
      info: 'ℹ️',
      warning: '⚠️',
      critical: '🔴'
    };

    return (
      <div key={rule.id} className={styles.tableRow}>
        {/* Rule Name */}
        <div><strong>{rule.name}</strong></div>

        {/* Integration */}
        <div>{formatIntegration(rule)}</div>

        {/* Condition */}
        <div>{formatCondition(rule)}</div>

        {/* Webhook */}
        <div>
          {getProviderEmoji(rule.webhook_provider_type || '')} {rule.webhook_name}
        </div>

        {/* Severity */}
        <div>
          {severityEmojis[rule.severity]} {rule.severity}
        </div>

        {/* Template */}
        <div>
          {templates.find((t: any) => t.id === rule.template_id)?.name || 'Default'}
        </div>

        {/* Status */}
        <div>
          <span className={rule.is_active ? styles.statusActive : styles.statusInactive}>
            {rule.is_active ? '● Active' : '○ Inactive'}
          </span>
        </div>

        {/* Actions */}
        <div className={styles.inlineActions}>
          <button className={styles.btnSmall} onClick={() => {
            handleEditRule(rule);
            // Load capabilities when editing
            if (rule.integration_id) {
              loadCapabilities(rule.integration_id);
            }
          }}>
            Edit
          </button>
          <button className={styles.btnSmall} onClick={() => handleTestRule(rule.id!)}>
            Test
          </button>
          <button className={styles.btnSmallDanger} onClick={() => handleDeleteRule(rule.id!, rule.name)}>
            Delete
          </button>
        </div>
      </div>
    );
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
        <h1 className={styles.title}>Notifications</h1>
        <p className={styles.subtitle}>
          Configure notification rules, templates, and maintenance mode
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
          className={`${styles.tab} ${activeTab === 'templates' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          Templates ({templates.length})
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
              <button
                className={styles.btnPrimary}
                onClick={handleAddRule}
                disabled={webhooks.length === 0 || integrations.length === 0 || editingId !== null}
              >
                Add Rule
              </button>
            </div>

            {webhooks.length === 0 && (
              <div className={styles.hint} style={{ marginTop: '16px', color: '#F59E0B' }}>
                ⚠️ You must create at least one webhook before you can create rules.
              </div>
            )}

            {integrations.length === 0 && webhooks.length > 0 && (
              <div className={styles.hint} style={{ marginTop: '16px', color: '#F59E0B' }}>
                ⚠️ You must create at least one integration before you can create rules.
              </div>
            )}

            {rules.length === 0 && editingId !== 'new' ? (
              <div className={styles.emptyState}>
                <p>No notification rules configured.</p>
                <p className={styles.hint}>
                  Create rules to receive alerts about server status changes or threshold breaches.
                </p>
              </div>
            ) : (
              <div className={styles.table}>
                <div className={styles.tableHeader}>
                  <div>RULE NAME</div>
                  <div>INTEGRATION</div>
                  <div>CONDITION</div>
                  <div>WEBHOOK</div>
                  <div>SEVERITY</div>
                  <div>TEMPLATE</div>
                  <div>STATUS</div>
                  <div>ACTIONS</div>
                </div>
                {editingId === 'new' && editForm && renderEditRow(editForm, true)}
                {rules.map(rule => renderRuleRow(rule))}
              </div>
            )}
          </div>
        )}

        {/* TEMPLATES TAB */}
        {activeTab === 'templates' && (
          <div className={styles.tabContent}>
            <div className={styles.sectionHeader}>
              <h2>Notification Templates</h2>
              <p className={styles.hint}>
                Templates allow you to customize notification messages with variables like {'{{severity}}'}, {'{{metricName}}'}, {'{{cardName}}'}, etc.
              </p>
            </div>

            {templates.length === 0 ? (
              <div className={styles.emptyState}>
                <p>No templates found.</p>
                <p className={styles.hint}>Templates should be auto-seeded on startup. Check server logs.</p>
              </div>
            ) : (
              <div className={styles.templateList}>
                {templates.map((template: any) => (
                  <div key={template.id} className={styles.templateCard}>
                    <div className={styles.templateHeader}>
                      <div>
                        <h3 className={styles.templateName}>
                          {template.name}
                          {template.is_default && (
                            <span className={styles.defaultBadge}>Default</span>
                          )}
                        </h3>
                      </div>
                      <div className={styles.templateActions}>
                        <span className={template.is_active ? styles.statusActive : styles.statusInactive}>
                          {template.is_active ? '● Active' : '○ Inactive'}
                        </span>
                      </div>
                    </div>
                    <div className={styles.templateContent}>
                      <div className={styles.templateField}>
                        <label>Title Template:</label>
                        <code className={styles.templateCode}>{template.title_template}</code>
                      </div>
                      <div className={styles.templateField}>
                        <label>Message Template:</label>
                        <code className={styles.templateCode}>{template.message_template}</code>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.templateInfo}>
              <h3>Available Variables:</h3>
              <div className={styles.variableGrid}>
                <div><code>{'{{severity}}'}</code> - Alert severity (info, warning, critical)</div>
                <div><code>{'{{metricName}}'}</code> - Metric key</div>
                <div><code>{'{{metricDisplayName}}'}</code> - Human-readable metric name</div>
                <div><code>{'{{metricValue}}'}</code> - Current metric value</div>
                <div><code>{'{{threshold}}'}</code> - Threshold value</div>
                <div><code>{'{{unit}}'}</code> - Unit (%, °C, Mbps, etc.)</div>
                <div><code>{'{{cardName}}'}</code> - Card display name</div>
                <div><code>{'{{integrationName}}'}</code> - Integration name</div>
                <div><code>{'{{oldStatus}}'}</code> - Previous status</div>
                <div><code>{'{{newStatus}}'}</code> - New status</div>
                <div><code>{'{{timestamp}}'}</code> - ISO timestamp</div>
              </div>
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
