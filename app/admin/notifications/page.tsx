'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

type Tab = 'rules' | 'templates' | 'maintenance';

interface Rule {
  id?: number;
  webhook_id: number | null;
  name: string;
  metric_definition_id: number | null;
  condition_type: 'threshold' | 'status_change';
  threshold_operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | null;
  threshold_value: number | null;
  from_status: string | null;
  to_status: string | null;
  target_type: 'all' | 'card' | 'integration';
  target_id: number | null;
  severity: 'info' | 'warning' | 'critical';
  cooldown_minutes: number;
  template_id: number | null;
  aggregation_enabled: boolean;
  aggregation_window_ms: number | null;
  is_active: boolean;
  // Joined fields
  webhook_name?: string;
  webhook_provider_type?: string;
  integration_name?: string;
  card_name?: string;
}

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('rules');
  const [rules, setRules] = useState<Rule[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  // Editing state
  const [editingId, setEditingId] = useState<number | null | 'new'>(null);
  const [editForm, setEditForm] = useState<Rule | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    await Promise.all([
      loadRules(),
      loadWebhooks(),
      loadIntegrations(),
      loadTemplates(),
      loadMetrics(),
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
        console.error('Failed to load templates:', res.status, res.statusText);
        alert(`Failed to load templates: ${res.status} ${res.statusText}`);
        return;
      }
      const data = await res.json();
      console.log('Templates loaded:', data);
      setTemplates(data.data || []);

      if ((data.data || []).length === 0) {
        console.warn('No templates found. Run POST /api/notifications/init to seed templates');
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
      alert(`Failed to load templates: ${error}`);
    }
  }

  async function loadMetrics() {
    try {
      const res = await fetch('/api/notification-rules/metrics');
      if (!res.ok) {
        console.error('Failed to load metrics:', res.status, res.statusText);
        alert(`Failed to load metrics: ${res.status} ${res.statusText}`);
        return;
      }
      const data = await res.json();
      console.log('Metrics loaded:', data);
      setMetrics(data.data || []);

      if ((data.data || []).length === 0) {
        console.warn('No metrics found. Check migrations 008-009 and ensure MetricRegistry synced');
      }
    } catch (error) {
      console.error('Failed to load metrics:', error);
      alert(`Failed to load metrics: ${error}`);
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
      webhook_id: webhooks[0]?.id || null,
      name: '',
      metric_definition_id: null,
      condition_type: 'threshold',
      threshold_operator: 'gt',
      threshold_value: null,
      from_status: null,
      to_status: null,
      target_type: 'all',
      target_id: null,
      severity: 'warning',
      cooldown_minutes: 30,
      template_id: null,
      aggregation_enabled: false,
      aggregation_window_ms: 60000,
      is_active: true,
    };
    setEditForm(newRule);
    setEditingId('new');
  }

  function handleEditRule(rule: Rule) {
    setEditForm({ ...rule });
    setEditingId(rule.id!);
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

  function formatSource(rule: Rule): string {
    if (rule.target_type === 'all') {
      return 'All Cards';
    } else if (rule.target_type === 'card' && rule.card_name) {
      return rule.card_name;
    } else if (rule.target_type === 'integration' && rule.integration_name) {
      return rule.integration_name;
    } else if (rule.target_type === 'card') {
      return `Card #${rule.target_id}`;
    } else if (rule.target_type === 'integration') {
      return `Integration #${rule.target_id}`;
    }
    return 'Unknown';
  }

  function formatCondition(rule: Rule): string {
    const metric = metrics.find(m => m.id === rule.metric_definition_id);
    const metricName = metric?.display_name || 'Unknown Metric';

    if (rule.condition_type === 'threshold' && rule.threshold_operator && rule.threshold_value !== null) {
      const operators: Record<string, string> = { gt: '>', lt: '<', gte: '≥', lte: '≤', eq: '=' };
      return `${metricName} ${operators[rule.threshold_operator]} ${rule.threshold_value}${metric?.unit || ''}`;
    } else if (rule.condition_type === 'status_change') {
      const from = rule.from_status || 'any';
      const to = rule.to_status || 'any';
      return `${metricName}: ${from} → ${to}`;
    }
    return metricName;
  }

  function getProviderEmoji(provider: string): string {
    const emojis: Record<string, string> = {
      discord: '💬',
      telegram: '✈️',
      pushover: '📱',
    };
    return emojis[provider] || '🔔';
  }

  function getAvailableMetrics(integrationType?: string | null) {
    if (!integrationType) return metrics;
    return metrics.filter((m: any) => !m.integration_type || m.integration_type === integrationType);
  }

  function renderEditRow(rule: Rule, isNew: boolean) {
    const selectedIntegration = integrations.find(i => i.id === rule.target_id);
    const availableMetrics = rule.target_type === 'integration'
      ? getAvailableMetrics(selectedIntegration?.service_type)
      : metrics;

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

        {/* Source */}
        <div>
          <select
            className={styles.inlineSelect}
            value={rule.target_type}
            onChange={(e) => {
              const newType = e.target.value as 'all' | 'card' | 'integration';
              setEditForm({ ...rule, target_type: newType, target_id: newType === 'all' ? null : rule.target_id });
            }}
          >
            <option value="all">All Cards</option>
            <option value="integration">Integration</option>
            <option value="card">Card</option>
          </select>

          {rule.target_type === 'integration' && (
            <select
              className={styles.inlineSelect}
              value={rule.target_id || ''}
              onChange={(e) => {
                const newTargetId = parseInt(e.target.value);
                setEditForm({ ...rule, target_id: newTargetId, metric_definition_id: null });
              }}
            >
              <option value="">Select integration...</option>
              {integrations.map(i => (
                <option key={i.id} value={i.id}>{i.service_name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Metric & Condition */}
        <div>
          <select
            className={styles.inlineSelect}
            value={rule.metric_definition_id || ''}
            onChange={(e) => {
              const metricId = parseInt(e.target.value);
              const metric = metrics.find((m: any) => m.id === metricId);
              setEditForm({
                ...rule,
                metric_definition_id: metricId,
                condition_type: metric?.condition_type || 'threshold'
              });
            }}
          >
            <option value="">Select metric...</option>
            {availableMetrics.map((m: any) => (
              <option key={m.id} value={m.id}>{m.display_name}</option>
            ))}
          </select>

          {rule.condition_type === 'threshold' && (
            <div className={styles.inlineFlex}>
              <select
                className={styles.inlineSelectSmall}
                value={rule.threshold_operator || ''}
                onChange={(e) => setEditForm({ ...rule, threshold_operator: e.target.value as any })}
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
                value={rule.threshold_value || ''}
                onChange={(e) => setEditForm({ ...rule, threshold_value: parseFloat(e.target.value) })}
                placeholder="Value"
              />
            </div>
          )}

          {rule.condition_type === 'status_change' && (
            <div className={styles.inlineFlex}>
              <input
                type="text"
                className={styles.inlineInputSmall}
                value={rule.from_status || ''}
                onChange={(e) => setEditForm({ ...rule, from_status: e.target.value })}
                placeholder="From"
              />
              <span>→</span>
              <input
                type="text"
                className={styles.inlineInputSmall}
                value={rule.to_status || ''}
                onChange={(e) => setEditForm({ ...rule, to_status: e.target.value })}
                placeholder="To"
              />
            </div>
          )}
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

        {/* Template */}
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

    return (
      <div key={rule.id} className={styles.tableRow}>
        <div><strong>{rule.name}</strong></div>
        <div>{formatSource(rule)}</div>
        <div>{formatCondition(rule)}</div>
        <div>
          {getProviderEmoji(rule.webhook_provider_type || '')} {rule.webhook_name}
        </div>
        <div>
          {templates.find((t: any) => t.id === rule.template_id)?.name || 'Default'}
        </div>
        <div>
          <span className={rule.is_active ? styles.statusActive : styles.statusInactive}>
            {rule.is_active ? '● Active' : '○ Inactive'}
          </span>
        </div>
        <div className={styles.inlineActions}>
          <button className={styles.btnSmall} onClick={() => handleEditRule(rule)}>
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
                disabled={webhooks.length === 0 || editingId !== null}
              >
                Add Rule
              </button>
            </div>

            {webhooks.length === 0 && (
              <div className={styles.hint} style={{ marginTop: '16px', color: '#F59E0B' }}>
                You must create at least one webhook before you can create rules. Configure webhooks in API Settings.
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
                  <div>SOURCE</div>
                  <div>CONDITION</div>
                  <div>WEBHOOK</div>
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
            </div>
            <p className={styles.hint}>
              Templates allow you to customize notification messages with variables.
            </p>
            <div className={styles.comingSoon}>
              Template management UI coming soon. For now, templates are managed via API.
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
