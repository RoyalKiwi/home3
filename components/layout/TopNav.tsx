'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import styles from './TopNav.module.css';

export default function TopNav() {
  const pathname = usePathname();

  const isAdmin = pathname.startsWith('/admin');
  const isHome = pathname === '/';

  return (
    <nav className={styles.topNav}>
      <div className={styles.container}>
        <div className={styles.logo}>
          <span className={styles.logoText}>Homepage3</span>
          <span className={styles.logoSubtext}>VOID</span>
        </div>

        <div className={styles.tabs}>
          <Link
            href="/"
            className={`${styles.tab} ${isHome ? styles.active : ''}`}
          >
            <span className={styles.tabIcon}>🏠</span>
            <span>Home</span>
          </Link>

          <Link
            href="/admin"
            className={`${styles.tab} ${isAdmin ? styles.active : ''}`}
          >
            <span className={styles.tabIcon}>⚙️</span>
            <span>Admin</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
