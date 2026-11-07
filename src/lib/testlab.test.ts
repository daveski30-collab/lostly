import { expect, it, vi } from 'vitest';

// Simple in-memory stand-in for phone storage.
vi.mock('@react-native-async-storage/async-storage', () => {
  const m = new Map<string, string>();
  return {
    default: {
      getItem: async (k: string) => m.get(k) ?? null,
      setItem: async (k: string, v: string) => void m.set(k, v),
      multiRemove: async (ks: string[]) => ks.forEach((k) => m.delete(k)),
    },
  };
});

it('every Test Lab scenario passes and the test spot is cleaned up', async () => {
  const { runAll } = await import('./testlab');
  const { getPlaces, getHistory } = await import('./store');
  const results = await runAll();
  for (const r of results) expect(r, `${r.name}: ${r.got}`).toMatchObject({ pass: true });
  expect(results).toHaveLength(9);
  expect(await getPlaces()).toEqual([]);
  expect(await getHistory()).toEqual([]);
});
