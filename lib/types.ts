// Database model types

export interface Category {
  id: number;
  name: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface Subcategory {
  id: number;
  category_id: number;
  name: string;
  order_index: number;
  show_separator: boolean;
  admin_only: boolean;
  created_at: string;
  updated_at: string;
}

export type CardSize = 'small' | 'medium' | 'large';
export type GradientStyle = 'diagonal' | 'four-corner' | 'radial' | 'conic' | 'horizontal' | 'vertical' | 'double-diagonal';

export interface Card {
  id: number;
  subcategory_id: number;
  name: string;
  subtext: string;
  url: string;
  icon_url: string | null;
  gradient_colors: string | null;
  gradient_style: GradientStyle;
  size: CardSize;
  show_status: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

// Request payload types

export interface CreateCategoryRequest {
  name: string;
  order_index?: number;
}

export interface UpdateCategoryRequest {
  name?: string;
  order_index?: number;
}

export interface CreateSubcategoryRequest {
  category_id: number;
  name: string;
  order_index?: number;
  show_separator?: boolean;
  admin_only?: boolean;
}

export interface UpdateSubcategoryRequest {
  category_id?: number;
  name?: string;
  order_index?: number;
  show_separator?: boolean;
  admin_only?: boolean;
}

export interface CreateCardRequest {
  subcategory_id: number;
  name: string;
  subtext: string;
  url: string;
  icon_url?: string | null;
  gradient_colors?: string | null;
  gradient_style?: GradientStyle;
  size?: CardSize;
  show_status?: boolean;
  order_index?: number;
}

export interface UpdateCardRequest {
  subcategory_id?: number;
  name?: string;
  subtext?: string;
  url?: string;
  icon_url?: string | null;
  gradient_colors?: string | null;
  gradient_style?: GradientStyle;
  size?: CardSize;
  show_status?: boolean;
  order_index?: number;
}
