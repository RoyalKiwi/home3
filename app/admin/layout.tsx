import TopNav from '@/components/layout/TopNav';
import AdminSidebar from '@/components/layout/AdminSidebar';
import styles from './layout.module.css';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <TopNav />
      <div className={styles.adminLayout}>
        <AdminSidebar />
        <main className={styles.mainContent}>
          {children}
        </main>
      </div>
    </>
  );
}
