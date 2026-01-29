import styles from './page.module.css';

export default function AdminConsole() {
  return (
    <div className={styles.console}>
      <header className={styles.header}>
        <h1 className={styles.title}>Admin Console</h1>
        <p className={styles.subtitle}>System Overview & Control Center</p>
      </header>

      <div className={styles.grid}>
        <div className={`${styles.card} ${styles.cardLarge}`}>
          <div className={styles.cardHeader}>
            <span className={styles.cardIcon}>📊</span>
            <h2 className={styles.cardTitle}>System Status</h2>
          </div>
          <div className={styles.cardContent}>
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>Server</span>
              <span className={`${styles.statusBadge} ${styles.statusOnline}`}>
                Online
              </span>
            </div>
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>Database</span>
              <span className={`${styles.statusBadge} ${styles.statusOnline}`}>
                Connected
              </span>
            </div>
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>Monitoring</span>
              <span className={`${styles.statusBadge} ${styles.statusPending}`}>
                Phase 4
              </span>
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardIcon}>🎛️</span>
            <h2 className={styles.cardTitle}>Quick Actions</h2>
          </div>
          <div className={styles.cardContent}>
            <p className={styles.placeholder}>Dashboard management coming in Phase 2</p>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardIcon}>📡</span>
            <h2 className={styles.cardTitle}>Recent Activity</h2>
          </div>
          <div className={styles.cardContent}>
            <p className={styles.placeholder}>Activity logs coming in Phase 8</p>
          </div>
        </div>
      </div>
    </div>
  );
}
