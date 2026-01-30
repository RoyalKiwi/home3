'use client';

import { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
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
import CategoryModal from './CategoryModal';
import type { Category } from '@/lib/types';

interface SortableItemProps {
  id: number;
  category: Category;
  onEdit: (category: Category) => void;
  onDelete: (id: number) => void;
}

function SortableItem({ id, category, onEdit, onDelete }: SortableItemProps) {
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
        <div className={styles.name}>{category.name}</div>
        <div className={styles.meta}>Order: {category.order_index}</div>
      </div>
      <div className={styles.actions}>
        <button
          className={styles.editButton}
          onClick={() => onEdit(category)}
          title="Edit category"
        >
          Edit
        </button>
        <button
          className={styles.deleteButton}
          onClick={() => onDelete(category.id)}
          title="Delete category"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

const CategoryList = forwardRef((props, ref) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  useImperativeHandle(ref, () => ({
    openCreateModal: () => {
      setEditingCategory(null);
      setModalOpen(true);
    }
  }));

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/categories');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch categories');
      }

      setCategories(data.data);
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = categories.findIndex((cat) => cat.id === active.id);
    const newIndex = categories.findIndex((cat) => cat.id === over.id);

    const newCategories = arrayMove(categories, oldIndex, newIndex);

    // Update order_index for all affected categories
    const updates = newCategories.map((cat, index) => ({
      ...cat,
      order_index: index,
    }));

    // Optimistic update
    setCategories(updates);

    // Update server
    try {
      await Promise.all(
        updates.map((cat) =>
          fetch(`/api/categories/${cat.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_index: cat.order_index }),
          })
        )
      );
    } catch (err) {
      // Revert on error
      fetchCategories();
    }
  };

  const handleCreate = () => {
    setEditingCategory(null);
    setModalOpen(true);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this category? This will also delete all subcategories and cards within it.')) {
      return;
    }

    try {
      const response = await fetch(`/api/categories/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete category');
      }

      setCategories(categories.filter((cat) => cat.id !== id));
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleModalClose = (refresh?: boolean) => {
    setModalOpen(false);
    setEditingCategory(null);
    if (refresh) {
      fetchCategories();
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading categories...</div>;
  }

  if (error) {
    return <div className={styles.error}>Error: {error}</div>;
  }

  return (
    <div className={styles.container}>
      {categories.length === 0 ? (
        <div className={styles.empty}>
          No categories yet. Create your first category to get started.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={categories.map((cat) => cat.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className={styles.list}>
              {categories.map((category) => (
                <SortableItem
                  key={category.id}
                  id={category.id}
                  category={category}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {modalOpen && (
        <CategoryModal
          category={editingCategory}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
});

CategoryList.displayName = 'CategoryList';

export default CategoryList;
