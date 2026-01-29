import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.title}>Homepage3</h1>
        <p className={styles.subtitle}>Void Dashboard</p>
        <div className={styles.status}>
          <span className={styles.statusDot}></span>
          <span>System Initializing...</span>
        </div>
      </div>
    </main>
  );
}
