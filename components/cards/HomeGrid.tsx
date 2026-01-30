'use client';

import { useState, useEffect } from 'react';
import AppCard from './AppCard';
import type { Card } from '@/lib/types';
import styles from './HomeGrid.module.css';

interface SubcategoryWithCards {
  subcategoryId: number;
  subcategoryName: string;
  showSeparator: boolean;
  cards: Card[];
}

export default function HomeGrid() {
  const [subcategories, setSubcategories] = useState<SubcategoryWithCards[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedSubcategories, setCollapsedSubcategories] = useState<Set<number>>(new Set());

  // Load collapsed state from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('collapsedSubcategories');
    if (saved) {
      try {
        const ids = JSON.parse(saved);
        setCollapsedSubcategories(new Set(ids));
      } catch {
        // Ignore invalid data
      }
    }
  }, []);

  // Save collapsed state to LocalStorage
  useEffect(() => {
    localStorage.setItem('collapsedSubcategories', JSON.stringify(Array.from(collapsedSubcategories)));
  }, [collapsedSubcategories]);

  // Fetch and group cards
  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch all data in parallel
      const [cardsRes, subcategoriesRes] = await Promise.all([
        fetch('/api/cards'),
        fetch('/api/subcategories'),
      ]);

      if (!cardsRes.ok || !subcategoriesRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const cardsData = await cardsRes.json();
      const subcategoriesData = await subcategoriesRes.json();

      const cards: Card[] = cardsData.data || [];
      const subs = subcategoriesData.data || [];

      // Group cards by subcategory
      const grouped: SubcategoryWithCards[] = subs
        .sort((a: any, b: any) => a.order_index - b.order_index)
        .map((sub: any) => ({
          subcategoryId: sub.id,
          subcategoryName: sub.name,
          showSeparator: sub.show_separator,
          cards: cards
            .filter((card: Card) => card.subcategory_id === sub.id)
            .sort((a, b) => a.order_index - b.order_index),
        }))
        .filter((sub: any) => sub.cards.length > 0); // Only show subcategories with cards

      setSubcategories(grouped);
    } catch (err: any) {
      setError(err.message || 'Failed to load cards');
    } finally {
      setLoading(false);
    }
  };

  // Toggle subcategory collapse
  const toggleSubcategory = (subcategoryId: number) => {
    setCollapsedSubcategories((prev) => {
      const next = new Set(prev);
      if (next.has(subcategoryId)) {
        next.delete(subcategoryId);
      } else {
        next.add(subcategoryId);
      }
      return next;
    });
  };

  // Filter cards by search query
  const filterCards = (cards: Card[]) => {
    if (!searchQuery.trim()) return cards;

    const query = searchQuery.toLowerCase();
    return cards.filter(
      (card) =>
        card.name.toLowerCase().includes(query) ||
        card.subtext.toLowerCase().includes(query)
    );
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error}>
        <p>⚠️ {error}</p>
        <button onClick={fetchCards} className={styles.retryButton}>
          Retry
        </button>
      </div>
    );
  }

  // Check if search returns no results
  const hasResults = subcategories.some((sub) => filterCards(sub.cards).length > 0);

  return (
    <div className={styles.container}>
      {/* Search Bar */}
      <div className={styles.searchBar}>
        <input
          type="text"
          placeholder="Search apps..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={styles.searchInput}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className={styles.clearButton}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {/* No Results Message */}
      {!hasResults && searchQuery && (
        <div className={styles.noResults}>
          <p>No matches found for "{searchQuery}"</p>
        </div>
      )}

      {/* Subcategories (visual categories) */}
      {subcategories.map((subcategory) => {
        const isCollapsed = collapsedSubcategories.has(subcategory.subcategoryId);
        const filteredCards = filterCards(subcategory.cards);

        if (filteredCards.length === 0 && searchQuery) return null;

        return (
          <div key={subcategory.subcategoryId} className={styles.category}>
            {/* Subcategory Header */}
            <button
              className={styles.categoryHeader}
              onClick={() => toggleSubcategory(subcategory.subcategoryId)}
              aria-expanded={!isCollapsed}
            >
              <h2 className={styles.categoryName}>{subcategory.subcategoryName}</h2>
              <span className={`${styles.chevron} ${isCollapsed ? styles.collapsed : ''}`}>
                ▼
              </span>
            </button>

            {/* Cards Grid */}
            {!isCollapsed && (
              <div className={styles.cardsGrid}>
                {filteredCards.map((card) => (
                  <AppCard key={card.id} card={card} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Empty State */}
      {subcategories.length === 0 && !searchQuery && (
        <div className={styles.emptyState}>
          <p>No apps yet. Add some cards in the admin dashboard!</p>
        </div>
      )}
    </div>
  );
}
