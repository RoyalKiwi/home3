import TopNav from '@/components/layout/TopNav';
import styles from './page.module.css';

export default function Home() {
  return (
    <>
      <TopNav />
      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.title}>Homepage3</h1>
          <p className={styles.subtitle}>Void Dashboard</p>
          <div className={styles.status}>
            <span className={styles.statusDot}></span>
            <span>Ready for Phase 1 development...</span>
          </div>
        </div>
      </main>
    </>
  );
}
