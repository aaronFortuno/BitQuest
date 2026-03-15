'use client';

import { cn } from '@/lib/utils';

interface ItemListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  emptyMessage?: string;
  maxHeight?: string;
  className?: string;
  keyExtractor?: (item: T, index: number) => string;
}

export function ItemList<T>({ items, renderItem, emptyMessage, maxHeight = '500px', className, keyExtractor }: ItemListProps<T>) {
  if (items.length === 0 && emptyMessage) {
    return <p className="text-muted text-sm text-center py-4">{emptyMessage}</p>;
  }

  return (
    <div className={cn('space-y-2 overflow-y-auto', className)} style={{ maxHeight }}>
      {items.map((item, i) => (
        <div key={keyExtractor ? keyExtractor(item, i) : i}>
          {renderItem(item, i)}
        </div>
      ))}
    </div>
  );
}
