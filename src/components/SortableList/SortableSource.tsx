import { FC } from 'react';
import { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';

import { TreesListItem } from '../../types/types';

import styles from './OverlaySortableSource.module.scss';

export type SortableSourceProps = {
  item: TreesListItem;
  handlerProps?: {
    ref: (element: HTMLElement | null) => void;
    attributes: DraggableAttributes;
    listeners: DraggableSyntheticListeners;
  };
};

export const SortableSource: FC<SortableSourceProps> = ({ item, handlerProps }) => {
  return (
    <div className={styles.SourceWrapper}>
      <div className={styles.Source}>
        <i
          ref={handlerProps?.ref}
          className='mdi mdi-drag'
          style={{
            cursor: handlerProps ? 'grab' : 'grabbing',
          }}
          {...handlerProps?.attributes}
          {...handlerProps?.listeners}
        />
        <div className={styles.Source__content}>{JSON.stringify(item)}</div>
      </div>
    </div>
  );
};
