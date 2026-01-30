'use client';

import { useState, FormEvent, useRef } from 'react';
import type { Card, Subcategory, CardSize } from '@/lib/types';
import styles from './Modal.module.css';

interface CardModalProps {
  card: Card | null;
  subcategories: Subcategory[];
  onClose: (refresh: boolean) => void;
}

export default function CardModal({ card, subcategories, onClose }: CardModalProps) {
  const [subcategoryId, setSubcategoryId] = useState(card?.subcategory_id || subcategories[0]?.id || 0);
  const [name, setName] = useState(card?.name || '');
  const [subtext, setSubtext] = useState(card?.subtext || '');
  const [url, setUrl] = useState(card?.url || '');
  const [iconUrl, setIconUrl] = useState(card?.icon_url || '');
  const [gradientColors, setGradientColors] = useState(card?.gradient_colors || '');
  const [size, setSize] = useState<CardSize>(card?.size || 'small');
  const [showStatus, setShowStatus] = useState(card?.show_status ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fetchingIcon, setFetchingIcon] = useState(false);
  const [generatingGradient, setGeneratingGradient] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleIconUpload = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFetchingIcon(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/branding/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload icon');
      }

      setIconUrl(data.data.iconPath);
      setGradientColors(JSON.stringify(data.data.gradient));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFetchingIcon(false);
    }
  };

  const handleFetchIcon = async () => {
    if (!url.trim()) {
      setError('Please enter a URL first');
      return;
    }

    setFetchingIcon(true);
    setError('');

    try {
      const response = await fetch('/api/branding/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch icon');
      }

      setIconUrl(data.data.iconPath);
      setGradientColors(JSON.stringify(data.data.gradient));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFetchingIcon(false);
    }
  };

  const handleGenerateGradient = async () => {
    if (!iconUrl.trim()) {
      setError('Please upload or fetch an icon first');
      return;
    }

    setGeneratingGradient(true);
    setError('');

    try {
      const response = await fetch('/api/branding/gradient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ icon_path: iconUrl.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate gradient');
      }

      setGradientColors(JSON.stringify(data.data.gradient));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGeneratingGradient(false);
    }
  };

  // Parse gradient colors for preview
  const getGradientStyle = () => {
    if (!gradientColors.trim()) return null;

    try {
      const colors = JSON.parse(gradientColors);
      if (!Array.isArray(colors) || colors.length === 0) return null;

      return {
        '--grad-1': colors[0] || '#3B82F6',
        '--grad-2': colors[1] || '#A855F7',
        '--grad-3': colors[2] || '#0a192f',
        '--grad-4': colors[3] || '#050608',
      } as any;
    } catch {
      return null;
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate gradient_colors is valid JSON if provided
      if (gradientColors && gradientColors.trim()) {
        try {
          JSON.parse(gradientColors);
        } catch {
          throw new Error('Gradient colors must be valid JSON (e.g., ["#ff0000", "#00ff00"])');
        }
      }

      const body: any = {
        subcategory_id: subcategoryId,
        name: name.trim(),
        subtext: subtext.trim(),
        url: url.trim(),
        icon_url: iconUrl.trim() || null,
        gradient_colors: gradientColors.trim() || null,
        size,
        show_status: showStatus,
      };

      const response = await fetch(
        card ? `/api/cards/${card.id}` : '/api/cards',
        {
          method: card ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${card ? 'update' : 'create'} card`);
      }

      onClose(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={() => onClose(false)}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>{card ? 'Edit Card' : 'Create Card'}</h3>
          <button
            type="button"
            className={styles.closeButton}
            onClick={() => onClose(false)}
            disabled={loading}
          >
            ×
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.field}>
            <label className={styles.label}>Subcategory *</label>
            <select
              className={styles.select}
              value={subcategoryId}
              onChange={(e) => setSubcategoryId(parseInt(e.target.value))}
              disabled={loading}
              required
            >
              {subcategories.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Name *</label>
            <input
              type="text"
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              required
              maxLength={100}
              placeholder="e.g., Plex"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Subtext *</label>
            <input
              type="text"
              className={styles.input}
              value={subtext}
              onChange={(e) => setSubtext(e.target.value)}
              disabled={loading}
              required
              maxLength={200}
              placeholder="e.g., Media Server"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>URL *</label>
            <input
              type="url"
              className={styles.input}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
              required
              placeholder="https://example.com"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Icon</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleIconUpload}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || fetchingIcon}
              >
                📤 Upload Icon
              </button>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={handleFetchIcon}
                disabled={loading || fetchingIcon || !url.trim()}
              >
                {fetchingIcon ? '⏳ Fetching...' : '🔍 Fetch from URL'}
              </button>
            </div>
            <input
              type="text"
              className={styles.input}
              value={iconUrl}
              onChange={(e) => setIconUrl(e.target.value)}
              disabled={loading}
              maxLength={500}
              placeholder="/cache/abc123.png (auto-populated or manual)"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Gradient Colors (JSON)</label>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleGenerateGradient}
              disabled={loading || generatingGradient || !iconUrl.trim()}
              style={{ marginBottom: '8px' }}
            >
              {generatingGradient ? '⏳ Generating...' : '🎨 Generate from Icon'}
            </button>
            <textarea
              className={styles.textarea}
              value={gradientColors}
              onChange={(e) => setGradientColors(e.target.value)}
              disabled={loading}
              placeholder='["#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4"]'
              rows={3}
            />
            {getGradientStyle() ? (
              <div className={styles.gradientPreview} style={getGradientStyle()!} />
            ) : (
              <div className={styles.noGradient}>No gradient - generate or enter colors above</div>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Size</label>
            <select
              className={styles.select}
              value={size}
              onChange={(e) => setSize(e.target.value as CardSize)}
              disabled={loading}
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={showStatus}
                onChange={(e) => setShowStatus(e.target.checked)}
                disabled={loading}
              />
              Show Status Indicator
            </label>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={() => onClose(false)}
              disabled={loading}
            >
              Cancel
            </button>
            <button type="submit" className={styles.submitButton} disabled={loading}>
              {loading ? 'Saving...' : card ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
