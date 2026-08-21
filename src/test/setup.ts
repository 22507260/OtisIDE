/**
 * The simulation runtime schedules itself through `window.setTimeout` because it
 * runs in the renderer. Tests exercise it in Node, where the timers exist on the
 * global object instead.
 */
const globalWithWindow = globalThis as { window?: unknown };

if (!globalWithWindow.window) {
  globalWithWindow.window = globalThis;
}

/**
 * The store keeps settings, the AI history and the working circuit in
 * localStorage. Its wrappers swallow the missing global, so tests would silently
 * exercise the "storage is unavailable" path without this.
 */
const globalWithStorage = globalThis as { localStorage?: Storage };

if (!globalWithStorage.localStorage) {
  const entries = new Map<string, string>();

  globalWithStorage.localStorage = {
    get length() {
      return entries.size;
    },
    key: (index: number) => [...entries.keys()][index] ?? null,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, String(value));
    },
    removeItem: (key: string) => {
      entries.delete(key);
    },
    clear: () => {
      entries.clear();
    },
  } as Storage;
}
