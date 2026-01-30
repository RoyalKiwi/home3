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
import SubcategoryModal from './SubcategoryModal';
import type { Subcategory, Category } from '@/lib/types';

interface SortableItemProps {
  id: number;
  subcategory: Subcategory;
  categoryName: string;
  onEdit: (subcategory: Subcategory) => void;
  onDelete: (id: number) => void;
}

function SortableItem({ id, subcategory, categoryName, onEdit, onDelete }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

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
      <div className={styles.content}>
        <div className={styles.name}>
          {subcategory.name}
          {subcategory.admin_only === 1 && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', padding: '0.125rem 0.375rem', background: '#ef4444', borderRadius: '4px' }}>Admin</span>}
        </div>
        <div className={styles.meta}>
          Category: {categoryName} | Order: {subcategory.order_index}
        </div>
      </div>
      <div className={styles.actions}>
        <button
          className={styles.editButton}
          onClick={() => onEdit(subcategory)}
          title="Edit subcategory"
        >
          Edit
        </button>
        <button
          className={styles.deleteButton}
          onClick={() => onDelete(subcategory.id)}
          title="Delete subcategory"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default function SubcategoryList() {
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchData = async () => {
    try {
      setLoading(true);
      const [subResponse, catResponse] = await Promise.all([
        fetch('/api/subcategories'),
        fetch('/api/categories'),
      ]);

      const [subData, catData] = await Promise.all([
        subResponse.json(),
        catResponse.json(),
      ]);

      if (!subResponse.ok) throw new Error(subData.error || 'Failed to fetch subcategories');
      if (!catResponse.ok) throw new Error(catData.error || 'Failed to fetch categories');

      setSubcategories(subData.data);
      setCategories(catData.data);
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

    const oldIndex = subcategories.findIndex((s) => s.id === active.id);
    const newIndex = subcategories.findIndex((s) => s.id === over.id);

    const newSubcategories = arrayMove(subcategories, oldIndex, newIndex);
    const updates = newSubcategories.map((s, index) => ({ ...s, order_index: index }));

    setSubcategories(updates);

    try {
      await Promise.all(
        updates.map((s) =>
          fetch(`/api/subcategories/${s.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_index: s.order_index }),
          })
        )
      );
    } catch (err) {
      fetchData();
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this subcategory? This will also delete all cards within it.')) return;

    try {
      const response = await fetch(`/api/subcategories/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete subcategory');
      }
      setSubcategories(subcategories.filter((s) => s.id !== id));
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const getCategoryName = (categoryId: number) => {
    return categories.find((c) => c.id === categoryId)?.name || 'Unknown';
  };

  if (loading) return <div className={styles.loading}>Loading subcategories...</div>;
  if (error) return <div className={styles.error}>Error: {error}</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Subcategories</h2>
        <button className={styles.createButton} onClick={() => { setEditingSubcategory(null); setModalOpen(true); }}>
          + New Subcategory
        </button>
      </div>

      {subcategories.length === 0 ? (
        <div className={styles.empty}>No subcategories yet. Create your first subcategory to get started.</div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={subcategories.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className={styles.list}>
              {subcategories.map((subcategory) => (
                <SortableItem
                  key={subcategory.id}
                  id={subcategory.id}
                  subcategory={subcategory}
                  categoryName={getCategoryName(subcategory.category_id)}
                  onEdit={(s) => { setEditingSubcategory(s); setModalOpen(true); }}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {modalOpen && (
        <SubcategoryModal
          subcategory={editingSubcategory}
          categories={categories}
          onClose={(refresh) => { setModalOpen(false); setEditingSubcategory(null); if (refresh) fetchData(); }}
        />
      )}
    </div>
  );
}
