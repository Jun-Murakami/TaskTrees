import type { MutableRefObject } from 'react';
import type { UniqueIdentifier } from '@dnd-kit/core';

export type TreeItem = {
  id: UniqueIdentifier;
  children: TreeItem[];
  collapsed?: boolean;
  value: string;
  done?: boolean;
  attachedFile?: string;
  timer?: string;
  isUpLift?: boolean;
  upLiftMinute?: number;
  isNotify?: boolean;
  notifyMinute?: number;
  depth?: number;
  parentId?: UniqueIdentifier | null;
};

export type TreeItems = TreeItem[];

export type TreesListItem = {
  id: UniqueIdentifier;
  name: string;
};

export type TreesList = TreesListItem[];

export type MemberItems = {
  [key: string]: string;
};

export type TreesListItemIncludingItems = {
  id?: UniqueIdentifier;
  name?: string;
  currentTreeName?: string; //旧バージョンからの移行用 普段は使用しない
  members?: string[];
  membersV2?: MemberItems;
  timestamp?: number;
  items: TreeItems;
};

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
};
