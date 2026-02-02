'use client';

import { useState, useEffect } from 'react';
import styles from './TemplateEditor.module.css';

/**
 * Template Editor Component - Phase 4B
 * Manages notification message templates with variable substitution
 */

interface NotificationTemplate {
  id: number;
  name: string;
  title_template: string;
  message_template: string;
  is_default: boolean;
  is_active: boolean;
}

const AVAILABLE_VARIABLES = [
  { var: '{{timestamp}}', desc: 'ISO timestamp of alert' },
  { var: '{{severity}}', desc: 'Alert severity (info, warning, critical)' },
  { var: '{{metricName}}', desc: 'Short metric name' },
  { var: '{{metricDisplayName}}', desc: 'Human-readable metric name' },
  { var: '{{metricValue}}', desc: 'Current metric value' },
  { var: '{{threshold}}', desc: 'Threshold value' },
  { var: '{{unit}}', desc: 'Unit (%, °C, Mbps, etc.)' },
  { var: '{{integrationName}}', desc: 'Integration name' },
  { var: '{{cardName}}', desc: 'Card name' },
  { var: '{{oldStatus}}', desc: 'Previous status (for status changes)' },
  { var: '{{newStatus}}', desc: 'New status (for status changes)' },
];

export default function TemplateEditor() {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    title_template: '',
    message_template: '',
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      // API endpoint would be /api/notification-templates
      // For now, mock it
      setTemplates([
        {
          id: 1,
          name: 'Default System Template',
          title_template: '{{severity}} Alert: {{metricName}}',
          message_template: '{{integrationName}} - {{metricDisplayName}} is {{metricValue}}{{unit}}',
          is_default: true,
          is_active: true,
        },
      ]);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (template?: NotificationTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        title_template: template.title_template,
        message_template: template.message_template,
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        title_template: '',
        message_template: '',
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTemplate(null);
  };

  const insertVariable = (variable: string, field: 'title_template' | 'message_template') => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field] + variable,
    }));
  };

  const previewTemplate = () => {
    const sampleData = {
      timestamp: new Date().toISOString(),
      severity: 'warning',
      metricName: 'cpu_usage',
      metricDisplayName: 'CPU Usage',
      metricValue: '85',
      threshold: '80',
      unit: '%',
      integrationName: 'Netdata',
      cardName: 'Main Server',
      oldStatus: 'online',
      newStatus: 'offline',
    };

    let title = formData.title_template;
    let message = formData.message_template;

    for (const [key, value] of Object.entries(sampleData)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      title = title.replace(regex, value);
      message = message.replace(regex, value);
    }

    return { title, message };
  };

  const { title: previewTitle, message: previewMessage } = previewTemplate();

  if (loading) return <div>Loading templates...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2>Notification Templates</h2>
          <p className={styles.description}>
            Customize notification messages with dynamic variables
          </p>
        </div>
        <button className={styles.btnPrimary} onClick={() => handleOpenModal()}>
          Add Template
        </button>
      </div>

      <div className={styles.templateList}>
        {templates.map((template) => (
          <div key={template.id} className={styles.templateCard}>
            <div className={styles.templateHeader}>
              <h3>{template.name}</h3>
              {template.is_default && <span className={styles.badge}>DEFAULT</span>}
            </div>
            <div className={styles.templatePreview}>
              <strong>Title:</strong> {template.title_template}
            </div>
            <div className={styles.templatePreview}>
              <strong>Message:</strong> {template.message_template}
            </div>
            <div className={styles.templateActions}>
              <button
                className={styles.btnSmall}
                onClick={() => handleOpenModal(template)}
              >
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className={styles.modalOverlay} onClick={handleCloseModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editingTemplate ? 'Edit Template' : 'Add Template'}</h2>
              <button className={styles.modalClose} onClick={handleCloseModal}>
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>Template Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Critical Alert Template"
                />
              </div>

              <div className={styles.formGroup}>
                <label>Title Template</label>
                <textarea
                  value={formData.title_template}
                  onChange={(e) =>
                    setFormData({ ...formData, title_template: e.target.value })
                  }
                  placeholder="e.g., 🚨 {{severity}} Alert: {{metricName}}"
                  rows={2}
                />
                <div className={styles.variableButtons}>
                  {AVAILABLE_VARIABLES.slice(0, 5).map((v) => (
                    <button
                      key={v.var}
                      className={styles.varButton}
                      onClick={() => insertVariable(v.var, 'title_template')}
                      title={v.desc}
                    >
                      {v.var}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Message Template</label>
                <textarea
                  value={formData.message_template}
                  onChange={(e) =>
                    setFormData({ ...formData, message_template: e.target.value })
                  }
                  placeholder="e.g., {{integrationName}} reported {{metricDisplayName}} at {{metricValue}}{{unit}}"
                  rows={6}
                />
                <div className={styles.variableButtons}>
                  {AVAILABLE_VARIABLES.map((v) => (
                    <button
                      key={v.var}
                      className={styles.varButton}
                      onClick={() => insertVariable(v.var, 'message_template')}
                      title={v.desc}
                    >
                      {v.var}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.preview}>
                <h3>Preview (with sample data)</h3>
                <div className={styles.previewCard}>
                  <strong>{previewTitle}</strong>
                  <p>{previewMessage}</p>
                </div>
              </div>

              <div className={styles.modalActions}>
                <button className={styles.btnSecondary} onClick={handleCloseModal}>
                  Cancel
                </button>
                <button className={styles.btnPrimary}>Save Template</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
