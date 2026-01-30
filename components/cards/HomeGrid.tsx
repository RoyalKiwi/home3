'use client';

import { useState, useEffect } from 'react';
import AppCard from './AppCard';
import type { Card } from '@/lib/types';
import styles from './HomeGrid.module.css';

interface GroupedCards {
  categoryId: number;
  categoryName: string;
  subcategories: {
    subcategoryId: number;
    subcategoryName: string;
    showSeparator: boolean;
    cards: Card[];
  }[];
}

export default function HomeGrid() {
  const [groupedCards, setGroupedCards] = useState<GroupedCards[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<number>>(new Set());

  // Load collapsed state from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('collapsedCategories');
    if (saved) {
      try {
        const ids = JSON.parse(saved);
        setCollapsedCategories(new Set(ids));
      } catch {
        // Ignore invalid data
      }
    }
  }, []);

  // Save collapsed state to LocalStorage
  useEffect(() => {
    localStorage.setItem('collapsedCategories', JSON.stringify(Array.from(collapsedCategories)));
  }, [collapsedCategories]);

  // Fetch and group cards
  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch all data in parallel
      const [cardsRes, categoriesRes, subcategoriesRes] = await Promise.all([
        fetch('/api/cards'),
        fetch('/api/categories'),
        fetch('/api/subcategories'),
      ]);

      if (!cardsRes.ok || !categoriesRes.ok || !subcategoriesRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const cardsData = await cardsRes.json();
      const categoriesData = await categoriesRes.json();
      const subcategoriesData = await subcategoriesRes.json();

      const cards: Card[] = cardsData.data || [];
      const categories = categoriesData.data || [];
      const subcategories = subcategoriesData.data || [];

      // Group cards by category and subcategory
      const grouped: GroupedCards[] = categories.map((category: any) => {
        const categorySubs = subcategories
          .filter((sub: any) => sub.category_id === category.id)
          .sort((a: any, b: any) => a.order_index - b.order_index)
          .map((sub: any) => ({
            subcategoryId: sub.id,
            subcategoryName: sub.name,
            showSeparator: sub.show_separator,
            cards: cards
              .filter((card: Card) => card.subcategory_id === sub.id)
              .sort((a, b) => a.order_index - b.order_index),
          }))
          .filter((sub) => sub.cards.length > 0); // Only show subcategories with cards

        return {
          categoryId: category.id,
          categoryName: category.name,
          subcategories: categorySubs,
        };
      }).filter((cat) => cat.subcategories.length > 0); // Only show categories with subcategories

      setGroupedCards(grouped);
    } catch (err: any) {
      setError(err.message || 'Failed to load cards');
    } finally {
      setLoading(false);
    }
  };

  // Toggle category collapse
  const toggleCategory = (categoryId: number) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
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
  const hasResults = groupedCards.some((category) =>
    category.subcategories.some((sub) => filterCards(sub.cards).length > 0)
  );

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

      {/* Categories */}
      {groupedCards.map((category) => {
        const isCollapsed = collapsedCategories.has(category.categoryId);
        const visibleSubcategories = category.subcategories.filter(
          (sub) => filterCards(sub.cards).length > 0
        );

        if (visibleSubcategories.length === 0 && searchQuery) return null;

        return (
          <div key={category.categoryId} className={styles.category}>
            {/* Category Header */}
            <button
              className={styles.categoryHeader}
              onClick={() => toggleCategory(category.categoryId)}
              aria-expanded={!isCollapsed}
            >
              <h2 className={styles.categoryName}>{category.categoryName}</h2>
              <span className={`${styles.chevron} ${isCollapsed ? styles.collapsed : ''}`}>
                ▼
              </span>
            </button>

            {/* Subcategories */}
            {!isCollapsed && (
              <div className={styles.subcategories}>
                {visibleSubcategories.map((subcategory) => {
                  const filteredCards = filterCards(subcategory.cards);
                  if (filteredCards.length === 0) return null;

                  return (
                    <div key={subcategory.subcategoryId} className={styles.subcategory}>
                      {/* Subcategory Name with Separator */}
                      {subcategory.showSeparator && (
                        <div className={styles.subcategoryHeader}>
                          <h3 className={styles.subcategoryName}>
                            {subcategory.subcategoryName}
                          </h3>
                          <div className={styles.separator}></div>
                        </div>
                      )}

                      {/* Cards Grid */}
                      <div className={styles.cardsGrid}>
                        {filteredCards.map((card) => (
                          <AppCard key={card.id} card={card} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Empty State */}
      {groupedCards.length === 0 && !searchQuery && (
        <div className={styles.emptyState}>
          <p>No apps yet. Add some cards in the admin dashboard!</p>
        </div>
      )}
    </div>
  );
}
