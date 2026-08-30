import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const LANGUAGE_KEY = 'app_language';

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

afterEach(() => {
  localStorage.clear();
});

describe('which language the program opens in', () => {
  it('opens in English on a first run', async () => {
    const { useCircuitStore } = await import('../circuitStore');
    expect(useCircuitStore.getState().language).toBe('en');
  });

  it('remembers Turkish once it has been picked', async () => {
    const first = await import('../circuitStore');
    first.useCircuitStore.getState().setLanguage('tr');
    expect(localStorage.getItem(LANGUAGE_KEY)).toBe('tr');

    // A fresh start reads what was stored rather than falling back.
    vi.resetModules();
    const next = await import('../circuitStore');
    expect(next.useCircuitStore.getState().language).toBe('tr');
  });

  it('remembers a switch back to English', async () => {
    localStorage.setItem(LANGUAGE_KEY, 'tr');

    const first = await import('../circuitStore');
    expect(first.useCircuitStore.getState().language).toBe('tr');
    first.useCircuitStore.getState().setLanguage('en');

    vi.resetModules();
    const next = await import('../circuitStore');
    expect(next.useCircuitStore.getState().language).toBe('en');
  });

  it('falls back to English when the stored value makes no sense', async () => {
    localStorage.setItem(LANGUAGE_KEY, 'klingon');

    const { useCircuitStore } = await import('../circuitStore');
    expect(useCircuitStore.getState().language).toBe('en');
  });
});
