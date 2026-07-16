type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type CacheStore = Map<string, CacheEntry<unknown>>;

declare global {
  // eslint-disable-next-line no-var
  var __driverWebMemoryCache: CacheStore | undefined;
}

function getStore() {
  if (!globalThis.__driverWebMemoryCache) {
    globalThis.__driverWebMemoryCache = new Map();
  }
  return globalThis.__driverWebMemoryCache;
}

export async function getOrSetMemoryCache<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const store = getStore();
  const cached = store.get(key) as CacheEntry<T> | undefined;
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }
  const value = await loader();
  store.set(key, {
    value,
    expiresAt: now + ttlMs
  });
  return value;
}
