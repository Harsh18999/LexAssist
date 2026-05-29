/**
 * Lightweight TTL-based in-memory cache for API responses.
 *
 * Usage:
 *   cache.set("dashboard", data, 60_000);     // store for 60s
 *   cache.get("dashboard");                    // returns data or null
 *   cache.invalidate("dashboard");             // remove one key
 *   cache.invalidatePrefix("cases");           // remove all keys starting with "cases"
 */

const _store = new Map();

const cache = {
  get(key) {
    const entry = _store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      _store.delete(key);
      return null;
    }
    return entry.data;
  },

  set(key, data, ttlMs = 30_000) {
    _store.set(key, { data, expiresAt: Date.now() + ttlMs });
  },

  invalidate(key) {
    _store.delete(key);
  },

  invalidatePrefix(prefix) {
    for (const key of _store.keys()) {
      if (key.startsWith(prefix)) _store.delete(key);
    }
  },

  clear() {
    _store.clear();
  },
};

export default cache;
