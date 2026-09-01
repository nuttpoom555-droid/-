// Real, reliable persistence for the standalone site — plain localStorage.
// No 5MB-per-key platform bug, no sandbox weirdness. Kept as small async
// wrapper functions so the rest of the app reads the same as it did before.

const PREFIX = "gold-melt:";

export const storage = {
  async get(key) {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return null;
    return { key, value: raw };
  },
  async set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, value);
      return { key, value };
    } catch (e) {
      // Quota exceeded or storage disabled (e.g. Safari private mode)
      return null;
    }
  },
  async delete(key) {
    localStorage.removeItem(PREFIX + key);
    return { key, deleted: true };
  },
};
