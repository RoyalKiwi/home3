'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import type { Integration, IntegrationCredentials } from '@/lib/types';

type IntegrationType = 'uptime-kuma' | 'netdata' | 'unraid';

interface IntegrationFormData {
  service_name: string;
  service_type: IntegrationType;
  credentials: IntegrationCredentials;
  poll_interval: number;
  is_active: boolean;
}

interface CardMapping {
  id: number;
  name: string;
  status_source_id: number | null;
  status_monitor_name: string | null;
}

interface Monitor {
  name: string;
  status: 'up' | 'down';
}

export default function APISettingsPage() {
  const router = useRouter();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Status source configuration state
  const [statusSourceId, setStatusSourceId] = useState<number | null>(null);
  const [cards, setCards] = useState<CardMapping[]>([]);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loadingMappings, setLoadingMappings] = useState(false);
  const [savingMappings, setSavingMappings] = useState(false);

  const [formData, setFormData] = useState<IntegrationFormData>({
    service_name: '',
    service_type: 'uptime-kuma',
    credentials: { url: '', apiKey: '' },
    poll_interval: 30000,
    is_active: true,
  });

  useEffect(() => {
    fetchIntegrations();
    fetchStatusSource();
  }, []);

  const fetchIntegrations = async () => {
    try {
      const res = await fetch('/api/integrations');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch integrations');
      }

      setIntegrations(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (integration?: Integration) => {
    if (integration) {
      setEditingId(integration.id);
      setFormData({
        service_name: integration.service_name,
        service_type: integration.service_type as IntegrationType,
        credentials: { url: '', apiKey: '' }, // Don't populate credentials on edit
        poll_interval: integration.poll_interval,
        is_active: integration.is_active,
      });
    } else {
      setEditingId(null);
      setFormData({
        service_name: '',
        service_type: 'uptime-kuma',
        credentials: { url: '', apiKey: '' },
        poll_interval: 30000,
        is_active: true,
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingId(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const url = editingId
        ? `/api/integrations/${editingId}`
        : '/api/integrations';

      const method = editingId ? 'PATCH' : 'POST';

      // Only send credentials if they're filled in
      const hasCredentials = Object.values(formData.credentials).some(v => v);
      const body = editingId && !hasCredentials
        ? {
            service_name: formData.service_name,
            poll_interval: formData.poll_interval,
            is_active: formData.is_active,
          }
        : formData;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save integration');
      }

      await fetchIntegrations();
      handleCloseModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/integrations/${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete integration');
      }

      await fetchIntegrations();
      setDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleTestConnection = async (id: number) => {
    setTestingId(id);
    setError(null);

    try {
      const res = await fetch(`/api/integrations/${id}/test`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Connection test failed');
      }

      if (data.data.success) {
        alert(`✅ Connection successful: ${data.data.message}`);
      } else {
        alert(`❌ Connection failed: ${data.data.message}`);
      }

      await fetchIntegrations();
    } catch (err) {
      alert(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setTestingId(null);
    }
  };

  const handlePollNow = async (id: number) => {
    try {
      const res = await fetch(`/api/integrations/${id}/poll`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Poll failed');
      }

      // Display metrics in console and alert
      console.log('Poll Results:', data.data);
      const metricsCount = Object.keys(data.data.metrics || {}).length;
      alert(`✅ Poll successful!\n\nCollected ${metricsCount} metrics.\n\nCheck browser console for details.`);

      await fetchIntegrations();
    } catch (err) {
      alert(`❌ Poll Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Status source configuration handlers
  const fetchStatusSource = async () => {
    try {
      const res = await fetch('/api/settings/status-source');
      const data = await res.json();
      if (data.data && data.data.integration_id) {
        setStatusSourceId(data.data.integration_id);
        await loadStatusMappings(data.data.integration_id);
      }
    } catch (err) {
      console.error('Failed to fetch status source:', err);
    }
  };

  const loadStatusMappings = async (sourceId: number) => {
    setLoadingMappings(true);
    try {
      // Fetch cards and monitors in parallel
      const [cardsRes, monitorsRes] = await Promise.all([
        fetch('/api/cards/status-mappings'),
        fetch(`/api/integrations/${sourceId}/monitors`),
      ]);

      const cardsData = await cardsRes.json();
      const monitorsData = await monitorsRes.json();

      if (cardsRes.ok && cardsData.data) {
        const fetchedCards = cardsData.data as CardMapping[];

        if (monitorsRes.ok && monitorsData.data) {
          const fetchedMonitors = monitorsData.data as Monitor[];
          setMonitors(fetchedMonitors);

          // Auto-match cards to monitors
          const monitorsByName = new Map<string, string>();
          fetchedMonitors.forEach((m) => {
            monitorsByName.set(m.name.toLowerCase(), m.name);
          });

          const matchedCards = fetchedCards.map((card) => {
            // If card already has a mapping, keep it
            if (card.status_monitor_name) {
              return card;
            }

            // Otherwise, try auto-match
            const matchedName = monitorsByName.get(card.name.toLowerCase());
            return {
              ...card,
              status_monitor_name: matchedName || null,
            };
          });

          setCards(matchedCards);
        } else {
          setCards(fetchedCards);
        }
      }
    } catch (err) {
      console.error('Failed to load status mappings:', err);
    } finally {
      setLoadingMappings(false);
    }
  };

  const handleStatusSourceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSourceId = e.target.value ? parseInt(e.target.value, 10) : null;

    try {
      const res = await fetch('/api/settings/status-source', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integration_id: newSourceId }),
      });

      if (!res.ok) {
        throw new Error('Failed to update status source');
      }

      setStatusSourceId(newSourceId);

      if (newSourceId) {
        await loadStatusMappings(newSourceId);
      } else {
        setCards([]);
        setMonitors([]);
      }
    } catch (err) {
      alert(`Failed to update status source: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleCardMappingChange = (cardId: number, field: 'status_source_id' | 'status_monitor_name', value: string | null) => {
    setCards((prev) =>
      prev.map((card) =>
        card.id === cardId
          ? { ...card, [field]: value === '' ? null : field === 'status_source_id' ? parseInt(value || '0', 10) : value }
          : card
      )
    );
  };

  const handleSaveMappings = async () => {
    setSavingMappings(true);
    try {
      const mappings = cards.map((card) => ({
        card_id: card.id,
        status_source_id: card.status_source_id,
        status_monitor_name: card.status_monitor_name,
      }));

      const res = await fetch('/api/cards/status-mappings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save mappings');
      }

      alert(`✅ Saved ${data.data.updated} card mappings`);
    } catch (err) {
      alert(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSavingMappings(false);
    }
  };

  const renderCredentialFields = () => {
    switch (formData.service_type) {
      case 'uptime-kuma':
        return (
          <>
            <div className={styles.formGroup}>
              <label htmlFor="url">Uptime Kuma URL *</label>
              <input
                type="url"
                id="url"
                placeholder="https://uptime.example.com"
                value={(formData.credentials as any).url || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    credentials: { ...formData.credentials, url: e.target.value },
                  })
                }
                required={!editingId}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="apiKey">API Key *</label>
              <input
                type="password"
                id="apiKey"
                placeholder="uk1_..."
                value={(formData.credentials as any).apiKey || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    credentials: { ...formData.credentials, apiKey: e.target.value },
                  })
                }
                required={!editingId}
              />
            </div>
          </>
        );

      case 'netdata':
        return (
          <>
            <div className={styles.formGroup}>
              <label htmlFor="url">Netdata URL *</label>
              <input
                type="url"
                id="url"
                placeholder="https://netdata.example.com"
                value={(formData.credentials as any).url || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    credentials: { ...formData.credentials, url: e.target.value },
                  })
                }
                required={!editingId}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="username">Username (optional)</label>
              <input
                type="text"
                id="username"
                placeholder="admin"
                value={(formData.credentials as any).username || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    credentials: { ...formData.credentials, username: e.target.value },
                  })
                }
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="password">Password (optional)</label>
              <input
                type="password"
                id="password"
                value={(formData.credentials as any).password || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    credentials: { ...formData.credentials, password: e.target.value },
                  })
                }
              />
            </div>
          </>
        );

      case 'unraid':
        return (
          <>
            <div className={styles.formGroup}>
              <label htmlFor="url">Unraid URL *</label>
              <input
                type="url"
                id="url"
                placeholder="http://192.168.1.100:81"
                value={(formData.credentials as any).url || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    credentials: { ...formData.credentials, url: e.target.value },
                  })
                }
                required={!editingId}
              />
              <small className={styles.hint}>
                Include port if not using default (e.g., :81)
              </small>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="apiKey">API Key *</label>
              <input
                type="password"
                id="apiKey"
                placeholder="Generated from Unraid Settings > API Keys"
                value={(formData.credentials as any).apiKey || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    credentials: { ...formData.credentials, apiKey: e.target.value },
                  })
                }
                required={!editingId}
              />
            </div>
          </>
        );
    }
  };

  const getCapabilities = (serviceType: string): string[] => {
    switch (serviceType) {
      case 'uptime-kuma':
        return ['uptime', 'services'];
      case 'netdata':
        return ['cpu', 'memory', 'disk', 'network'];
      case 'unraid':
        return ['cpu', 'memory', 'disk', 'docker', 'temperature'];
      default:
        return [];
    }
  };

  const formatStatus = (status: string | null): string => {
    if (!status) return 'Not tested';
    switch (status) {
      case 'connected':
      case 'success':
        return '✅ Connected';
      case 'failed':
        return '❌ Failed';
      case 'partial':
        return '⚠️ Partial';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading integrations...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>API Settings</h1>
        <button onClick={() => handleOpenModal()} className={styles.addButton}>
          + Add Integration
        </button>
      </div>

      {error && !showModal && (
        <div className={styles.error}>{error}</div>
      )}

      {integrations.length === 0 ? (
        <div className={styles.empty}>
          <p>No integrations configured</p>
          <p className={styles.emptyHint}>
            Add an integration to start monitoring your services
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {integrations.map((integration) => (
            <div key={integration.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h3>{integration.service_name}</h3>
                  <span className={styles.badge}>{integration.service_type}</span>
                </div>
                <div className={styles.cardActions}>
                  <button
                    onClick={() => handleTestConnection(integration.id)}
                    disabled={testingId === integration.id}
                    className={styles.testButton}
                    title="Test connection"
                  >
                    {testingId === integration.id ? '⏳' : '🔌'}
                  </button>
                  <button
                    onClick={() => handlePollNow(integration.id)}
                    className={styles.pollButton}
                    title="Poll now (test data collection)"
                  >
                    📊
                  </button>
                  <button
                    onClick={() => handleOpenModal(integration)}
                    className={styles.editButton}
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(integration.id)}
                    className={styles.deleteButton}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div className={styles.cardBody}>
                <div className={styles.info}>
                  <span className={styles.label}>Status:</span>
                  <span>{formatStatus(integration.last_status)}</span>
                </div>

                <div className={styles.info}>
                  <span className={styles.label}>Poll Interval:</span>
                  <span>{integration.poll_interval / 1000}s</span>
                </div>

                <div className={styles.info}>
                  <span className={styles.label}>Active:</span>
                  <span>{integration.is_active ? '✅ Yes' : '❌ No'}</span>
                </div>

                {integration.last_poll_at && (
                  <div className={styles.info}>
                    <span className={styles.label}>Last Poll:</span>
                    <span>{new Date(integration.last_poll_at).toLocaleString()}</span>
                  </div>
                )}

                <div className={styles.capabilities}>
                  <span className={styles.label}>Capabilities:</span>
                  <div className={styles.capabilityTags}>
                    {getCapabilities(integration.service_type).map((cap) => (
                      <span key={cap} className={styles.capabilityTag}>
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {deleteConfirm === integration.id && (
                <div className={styles.confirmDelete}>
                  <p>Delete this integration?</p>
                  <div className={styles.confirmActions}>
                    <button
                      onClick={() => handleDelete(integration.id)}
                      className={styles.confirmButton}
                    >
                      Yes, Delete
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className={styles.cancelButton}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Status Dot Configuration */}
      <div className={styles.statusConfig}>
        <h2>Status Dot Configuration</h2>
        <p className={styles.hint}>
          Configure which monitoring source powers the status dots on your homepage cards.
        </p>

        <div className={styles.formGroup}>
          <label htmlFor="statusSource">Global Status Source</label>
          <select
            id="statusSource"
            value={statusSourceId || ''}
            onChange={handleStatusSourceChange}
            className={styles.select}
          >
            <option value="">-- No Source (All Dots Orange) --</option>
            {integrations
              .filter((i) => ['uptime-kuma', 'unraid'].includes(i.service_type))
              .map((i) => (
                <option key={i.id} value={i.id}>
                  {i.service_name} ({i.service_type})
                </option>
              ))}
          </select>
        </div>

        {statusSourceId && cards.length > 0 && (
          <div className={styles.mappingsSection}>
            <h3>Card to Monitor Mappings</h3>
            {loadingMappings ? (
              <p>Loading...</p>
            ) : (
              <>
                <div className={styles.mappingsTable}>
                  <div className={styles.tableHeader}>
                    <span>Card Name</span>
                    <span>Monitor/Container</span>
                  </div>
                  {cards.map((card) => (
                    <div key={card.id} className={styles.tableRow}>
                      <span className={styles.cardName}>{card.name}</span>
                      <select
                        value={card.status_monitor_name || ''}
                        onChange={(e) =>
                          handleCardMappingChange(card.id, 'status_monitor_name', e.target.value)
                        }
                        className={styles.select}
                      >
                        <option value="">-- Unlinked (Orange) --</option>
                        {monitors.map((monitor) => (
                          <option key={monitor.name} value={monitor.name}>
                            {monitor.name} ({monitor.status})
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleSaveMappings}
                  disabled={savingMappings}
                  className={styles.saveButton}
                >
                  {savingMappings ? 'Saving...' : 'Save Mappings'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <div className={styles.modalOverlay} onClick={handleCloseModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editingId ? 'Edit Integration' : 'Add Integration'}</h2>
              <button onClick={handleCloseModal} className={styles.closeButton}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
              {error && <div className={styles.error}>{error}</div>}

              <div className={styles.formGroup}>
                <label htmlFor="service_name">Service Name *</label>
                <input
                  type="text"
                  id="service_name"
                  placeholder="My Uptime Kuma"
                  value={formData.service_name}
                  onChange={(e) =>
                    setFormData({ ...formData, service_name: e.target.value })
                  }
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="service_type">Service Type *</label>
                <select
                  id="service_type"
                  value={formData.service_type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      service_type: e.target.value as IntegrationType,
                      credentials: { url: '', apiKey: '' }, // Reset credentials on type change
                    })
                  }
                  disabled={!!editingId}
                  required
                >
                  <option value="uptime-kuma">Uptime Kuma</option>
                  <option value="netdata">Netdata</option>
                  <option value="unraid">Unraid</option>
                </select>
                {editingId && (
                  <small className={styles.hint}>Service type cannot be changed</small>
                )}
              </div>

              {editingId && (
                <div className={styles.hint}>
                  Leave credentials blank to keep existing credentials
                </div>
              )}

              {renderCredentialFields()}

              <div className={styles.formGroup}>
                <label htmlFor="poll_interval">Poll Interval (ms) *</label>
                <input
                  type="number"
                  id="poll_interval"
                  min="1000"
                  step="1000"
                  value={formData.poll_interval}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      poll_interval: parseInt(e.target.value, 10),
                    })
                  }
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) =>
                      setFormData({ ...formData, is_active: e.target.checked })
                    }
                  />
                  <span>Active (enable polling)</span>
                </label>
              </div>

              <div className={styles.modalActions}>
                <button type="submit" className={styles.submitButton}>
                  {editingId ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className={styles.cancelButton}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
