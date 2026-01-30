'use client';

import { useEffect, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import styles from './CategoryList.module.css';
import CardModal from './CardModal';
import type { Card, Subcategory } from '@/lib/types';

interface SortableItemProps {
  id: number;
  card: Card;
  subcategoryName: string;
  onEdit: (card: Card) => void;
  onDelete: (id: number) => void;
}

function SortableItem({ id, card, subcategoryName, onEdit, onDelete }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={styles.item}>
      <div className={styles.dragHandle} {...attributes} {...listeners}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="4" cy="4" r="1.5" />
          <circle cx="4" cy="8" r="1.5" />
          <circle cx="4" cy="12" r="1.5" />
          <circle cx="12" cy="4" r="1.5" />
          <circle cx="12" cy="8" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
        </svg>
      </div>
      {card.icon_url && (
        <div className={styles.iconPreview}>
          <img src={card.icon_url} alt={card.name} />
        </div>
      )}
      <div className={styles.content}>
        <div className={styles.name}>{card.name}</div>
        <div className={styles.meta}>
          {subcategoryName} | Size: {card.size}
        </div>
      </div>
      <div className={styles.actions}>
        <button className={styles.editButton} onClick={() => onEdit(card)}>Edit</button>
        <button className={styles.deleteButton} onClick={() => onDelete(card.id)}>Delete</button>
      </div>
    </div>
  );
}

export default function CardList() {
  const [cards, setCards] = useState<Card[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchData = async () => {
    try {
      setLoading(true);
      const [cardsRes, subsRes] = await Promise.all([
        fetch('/api/cards'),
        fetch('/api/subcategories'),
      ]);

      const [cardsData, subsData] = await Promise.all([cardsRes.json(), subsRes.json()]);

      if (!cardsRes.ok) throw new Error(cardsData.error || 'Failed to fetch cards');
      if (!subsRes.ok) throw new Error(subsData.error || 'Failed to fetch subcategories');

      setCards(cardsData.data);
      setSubcategories(subsData.data);
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Find the cards being dragged
    const activeCard = cards.find((c) => c.id === active.id);
    const overCard = cards.find((c) => c.id === over.id);

    // Don't allow dragging between different subcategories
    if (!activeCard || !overCard || activeCard.subcategory_id !== overCard.subcategory_id) {
      return;
    }

    // Get all cards in this subcategory
    const subcategoryCards = cards.filter((c) => c.subcategory_id === activeCard.subcategory_id);
    const oldIndex = subcategoryCards.findIndex((c) => c.id === active.id);
    const newIndex = subcategoryCards.findIndex((c) => c.id === over.id);

    // Reorder cards within the subcategory
    const reorderedSubcategoryCards = arrayMove(subcategoryCards, oldIndex, newIndex);
    const updates = reorderedSubcategoryCards.map((c, index) => ({ ...c, order_index: index }));

    // Merge with other cards
    const otherCards = cards.filter((c) => c.subcategory_id !== activeCard.subcategory_id);
    const newCards = [...otherCards, ...updates].sort((a, b) => {
      const subA = subcategories.find((s) => s.id === a.subcategory_id);
      const subB = subcategories.find((s) => s.id === b.subcategory_id);
      if (subA && subB && subA.order_index !== subB.order_index) {
        return subA.order_index - subB.order_index;
      }
      return a.order_index - b.order_index;
    });

    setCards(newCards);

    try {
      await Promise.all(
        updates.map((c) =>
          fetch(`/api/cards/${c.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_index: c.order_index }),
          })
        )
      );
    } catch (err) {
      fetchData();
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this card?')) return;

    try {
      const response = await fetch(`/api/cards/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete card');
      }
      setCards(cards.filter((c) => c.id !== id));
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const getSubcategoryName = (subcategoryId: number) => {
    return subcategories.find((s) => s.id === subcategoryId)?.name || 'Unknown';
  };

  // Group cards by subcategory and sort by subcategory order
  const groupedCards = subcategories
    .sort((a, b) => a.order_index - b.order_index)
    .map((subcategory) => ({
      subcategory,
      cards: cards
        .filter((c) => c.subcategory_id === subcategory.id)
        .sort((a, b) => a.order_index - b.order_index),
    }))
    .filter((group) => group.cards.length > 0);

  if (loading) return <div className={styles.loading}>Loading cards...</div>;
  if (error) return <div className={styles.error}>Error: {error}</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Cards</h2>
        <button className={styles.createButton} onClick={() => { setEditingCard(null); setModalOpen(true); }}>
          + New Card
        </button>
      </div>

      {cards.length === 0 ? (
        <div className={styles.empty}>No cards yet. Create your first card to get started.</div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          {groupedCards.map(({ subcategory, cards: subcategoryCards }) => (
            <div key={subcategory.id} className={styles.subcategoryGroup}>
              <div className={styles.subcategoryHeader}>
                <h3 className={styles.subcategoryName}>{subcategory.name}</h3>
                <span className={styles.cardCount}>{subcategoryCards.length} cards</span>
              </div>
              <SortableContext items={subcategoryCards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                <div className={styles.list}>
                  {subcategoryCards.map((card) => (
                    <SortableItem
                      key={card.id}
                      id={card.id}
                      card={card}
                      subcategoryName={getSubcategoryName(card.subcategory_id)}
                      onEdit={(c) => { setEditingCard(c); setModalOpen(true); }}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </SortableContext>
            </div>
          ))}
        </DndContext>
      )}

      {modalOpen && (
        <CardModal
          card={editingCard}
          subcategories={subcategories}
          onClose={(refresh) => { setModalOpen(false); setEditingCard(null); if (refresh) fetchData(); }}
        />
      )}
    </div>
  );
}
