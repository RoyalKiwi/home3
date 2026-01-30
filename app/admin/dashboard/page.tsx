'use client';

import { useState, useRef } from 'react';
import styles from './page.module.css';
import CategoryList from '@/components/admin/CategoryList';
import SubcategoryList from '@/components/admin/SubcategoryList';
import CardList from '@/components/admin/CardList';

type Tab = 'categories' | 'subcategories' | 'cards';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('cards');
  const cardListRef = useRef<any>(null);
  const subcategoryListRef = useRef<any>(null);
  const categoryListRef = useRef<any>(null);

  const handleCreate = () => {
    if (activeTab === 'cards') {
      cardListRef.current?.openCreateModal();
    } else if (activeTab === 'subcategories') {
      subcategoryListRef.current?.openCreateModal();
    } else if (activeTab === 'categories') {
      categoryListRef.current?.openCreateModal();
    }
  };

  const getCreateButtonText = () => {
    if (activeTab === 'cards') return '+ New Card';
    if (activeTab === 'subcategories') return '+ New Subcategory';
    return '+ New Category';
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Dashboard Management</h1>
        <p className={styles.subtitle}>Manage your homepage categories, subcategories, and cards</p>
      </div>

      <div className={styles.tabsContainer}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'cards' ? styles.active : ''}`}
            onClick={() => setActiveTab('cards')}
          >
            Cards
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'subcategories' ? styles.active : ''}`}
            onClick={() => setActiveTab('subcategories')}
          >
            Subcategories
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'categories' ? styles.active : ''}`}
            onClick={() => setActiveTab('categories')}
          >
            Categories
          </button>
        </div>
        <button className={styles.createButton} onClick={handleCreate}>
          {getCreateButtonText()}
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === 'cards' && <CardList ref={cardListRef} />}
        {activeTab === 'subcategories' && <SubcategoryList ref={subcategoryListRef} />}
        {activeTab === 'categories' && <CategoryList ref={categoryListRef} />}
      </div>
    </div>
  );
}
