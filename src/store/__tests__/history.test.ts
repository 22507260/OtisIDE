import { beforeEach, describe, expect, it } from 'vitest';
import { useCircuitStore } from '../circuitStore';

/**
 * The undo trail lives in a closure inside the store, so these tests never
 * measure its depth. They add a component, edit it, and check what comes back.
 */
const store = () => useCircuitStore.getState();

const addLed = () => {
  store().addComponent('led', 100, 120);
  const components = store().components;
  return components[components.length - 1];
};

const rotationOf = (id: string) =>
  store().components.find((component) => component.id === id)?.rotation;

beforeEach(() => {
  useCircuitStore.setState({ components: [], wires: [] });
});

describe('undo and redo', () => {
  it('takes back the last edit and puts it forward again', () => {
    const led = addLed();

    store().updateComponent(led.id, { rotation: 90 });
    expect(rotationOf(led.id)).toBe(90);

    store().undo();
    expect(rotationOf(led.id)).toBe(0);
    expect(store().canRedo()).toBe(true);

    store().redo();
    expect(rotationOf(led.id)).toBe(90);
  });

  it('treats a run of silent updates as one step', () => {
    const led = addLed();

    // What the properties panel does: one snapshot on focus, then a value that
    // changes with every keystroke.
    store().captureUndoSnapshot();
    store().updateComponent(led.id, { rotation: 1 }, { recordHistory: false });
    store().updateComponent(led.id, { rotation: 18 }, { recordHistory: false });
    store().updateComponent(led.id, { rotation: 180 }, { recordHistory: false });
    expect(rotationOf(led.id)).toBe(180);

    store().undo();
    expect(rotationOf(led.id)).toBe(0);
  });

  it('drops the redo trail once something new is edited', () => {
    const led = addLed();

    store().updateComponent(led.id, { rotation: 90 });
    store().undo();
    expect(store().canRedo()).toBe(true);

    store().updateComponent(led.id, { rotation: 270 });
    expect(store().canRedo()).toBe(false);

    store().undo();
    expect(rotationOf(led.id)).toBe(0);
  });

  it('keeps the component itself when a property is undone', () => {
    const led = addLed();

    store().updateComponentProperty(led.id, 'color', 'blue');
    expect(store().components.find((c) => c.id === led.id)?.properties.color).toBe('blue');

    store().undo();
    expect(store().components.find((c) => c.id === led.id)?.properties.color).toBe('red');
    expect(store().components).toHaveLength(1);
  });
});
