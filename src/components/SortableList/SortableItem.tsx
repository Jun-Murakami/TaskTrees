import { FC } from 'react';
import { clsx } from 'clsx';
import { useSortable, defaultAnimateLayoutChanges } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableSource } from './SortableSource';

import styles from './OverlaySortableItem.module.scss';

type Item = {
  id: number;
  text: string;
};

export type SortableItemProps = {
  isPreviewMode: boolean;
  item: Item;
};

export const SortableItem: FC<SortableItemProps> = ({ isPreviewMode, item }) => {
  const {
    isOver,
    activeIndex,
    overIndex,
    isDragging,
    isSorting,
    setNodeRef,
    transform,
    transition,
    setActivatorNodeRef,
    attributes,
    listeners,
  } = useSortable({
    id: item.id,
    animateLayoutChanges: isPreviewMode ? ({ isSorting }) => !isSorting : defaultAnimateLayoutChanges,
  });

  const canTransform = !isPreviewMode || !isSorting;

  /** どっち向きに並び変わるか */
  const sortDirection = activeIndex > overIndex ? 'before' : activeIndex < overIndex ? 'after' : null;

  /** 挿入先を表示するか */
  const isShowIndicator = isPreviewMode && isOver && sortDirection != null;

  const opacity = isPreviewMode ? 0.5 : 0;

  return (
    <div
      ref={setNodeRef}
      className={clsx(styles.Item, {
        [styles._active]: isShowIndicator,
        [styles._before]: sortDirection === 'before',
        [styles._after]: sortDirection === 'after',
      })}
      style={{
        opacity: isDragging ? opacity : undefined,
        transform: canTransform ? CSS.Transform.toString(transform) : undefined,
        transition,
      }}
    >
      <SortableSource
        item={item}
        handlerProps={{
          ref: setActivatorNodeRef,
          attributes,
          listeners,
        }}
      />
    </div>
  );
};
