/**
 * Deterministic JSON.stringify with sorted object keys at every nesting level.
 * Arrays maintain element order. Undefined values in objects are omitted.
 */
export function stableStringify(data: unknown): string {
  if (data === null) return 'null';
  if (data === undefined) return 'undefined';

  const type = typeof data;

  if (type === 'string') return JSON.stringify(data);
  if (type === 'number' || type === 'boolean') return String(data);

  if (Array.isArray(data)) {
    const items = data.map((item) => stableStringify(item));
    return '[' + items.join(',') + ']';
  }

  if (type === 'object') {
    const obj = data as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const entries = keys
      .filter((key) => obj[key] !== undefined)
      .map((key) => JSON.stringify(key) + ':' + stableStringify(obj[key]));
    return '{' + entries.join(',') + '}';
  }

  return String(data);
}

/**
 * cyrb53 — fast 53-bit hash with good distribution.
 * Returns the hash as a base-36 string.
 */
function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 16), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 16), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export function hashString(str: string): string {
  return cyrb53(str).toString(36);
}

export function hashData(data: unknown): string {
  return hashString(stableStringify(data));
}

export function getClientId(): string {
  const STORAGE_KEY = 'tasktrees_client_id';
  let clientId = sessionStorage.getItem(STORAGE_KEY);
  if (!clientId) {
    clientId = crypto.randomUUID();
    sessionStorage.setItem(STORAGE_KEY, clientId);
  }
  return clientId;
}
