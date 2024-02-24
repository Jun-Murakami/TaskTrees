import type { MutableRefObject } from 'react';
import type { UniqueIdentifier } from '@dnd-kit/core';

export interface TreeItem {
  id: UniqueIdentifier;
  children: TreeItem[];
  collapsed?: boolean;
  value: string;
  done?: boolean;
}

export type TreeItems = TreeItem[];

export type TreesListItem = {
  id: string;
  name: string;
};

export type TreesList = TreesListItem[] | null;

export interface FlattenedItem extends TreeItem {
  parentId: UniqueIdentifier | null;
  depth: number;
  index: number;
}

export type SensorContext = MutableRefObject<{
  items: FlattenedItem[];
  offset: number;
}>;

export type AppState = {
  items: TreeItem[];
  hideDoneItems: boolean;
  darkMode: boolean;
}
