import React from 'react';
import {
  Apple,
  Cookie,
  Croissant,
  CupSoda,
  Home,
  Milk,
  ShoppingBasket,
  Sparkles,
  Tag,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  ShoppingBasket,
  Milk,
  CupSoda,
  Cookie,
  Sparkles,
  Croissant,
  Apple,
  Home,
  Tag,
};

interface CategoryIconProps {
  icon?: string;
  className?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  icon = 'ShoppingBasket',
  className = 'w-4 h-4',
}) => {
  const Icon = ICON_MAP[icon] || ShoppingBasket;
  return <Icon className={className} />;
};
