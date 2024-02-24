import { FC } from 'react';
import { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';

import styles from './OverlaySortableSource.module.scss';

type Item = {
  id: number;
  text: string;
};

export type SortableSourceProps = {
  item: Item;
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
