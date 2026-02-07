import { initializeApp, deleteApp, FirebaseApp, getApps } from 'firebase/app';
import { getDatabase, connectDatabaseEmulator, ref, set, get, Database } from 'firebase/database';

const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 9000;
const TEST_PROJECT_ID = 'tasktrees-test';

let testApp: FirebaseApp | null = null;
let testDb: Database | null = null;

export function getTestApp(): FirebaseApp {
  if (testApp) return testApp;

  const existing = getApps().find((app) => app.name === 'test');
  if (existing) {
    testApp = existing;
    return testApp;
  }

  testApp = initializeApp(
    {
      projectId: TEST_PROJECT_ID,
      databaseURL: `http://${EMULATOR_HOST}:${EMULATOR_PORT}?ns=${TEST_PROJECT_ID}-default-rtdb`,
    },
    'test',
  );
  return testApp;
}

export function getTestDatabase(): Database {
  if (testDb) return testDb;

  const app = getTestApp();
  testDb = getDatabase(app);
  connectDatabaseEmulator(testDb, EMULATOR_HOST, EMULATOR_PORT);
  return testDb;
}

export async function clearEmulatorData(): Promise<void> {
  const ns = `${TEST_PROJECT_ID}-default-rtdb`;
  const url = `http://${EMULATOR_HOST}:${EMULATOR_PORT}/.json?ns=${ns}`;
  await fetch(url, {
    method: 'DELETE',
  });
}

export async function setTestData(path: string, data: unknown): Promise<void> {
  const db = getTestDatabase();
  const dataRef = ref(db, path);
  await set(dataRef, data);
}

export async function getTestData<T = unknown>(path: string): Promise<T | null> {
  const db = getTestDatabase();
  const dataRef = ref(db, path);
  const snapshot = await get(dataRef);
  return snapshot.exists() ? (snapshot.val() as T) : null;
}

export async function cleanupTestApp(): Promise<void> {
  if (testApp) {
    await deleteApp(testApp);
    testApp = null;
    testDb = null;
  }
}
