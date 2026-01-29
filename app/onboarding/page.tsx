'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function OnboardingPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.username || !formData.password || !formData.confirmPassword) {
      setError('All fields are required');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create superuser');
      }

      // Redirect to admin after successful creation
      router.push('/admin');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  return (
    <div className={styles.onboarding}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Welcome to Homepage3</h1>
          <p className={styles.subtitle}>Let's set up your dashboard</p>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.icon}>🔐</span>
            <h2 className={styles.cardTitle}>Create Superuser Account</h2>
          </div>

          <p className={styles.cardDescription}>
            This account will have full administrative access to manage your dashboard.
          </p>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="username" className={styles.label}>
                Username
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                className={styles.input}
                placeholder="admin"
                required
                autoComplete="username"
                disabled={loading}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="password" className={styles.label}>
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                className={styles.input}
                placeholder="Minimum 8 characters"
                required
                autoComplete="new-password"
                disabled={loading}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="confirmPassword" className={styles.label}>
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={(e) =>
                  setFormData({ ...formData, confirmPassword: e.target.value })
                }
                className={styles.input}
                placeholder="Re-enter your password"
                required
                autoComplete="new-password"
                disabled={loading}
              />
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <button
              type="submit"
              className={styles.submitButton}
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Create Superuser Account'}
            </button>
          </form>
        </div>

        <div className={styles.info}>
          <p className={styles.infoText}>
            <strong>Note:</strong> This step cannot be skipped. You'll need admin
            access to configure your dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
