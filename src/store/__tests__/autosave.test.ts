import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const DRAFT_KEY = 'project_draft';

const draft = {
  components: [
    {
      id: 'led-1',
      type: 'led',
      x: 240,
      y: 160,
      rotation: 90,
      pins: [],
      properties: { color: 'blue' },
    },
  ],
  wires: [],
  code: 'void setup() {}\nvoid loop() {}\n',
  boardType: 'arduino-uno',
  boardPosition: { x: 12, y: 34 },
  breadboardPosition: { x: 56, y: 78 },
};

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

afterEach(() => {
  localStorage.clear();
});

describe('project autosave', () => {
  it('starts from the circuit the last session left behind', async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));

    const { useCircuitStore } = await import('../circuitStore');
    const state = useCircuitStore.getState();

    expect(state.components).toHaveLength(1);
    expect(state.components[0].type).toBe('led');
    expect(state.components[0].rotation).toBe(90);
    expect(state.code).toBe(draft.code);
    expect(state.boardPosition).toEqual({ x: 12, y: 34 });
  });

  it('starts empty when the stored draft is unreadable', async () => {
    localStorage.setItem(DRAFT_KEY, '{ not json');

    const { useCircuitStore } = await import('../circuitStore');
    expect(useCircuitStore.getState().components).toEqual([]);
  });

  it('writes the circuit back once it settles', async () => {
    const { useCircuitStore } = await import('../circuitStore');
    useCircuitStore.getState().addComponent('resistor', 100, 100);

    expect(localStorage.getItem(DRAFT_KEY), 'saved before settling').toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 1200));

    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null');
    expect(saved.components).toHaveLength(1);
    expect(saved.components[0].type).toBe('resistor');
  });

  it('saves a cleared circuit too, so clearing is not undone by a restart', async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));

    const { useCircuitStore } = await import('../circuitStore');
    expect(useCircuitStore.getState().components).toHaveLength(1);

    useCircuitStore.getState().clearProject();
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null');
    expect(saved.components).toEqual([]);
  });
});
