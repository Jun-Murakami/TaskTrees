import { describe, it, expect, beforeEach } from 'vitest';
import { stableStringify, hashString, hashData, getClientId } from '@/utils/syncUtils';

describe('stableStringify', () => {
  it('returns "null" for null', () => {
    expect(stableStringify(null)).toBe('null');
  });

  it('returns "undefined" for undefined', () => {
    expect(stableStringify(undefined)).toBe('undefined');
  });

  it('stringifies primitives correctly', () => {
    expect(stableStringify('hello')).toBe('"hello"');
    expect(stableStringify(42)).toBe('42');
    expect(stableStringify(true)).toBe('true');
    expect(stableStringify(false)).toBe('false');
  });

  it('stringifies arrays preserving order', () => {
    expect(stableStringify([1, 2, 3])).toBe('[1,2,3]');
    expect(stableStringify(['a', 'b'])).toBe('["a","b"]');
  });

  it('stringifies objects with sorted keys', () => {
    const obj = { z: 1, a: 2, m: 3 };
    expect(stableStringify(obj)).toBe('{"a":2,"m":3,"z":1}');
  });

  it('produces identical output regardless of key insertion order', () => {
    const obj1 = { name: 'test', id: '1', value: 'hello' };
    const obj2 = { value: 'hello', name: 'test', id: '1' };
    expect(stableStringify(obj1)).toBe(stableStringify(obj2));
  });

  it('handles nested objects with sorted keys at every level', () => {
    const obj = { b: { z: 1, a: 2 }, a: { y: 3, x: 4 } };
    expect(stableStringify(obj)).toBe('{"a":{"x":4,"y":3},"b":{"a":2,"z":1}}');
  });

  it('omits undefined values in objects', () => {
    const obj = { a: 1, b: undefined, c: 3 };
    expect(stableStringify(obj)).toBe('{"a":1,"c":3}');
  });

  it('handles empty arrays and objects', () => {
    expect(stableStringify([])).toBe('[]');
    expect(stableStringify({})).toBe('{}');
  });

  it('handles TreeItem-like structures deterministically', () => {
    const item1 = {
      id: 'item-1',
      children: [{ id: 'child-1', children: [], value: 'sub', collapsed: false }],
      value: 'root',
      collapsed: true,
      done: false,
    };
    const item2 = {
      done: false,
      collapsed: true,
      value: 'root',
      id: 'item-1',
      children: [{ collapsed: false, value: 'sub', id: 'child-1', children: [] }],
    };
    expect(stableStringify(item1)).toBe(stableStringify(item2));
  });
});

describe('hashString', () => {
  it('returns a non-empty string', () => {
    const hash = hashString('test');
    expect(hash).toBeTruthy();
    expect(typeof hash).toBe('string');
  });

  it('returns consistent hash for same input', () => {
    expect(hashString('hello world')).toBe(hashString('hello world'));
  });

  it('returns different hashes for different inputs', () => {
    expect(hashString('hello')).not.toBe(hashString('world'));
  });

  it('returns base-36 encoded string', () => {
    const hash = hashString('test');
    expect(/^[0-9a-z]+$/.test(hash)).toBe(true);
  });
});

describe('hashData', () => {
  it('hashes objects deterministically regardless of key order', () => {
    const data1 = { name: 'test', id: 1 };
    const data2 = { id: 1, name: 'test' };
    expect(hashData(data1)).toBe(hashData(data2));
  });

  it('produces different hashes for different data', () => {
    expect(hashData({ a: 1 })).not.toBe(hashData({ a: 2 }));
  });

  it('produces different hashes for structurally different data', () => {
    expect(hashData([1, 2, 3])).not.toBe(hashData([1, 2, 4]));
  });

  it('handles nested tree items', () => {
    const items = [
      { id: '1', children: [{ id: '2', children: [], value: 'child' }], value: 'parent' },
    ];
    const hash = hashData(items);
    expect(hash).toBeTruthy();
    expect(hashData(items)).toBe(hash);
  });
});

describe('getClientId', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('generates a UUID and stores it in localStorage', () => {
    const clientId = getClientId();
    expect(clientId).toBeTruthy();
    expect(localStorage.getItem('tasktrees_client_id')).toBe(clientId);
  });

  it('returns the same ID on subsequent calls', () => {
    const first = getClientId();
    const second = getClientId();
    expect(first).toBe(second);
  });

  it('generates a new ID after localStorage is cleared', () => {
    const first = getClientId();
    localStorage.clear();
    const second = getClientId();
    expect(first).not.toBe(second);
  });
});
