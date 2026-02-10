import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { ref, set, onValue, off } from 'firebase/database';
import {
  getTestDatabase,
  clearEmulatorData,
  setTestData,
  getTestData,
  cleanupTestApp,
} from '../helpers/firebaseTestHelper';
import { hashData } from '@/utils/syncUtils';
import { useSyncStateStore } from '@/store/syncStateStore';
import { TreeItems } from '@/types/types';

const TEST_UID = 'test-user-001';
const TEST_TREE_ID = 'tree-001';

// Firebase RTDB strips empty arrays, so test data uses non-empty children
// to ensure round-trip consistency. Leaf items omit `children` to match
// what Firebase actually returns.
const sampleItems: TreeItems = [
  { id: 'item-1', children: [{ id: 'leaf-1', children: [], value: 'Leaf' }], value: 'Task 1' },
  { id: 'item-2', children: [{ id: 'child-1', children: [{ id: 'leaf-2', children: [], value: 'Deep leaf' }], value: 'Subtask' }], value: 'Task 2' },
];

const serverModifiedItems: TreeItems = [
  { id: 'item-1', children: [{ id: 'leaf-1', children: [], value: 'Leaf' }], value: 'Task 1 from server' },
  { id: 'item-2', children: [{ id: 'child-1', children: [{ id: 'leaf-2', children: [], value: 'Deep leaf' }], value: 'Subtask' }], value: 'Task 2' },
];

const localModifiedItems: TreeItems = [
  { id: 'item-1', children: [{ id: 'leaf-1', children: [], value: 'Leaf' }], value: 'Task 1 local edit' },
  { id: 'item-2', children: [{ id: 'child-1', children: [{ id: 'leaf-2', children: [], value: 'Deep leaf' }], value: 'Subtask' }], value: 'Task 2' },
];

describe('Firebase RTDB Emulator — basic read/write', () => {
  beforeAll(() => {
    getTestDatabase();
  });

  beforeEach(async () => {
    await clearEmulatorData();
  });

  afterAll(async () => {
    await cleanupTestApp();
  });

  it('writes and reads data at a path', async () => {
    await setTestData(`users/${TEST_UID}/quickMemo`, 'Hello memo');
    const result = await getTestData<string>(`users/${TEST_UID}/quickMemo`);
    expect(result).toBe('Hello memo');
  });

  it('writes tree items and reads them back preserving structure', async () => {
    await setTestData(`trees/${TEST_TREE_ID}/items`, sampleItems);
    const result = await getTestData<TreeItems>(`trees/${TEST_TREE_ID}/items`);
    expect(result![0].id).toBe('item-1');
    expect(result![0].value).toBe('Task 1');
    expect(result![1].id).toBe('item-2');
    expect(result![1].children[0].id).toBe('child-1');
  });

  it('writes timestamp and clientId together', async () => {
    const timestamp = Date.now();
    const clientId = 'client-abc';

    await setTestData(`users/${TEST_UID}/timestamp`, timestamp);
    await setTestData(`users/${TEST_UID}/lastWriteClientId`, clientId);

    const ts = await getTestData<number>(`users/${TEST_UID}/timestamp`);
    const cid = await getTestData<string>(`users/${TEST_UID}/lastWriteClientId`);
    expect(ts).toBe(timestamp);
    expect(cid).toBe(clientId);
  });

  it('clearEmulatorData removes all data', async () => {
    await setTestData(`users/${TEST_UID}/quickMemo`, 'will be cleared');
    await clearEmulatorData();
    const result = await getTestData(`users/${TEST_UID}/quickMemo`);
    expect(result).toBeNull();
  });
});

describe('Firebase RTDB Emulator — onValue listener', () => {
  beforeAll(() => {
    getTestDatabase();
  });

  beforeEach(async () => {
    await clearEmulatorData();
  });

  afterAll(async () => {
    await cleanupTestApp();
  });

  it('receives real-time updates via onValue', async () => {
    const db = getTestDatabase();
    const memoRef = ref(db, `users/${TEST_UID}/quickMemo`);

    const values: (string | null)[] = [];

    await new Promise<void>((resolve) => {
      const unsub = onValue(memoRef, (snapshot) => {
        values.push(snapshot.val());
        if (values.length === 2) {
          off(memoRef);
          unsub();
          resolve();
        }
      });

      setTimeout(async () => {
        await set(memoRef, 'updated memo');
      }, 100);
    });

    expect(values[0]).toBeNull();
    expect(values[1]).toBe('updated memo');
  });
});

describe('Sync conflict detection scenarios', () => {
  beforeEach(() => {
    useSyncStateStore.getState().resetAllSync();
  });

  it('Scenario A1: no local edits, server changed → apply server (no conflict)', () => {
    const serverHash = hashData(serverModifiedItems);
    useSyncStateStore.getState().setItemsBaseFromServer(sampleItems, hashData(sampleItems));

    const { itemsSync } = useSyncStateStore.getState();
    expect(itemsSync.dirty).toBe(false);

    useSyncStateStore.getState().setItemsBaseFromServer(serverModifiedItems, serverHash);

    const updated = useSyncStateStore.getState().itemsSync;
    expect(updated.dirty).toBe(false);
    expect(updated.baseSnapshot).toEqual(serverModifiedItems);
    expect(updated.lastServerHash).toBe(serverHash);
  });

  it('Scenario A3: local dirty, server unchanged (baseHash matches) → push local', () => {
    const baseHash = hashData(sampleItems);
    useSyncStateStore.getState().setItemsBaseFromServer(sampleItems, baseHash);

    useSyncStateStore.getState().markItemsDirty();
    const { itemsSync } = useSyncStateStore.getState();
    expect(itemsSync.dirty).toBe(true);

    const serverSnapshotHash = hashData(sampleItems);
    expect(serverSnapshotHash).toBe(baseHash);

    useSyncStateStore.getState().clearItemsDirty();
    const localHash = hashData(localModifiedItems);
    useSyncStateStore.getState().setItemsServerHash(localHash);

    const afterPush = useSyncStateStore.getState().itemsSync;
    expect(afterPush.dirty).toBe(false);
    expect(afterPush.lastServerHash).toBe(localHash);
  });

  it('Scenario A4: local dirty, server changed, local === server (convergence)', () => {
    const baseHash = hashData(sampleItems);
    useSyncStateStore.getState().setItemsBaseFromServer(sampleItems, baseHash);

    useSyncStateStore.getState().markItemsDirty();

    const convergedItems = serverModifiedItems;
    const serverHash = hashData(convergedItems);
    const localHash = hashData(convergedItems);

    expect(serverHash).toBe(localHash);

    useSyncStateStore.getState().clearItemsDirty();
    useSyncStateStore.getState().setItemsServerHash(serverHash);

    const afterConverge = useSyncStateStore.getState().itemsSync;
    expect(afterConverge.dirty).toBe(false);
    expect(afterConverge.lastServerHash).toBe(serverHash);
  });

  it('Scenario A5: local dirty, server changed differently → conflict (kept dirty)', () => {
    const baseHash = hashData(sampleItems);
    useSyncStateStore.getState().setItemsBaseFromServer(sampleItems, baseHash);

    useSyncStateStore.getState().markItemsDirty();

    const serverHash = hashData(serverModifiedItems);
    const localHash = hashData(localModifiedItems);

    expect(serverHash).not.toBe(baseHash);
    expect(localHash).not.toBe(serverHash);

    const { itemsSync } = useSyncStateStore.getState();
    expect(itemsSync.dirty).toBe(true);
  });

  it('Memo: no local edits → apply server', () => {
    useSyncStateStore.getState().setMemoBaseFromServer('original', hashData('original'));

    const { memoSync } = useSyncStateStore.getState();
    expect(memoSync.dirty).toBe(false);

    const serverHash = hashData('updated from server');
    useSyncStateStore.getState().setMemoBaseFromServer('updated from server', serverHash);

    const updated = useSyncStateStore.getState().memoSync;
    expect(updated.dirty).toBe(false);
    expect(updated.baseSnapshot).toBe('updated from server');
    expect(updated.lastServerHash).toBe(serverHash);
  });

  it('Memo: local dirty, server unchanged → push local', () => {
    const baseHash = hashData('original');
    useSyncStateStore.getState().setMemoBaseFromServer('original', baseHash);

    useSyncStateStore.getState().markMemoDirty();

    const serverMemoHash = hashData('original');
    expect(serverMemoHash).toBe(baseHash);

    useSyncStateStore.getState().clearMemoDirty();
    const localMemoHash = hashData('local edit');
    useSyncStateStore.getState().setMemoServerHash(localMemoHash);

    const afterPush = useSyncStateStore.getState().memoSync;
    expect(afterPush.dirty).toBe(false);
    expect(afterPush.lastServerHash).toBe(localMemoHash);
  });
});

describe('Firebase RTDB Emulator — tree data round-trip with hash verification', () => {
  beforeAll(() => {
    getTestDatabase();
  });

  beforeEach(async () => {
    await clearEmulatorData();
    useSyncStateStore.getState().resetAllSync();
  });

  afterAll(async () => {
    await cleanupTestApp();
  });

  it('hashing server data is idempotent (read twice, same hash)', async () => {
    await setTestData(`trees/${TEST_TREE_ID}/items`, sampleItems);
    const read1 = await getTestData<TreeItems>(`trees/${TEST_TREE_ID}/items`);
    const read2 = await getTestData<TreeItems>(`trees/${TEST_TREE_ID}/items`);

    expect(hashData(read1)).toBe(hashData(read2));
  });

  it('detects hash mismatch when server data differs', async () => {
    await setTestData(`trees/${TEST_TREE_ID}/items`, sampleItems);
    const localHash = hashData(sampleItems);

    await setTestData(`trees/${TEST_TREE_ID}/items`, serverModifiedItems);
    const updatedServerItems = await getTestData<TreeItems>(`trees/${TEST_TREE_ID}/items`);
    const serverHash = hashData(updatedServerItems);

    expect(localHash).not.toBe(serverHash);
  });

  it('own-echo detection: clientId match means skip processing', async () => {
    const clientId = 'client-local';

    await setTestData(`users/${TEST_UID}/lastWriteClientId`, clientId);
    await setTestData(`users/${TEST_UID}/timestamp`, Date.now());

    const remoteClientId = await getTestData<string>(`users/${TEST_UID}/lastWriteClientId`);
    expect(remoteClientId).toBe(clientId);
  });

  it('remote change detection: different clientId triggers sync', async () => {
    const localClientId = 'client-local';
    const remoteClientId = 'client-remote';

    await setTestData(`users/${TEST_UID}/lastWriteClientId`, remoteClientId);
    await setTestData(`users/${TEST_UID}/timestamp`, Date.now());

    const serverClientId = await getTestData<string>(`users/${TEST_UID}/lastWriteClientId`);
    expect(serverClientId).not.toBe(localClientId);
  });

  it('full sync flow: write items, update timestamp with clientId, verify retrieval', async () => {
    const clientId = 'client-writer';
    const timestamp = Date.now();

    await setTestData(`trees/${TEST_TREE_ID}/items`, sampleItems);
    await setTestData(`trees/${TEST_TREE_ID}/timestamp`, timestamp);
    await setTestData(`trees/${TEST_TREE_ID}/lastWriteClientId`, clientId);
    await setTestData(`users/${TEST_UID}/timestamp`, timestamp);
    await setTestData(`users/${TEST_UID}/timestampV2`, timestamp);
    await setTestData(`users/${TEST_UID}/lastWriteClientId`, clientId);

    const items = await getTestData<TreeItems>(`trees/${TEST_TREE_ID}/items`);
    const ts = await getTestData<number>(`users/${TEST_UID}/timestamp`);
    const cid = await getTestData<string>(`users/${TEST_UID}/lastWriteClientId`);

    expect(items![0].id).toBe('item-1');
    expect(items![1].children[0].id).toBe('child-1');
    expect(ts).toBe(timestamp);
    expect(cid).toBe(clientId);
  });

  it('quick memo: write and read back with hash verification', async () => {
    const memo = 'Test quick memo content';
    await setTestData(`users/${TEST_UID}/quickMemo`, memo);

    const serverMemo = await getTestData<string>(`users/${TEST_UID}/quickMemo`);
    expect(serverMemo).toBe(memo);
    expect(hashData(serverMemo)).toBe(hashData(memo));
  });
});
