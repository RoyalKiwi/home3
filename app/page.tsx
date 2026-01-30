import TopNav from '@/components/layout/TopNav';
import HomeGrid from '@/components/cards/HomeGrid';
import styles from './page.module.css';

export default function Home() {
  return (
    <>
      <TopNav />
      <main className={styles.main}>
        <HomeGrid />
      </main>
    </>
  );
}
