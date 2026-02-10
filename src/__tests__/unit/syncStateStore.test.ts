import { describe, it, expect, beforeEach } from 'vitest';
import { useSyncStateStore } from '@/store/syncStateStore';
import { hashData } from '@/utils/syncUtils';
import { TreeItems } from '@/types/types';

const sampleItems: TreeItems = [
  { id: 'item-1', children: [], value: 'Task 1' },
  { id: 'item-2', children: [{ id: 'item-3', children: [], value: 'Sub task' }], value: 'Task 2' },
];

const sampleItemsModified: TreeItems = [
  { id: 'item-1', children: [], value: 'Task 1 modified' },
  { id: 'item-2', children: [{ id: 'item-3', children: [], value: 'Sub task' }], value: 'Task 2' },
];

describe('syncStateStore — items sync', () => {
  beforeEach(() => {
    useSyncStateStore.getState().resetAllSync();
  });

  it('starts with clean initial state', () => {
    const { itemsSync } = useSyncStateStore.getState();
    expect(itemsSync.dirty).toBe(false);
    expect(itemsSync.baseSnapshot).toBeNull();
    expect(itemsSync.baseHash).toBe('');
    expect(itemsSync.lastServerHash).toBe('');
  });

  it('markItemsDirty sets dirty flag and preserves existing base', () => {
    useSyncStateStore.getState().setItemsBaseFromServer(sampleItems, hashData(sampleItems));
    useSyncStateStore.getState().markItemsDirty();
    const { itemsSync } = useSyncStateStore.getState();

    expect(itemsSync.dirty).toBe(true);
    expect(itemsSync.baseSnapshot).toEqual(sampleItems);
    expect(itemsSync.baseHash).toBe(hashData(sampleItems));
  });

  it('markItemsDirty is idempotent — second call does not change state', () => {
    useSyncStateStore.getState().setItemsBaseFromServer(sampleItems, hashData(sampleItems));
    useSyncStateStore.getState().markItemsDirty();
    const firstHash = useSyncStateStore.getState().itemsSync.baseHash;

    useSyncStateStore.getState().markItemsDirty();
    const { itemsSync } = useSyncStateStore.getState();

    expect(itemsSync.baseHash).toBe(firstHash);
    expect(itemsSync.baseSnapshot).toEqual(sampleItems);
  });

  it('clearItemsDirty resets dirty state but preserves lastServerHash', () => {
    useSyncStateStore.getState().setItemsBaseFromServer(sampleItems, hashData(sampleItems));
    useSyncStateStore.getState().setItemsServerHash('server-hash-1');
    useSyncStateStore.getState().markItemsDirty();
    useSyncStateStore.getState().clearItemsDirty();

    const { itemsSync } = useSyncStateStore.getState();
    expect(itemsSync.dirty).toBe(false);
    expect(itemsSync.baseSnapshot).toBeNull();
    expect(itemsSync.baseHash).toBe('');
    expect(itemsSync.lastServerHash).toBe('server-hash-1');
  });

  it('setItemsServerHash updates lastServerHash', () => {
    useSyncStateStore.getState().setItemsServerHash('hash-abc');
    expect(useSyncStateStore.getState().itemsSync.lastServerHash).toBe('hash-abc');
  });

  it('setItemsBaseFromServer sets all fields and clears dirty', () => {
    useSyncStateStore.getState().setItemsBaseFromServer(sampleItems, hashData(sampleItems));
    useSyncStateStore.getState().markItemsDirty();
    const serverHash = hashData(sampleItemsModified);
    useSyncStateStore.getState().setItemsBaseFromServer(sampleItemsModified, serverHash);

    const { itemsSync } = useSyncStateStore.getState();
    expect(itemsSync.dirty).toBe(false);
    expect(itemsSync.baseSnapshot).toEqual(sampleItemsModified);
    expect(itemsSync.baseHash).toBe(serverHash);
    expect(itemsSync.lastServerHash).toBe(serverHash);
  });
});

describe('syncStateStore — memo sync', () => {
  beforeEach(() => {
    useSyncStateStore.getState().resetAllSync();
  });

  it('starts with clean initial state', () => {
    const { memoSync } = useSyncStateStore.getState();
    expect(memoSync.dirty).toBe(false);
    expect(memoSync.baseSnapshot).toBeNull();
    expect(memoSync.baseHash).toBe('');
  });

  it('markMemoDirty sets dirty flag and preserves existing base', () => {
    useSyncStateStore.getState().setMemoBaseFromServer('initial memo', hashData('initial memo'));
    useSyncStateStore.getState().markMemoDirty();
    const { memoSync } = useSyncStateStore.getState();

    expect(memoSync.dirty).toBe(true);
    expect(memoSync.baseSnapshot).toBe('initial memo');
    expect(memoSync.baseHash).toBe(hashData('initial memo'));
  });

  it('markMemoDirty is idempotent', () => {
    useSyncStateStore.getState().setMemoBaseFromServer('first', hashData('first'));
    useSyncStateStore.getState().markMemoDirty();
    const firstHash = useSyncStateStore.getState().memoSync.baseHash;

    useSyncStateStore.getState().markMemoDirty();
    expect(useSyncStateStore.getState().memoSync.baseHash).toBe(firstHash);
    expect(useSyncStateStore.getState().memoSync.baseSnapshot).toBe('first');
  });

  it('clearMemoDirty resets dirty but preserves lastServerHash', () => {
    useSyncStateStore.getState().setMemoBaseFromServer('memo text', hashData('memo text'));
    useSyncStateStore.getState().setMemoServerHash('memo-server');
    useSyncStateStore.getState().markMemoDirty();
    useSyncStateStore.getState().clearMemoDirty();

    const { memoSync } = useSyncStateStore.getState();
    expect(memoSync.dirty).toBe(false);
    expect(memoSync.baseSnapshot).toBeNull();
    expect(memoSync.lastServerHash).toBe('memo-server');
  });

  it('setMemoBaseFromServer sets all fields', () => {
    useSyncStateStore.getState().setMemoBaseFromServer('old', hashData('old'));
    useSyncStateStore.getState().markMemoDirty();
    const serverHash = hashData('new memo from server');
    useSyncStateStore.getState().setMemoBaseFromServer('new memo from server', serverHash);

    const { memoSync } = useSyncStateStore.getState();
    expect(memoSync.dirty).toBe(false);
    expect(memoSync.baseSnapshot).toBe('new memo from server');
    expect(memoSync.baseHash).toBe(serverHash);
    expect(memoSync.lastServerHash).toBe(serverHash);
  });
});

describe('syncStateStore — global operations', () => {
  beforeEach(() => {
    useSyncStateStore.getState().resetAllSync();
  });

  it('setIsSyncing toggles syncing flag', () => {
    expect(useSyncStateStore.getState().isSyncing).toBe(false);
    useSyncStateStore.getState().setIsSyncing(true);
    expect(useSyncStateStore.getState().isSyncing).toBe(true);
    useSyncStateStore.getState().setIsSyncing(false);
    expect(useSyncStateStore.getState().isSyncing).toBe(false);
  });

  it('resetAllSync clears everything', () => {
    useSyncStateStore.getState().setItemsBaseFromServer(sampleItems, hashData(sampleItems));
    useSyncStateStore.getState().markItemsDirty();
    useSyncStateStore.getState().setMemoBaseFromServer('memo', hashData('memo'));
    useSyncStateStore.getState().markMemoDirty();
    useSyncStateStore.getState().setIsSyncing(true);
    useSyncStateStore.getState().setItemsServerHash('h1');
    useSyncStateStore.getState().setMemoServerHash('h2');

    useSyncStateStore.getState().resetAllSync();

    const state = useSyncStateStore.getState();
    expect(state.itemsSync.dirty).toBe(false);
    expect(state.itemsSync.baseSnapshot).toBeNull();
    expect(state.itemsSync.baseHash).toBe('');
    expect(state.itemsSync.lastServerHash).toBe('');
    expect(state.memoSync.dirty).toBe(false);
    expect(state.memoSync.baseSnapshot).toBeNull();
    expect(state.memoSync.baseHash).toBe('');
    expect(state.memoSync.lastServerHash).toBe('');
    expect(state.isSyncing).toBe(false);
  });
});
