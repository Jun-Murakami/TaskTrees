import { TreeItem } from '@/types/types';

export const initialItems: TreeItem[] = [
  {
    id: 'trash',
    value: 'Trash',
    children: [],
    depth: 0,
    parentId: null,
  },
];

export const initialOfflineItems: TreeItem[] = [
  {
    id: '1',
    value: '※ 現在オフラインモードで使用しています。',
    children: [
      {
        id: '2',
        value: 'オフラインモードでは、ツリーは１つだけ作成できます。',
        children: [
          {
            id: '3',
            value: 'ログイン後にこのツリーをインポートすることもできます。',
            children: [],
            depth: 2,
            parentId: '2',
            done: false,
          },
        ],
        depth: 1,
        parentId: '1',
        done: false,
      },
    ],
    done: false,
    depth: 0,
    parentId: null,
  },
  {
    id: 'trash',
    value: 'Trash',
    children: [],
    depth: 0,
    parentId: null,
  },
];

