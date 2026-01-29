'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import styles from './AdminSidebar.module.css';

const modules = [
  { id: 'console', name: 'Console', icon: '📊', path: '/admin' },
  { id: 'dashboard', name: 'Dashboard', icon: '🎛️', path: '/admin/dashboard' },
  { id: 'users', name: 'Users', icon: '👥', path: '/admin/users' },
  { id: 'api-settings', name: 'API Settings', icon: '🔌', path: '/admin/api-settings' },
  { id: 'monitoring', name: 'Monitoring', icon: '📡', path: '/admin/monitoring' },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <span className={styles.headerIcon}>⚙️</span>
        <span className={styles.headerText}>Admin Control</span>
      </div>

      <nav className={styles.nav}>
        {modules.map((module) => {
          const isActive = pathname === module.path;

          return (
            <Link
              key={module.id}
              href={module.path}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
            >
              <span className={styles.navIcon}>{module.icon}</span>
              <span className={styles.navText}>{module.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.footer}>
        <form action="/api/auth/logout" method="POST" className={styles.logoutForm}>
          <button type="submit" className={styles.logoutButton}>
            <span className={styles.logoutIcon}>🚪</span>
            <span>Logout</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
