/**
 * localStorage wrappers that never throw.
 *
 * Writes fail for reasons the app cannot control — a full quota once the AI
 * history grows, or storage being disabled altogether — and an exception thrown
 * from inside a store action takes the UI down with it.
 */

export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Returns false when the value could not be stored. */
export function writeStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to do: the key is unreachable either way.
  }
}
