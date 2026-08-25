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

describe('multi selection', () => {
  it('adds and drops parts as Ctrl is held', () => {
    const first = addLed();
    const second = addLed();

    store().selectComponent(first.id);
    expect(store().selectedComponentIds).toEqual([first.id]);

    store().toggleComponentSelection(second.id);
    expect(store().selectedComponentIds).toEqual([first.id, second.id]);
    // The last one picked is the one the properties panel shows.
    expect(store().selectedComponentId).toBe(second.id);

    store().toggleComponentSelection(second.id);
    expect(store().selectedComponentIds).toEqual([first.id]);
    expect(store().selectedComponentId).toBe(first.id);

    store().toggleComponentSelection(first.id);
    expect(store().selectedComponentIds).toEqual([]);
    expect(store().selectedComponentId).toBeNull();
  });

  it('ignores a part that is not on the canvas', () => {
    const led = addLed();
    store().selectComponent(led.id);

    store().toggleComponentSelection('does-not-exist');

    expect(store().selectedComponentIds).toEqual([led.id]);
  });

  it('drops a removed part from the selection', () => {
    const first = addLed();
    const second = addLed();
    store().selectComponent(first.id);
    store().toggleComponentSelection(second.id);

    store().removeComponent(first.id);

    expect(store().selectedComponentIds).toEqual([second.id]);
  });

  it('starts over when one part is selected on its own', () => {
    const first = addLed();
    const second = addLed();
    store().selectComponent(first.id);
    store().toggleComponentSelection(second.id);

    store().selectComponent(second.id);

    expect(store().selectedComponentIds).toEqual([second.id]);
  });
});

describe('selection', () => {
  it('selecting a component already clears any selected wire', () => {
    const led = addLed();
    useCircuitStore.setState({ selectedWireId: 'w1' });

    store().selectComponent(led.id);

    expect(store().selectedComponentId).toBe(led.id);
    expect(store().selectedWireId).toBeNull();
  });

  /**
   * Clearing one selection clears the other, so calling both in a row throws
   * away the selection that was just made. Every canvas click did that once.
   */
  it('clearing the wire selection also clears the component', () => {
    const led = addLed();
    store().selectComponent(led.id);

    store().selectWire(null);

    expect(store().selectedComponentId).toBeNull();
  });
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
