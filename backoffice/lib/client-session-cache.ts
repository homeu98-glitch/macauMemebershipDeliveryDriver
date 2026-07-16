const pendingJsonRequests = new Map<string, Promise<unknown>>();

type SessionCacheEnvelope<T> = {
  expiresAt: number;
  data: T;
};

export function readSessionCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionCacheEnvelope<T>;
    if (!parsed || parsed.expiresAt <= Date.now()) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeSessionCache<T>(key: string, data: T, ttlMs: number) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      key,
      JSON.stringify({
        data,
        expiresAt: Date.now() + ttlMs
      } satisfies SessionCacheEnvelope<T>)
    );
  } catch {
    // ignore storage errors
  }
}

export async function fetchJsonWithSessionCache<T>(key: string, url: string, ttlMs: number, init?: RequestInit): Promise<T> {
  const cached = readSessionCache<T>(key);
  if (cached !== null) return cached;

  const pendingKey = `${key}:${url}`;
  const existing = pendingJsonRequests.get(pendingKey) as Promise<T> | undefined;
  if (existing) return existing;

  const nextRequest = fetch(url, init)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`fetch_failed:${response.status}`);
      }
      const payload = (await response.json()) as T;
      writeSessionCache(key, payload, ttlMs);
      return payload;
    })
    .finally(() => {
      pendingJsonRequests.delete(pendingKey);
    });

  pendingJsonRequests.set(pendingKey, nextRequest);
  return nextRequest;
}
