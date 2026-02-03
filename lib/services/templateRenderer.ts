/**
 * Template Renderer Service
 *
 * Purpose: Render notification templates with dynamic variable substitution
 * Variables: {{severity}}, {{metricName}}, {{cardName}}, etc.
 */

import { getDb } from '../db';
import type { NotificationPayload, NotificationTemplate } from '../types';

/**
 * Get the default notification template
 */
export function getDefaultTemplate(): NotificationTemplate | null {
  const db = getDb();
  return db
    .prepare('SELECT * FROM notification_templates WHERE is_default = 1 AND is_active = 1 LIMIT 1')
    .get() as NotificationTemplate | null;
}

/**
 * Get a specific notification template by ID
 */
export function getTemplateById(templateId: number): NotificationTemplate | null {
  const db = getDb();
  return db
    .prepare('SELECT * FROM notification_templates WHERE id = ? AND is_active = 1 LIMIT 1')
    .get(templateId) as NotificationTemplate | null;
}

/**
 * Render a template string with variable substitution
 * @param template Template string with {{variable}} placeholders
 * @param variables Object containing variable values
 * @returns Rendered string with variables replaced
 */
function renderTemplate(template: string, variables: Record<string, any>): string {
  let rendered = template;

  // Replace all {{variable}} placeholders
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    const displayValue = value !== undefined && value !== null ? String(value) : '';
    rendered = rendered.replace(placeholder, displayValue);
  }

  // Remove any unreplaced placeholders (optional variables)
  rendered = rendered.replace(/\{\{[^}]+\}\}/g, '');

  return rendered;
}

/**
 * Build variable context from notification payload
 * Creates all available template variables from the payload
 */
function buildVariableContext(payload: NotificationPayload): Record<string, any> {
  const timestamp = new Date().toISOString();

  return {
    // General
    timestamp,
    severity: payload.severity,
    metricName: payload.alertType,
    metricDisplayName: payload.metadata?.metricDisplayName || payload.alertType,

    // Values
    metricValue: payload.metadata?.metricValue,
    threshold: payload.metadata?.threshold,
    unit: payload.metadata?.unit || '',

    // Source
    integrationName: payload.metadata?.integrationName,
    integrationId: payload.metadata?.integrationId,
    cardName: payload.metadata?.cardName,
    cardId: payload.metadata?.cardId,

    // Status Change
    oldStatus: payload.metadata?.oldStatus,
    newStatus: payload.metadata?.newStatus,

    // Unraid Events
    unraidEvent: payload.metadata?.unraidEvent,
    importance: payload.metadata?.importance,
  };
}

/**
 * Render a notification using a template
 * @param payload The notification payload
 * @param templateId Optional template ID (uses default if not provided)
 * @returns Rendered notification with title and message
 */
export function renderNotification(
  payload: NotificationPayload,
  templateId?: number | null
): { title: string; message: string } {
  // Get template
  let template: NotificationTemplate | null = null;

  if (templateId) {
    template = getTemplateById(templateId);
  }

  // Fallback to default template if specified template not found
  if (!template) {
    template = getDefaultTemplate();
  }

  // If no template found, return original payload
  if (!template) {
    console.warn('[TemplateRenderer] No template found, using payload defaults');
    return {
      title: payload.title,
      message: payload.message,
    };
  }

  // Build variable context
  const variables = buildVariableContext(payload);

  // Render template
  const title = renderTemplate(template.title_template, variables);
  const message = renderTemplate(template.message_template, variables);

  return { title, message };
}

/**
 * Preview a template with sample data
 * Useful for testing templates in the admin UI
 */
export function previewTemplate(
  template: NotificationTemplate,
  sampleData?: Partial<Record<string, any>>
): { title: string; message: string } {
  // Default sample data
  const defaultSample = {
    timestamp: new Date().toISOString(),
    severity: 'warning',
    metricName: 'cpu_usage',
    metricDisplayName: 'CPU Usage',
    metricValue: 85,
    threshold: 80,
    unit: '%',
    integrationName: 'Netdata Server',
    cardName: 'Production Server',
    oldStatus: 'online',
    newStatus: 'offline',
  };

  const variables = { ...defaultSample, ...sampleData };

  return {
    title: renderTemplate(template.title_template, variables),
    message: renderTemplate(template.message_template, variables),
  };
}
