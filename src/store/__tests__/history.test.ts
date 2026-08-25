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

describe('copy and paste', () => {
  it('copies the selected parts and drops them beside the originals', () => {
    const first = addLed();
    const second = addLed();
    store().selectComponent(first.id);
    store().toggleComponentSelection(second.id);

    expect(store().copySelection()).toBe(2);
    expect(store().canPaste()).toBe(true);
    expect(store().pasteClipboard()).toBe(2);

    expect(store().components).toHaveLength(4);
    const pasted = store().components.slice(2);
    expect(pasted.map((component) => component.id)).not.toContain(first.id);
    expect(pasted[0].x).toBe(first.x + 24);
    expect(pasted[0].y).toBe(first.y + 24);

    // The copy is what you end up holding, ready to be moved.
    expect(store().selectedComponentIds).toEqual(pasted.map((component) => component.id));
  });

  it('steps each further paste away from the last', () => {
    const led = addLed();
    store().selectComponent(led.id);
    store().copySelection();

    store().pasteClipboard();
    store().pasteClipboard();

    const [, first, second] = store().components;
    expect(first.x).toBe(led.x + 24);
    expect(second.x).toBe(led.x + 48);
  });

  it('brings along wires that sit entirely inside the selection', () => {
    const first = addLed();
    const second = addLed();
    store().addWire({
      startComponentId: first.id,
      startPinId: 'anode',
      endComponentId: second.id,
      endPinId: 'cathode',
      color: '#e74c3c',
      points: [0, 0, 10, 10],
    });

    store().selectComponent(first.id);
    store().toggleComponentSelection(second.id);
    store().copySelection();
    store().pasteClipboard();

    expect(store().wires).toHaveLength(2);
    const copied = store().wires[1];
    const pasted = store().components.slice(2).map((component) => component.id);
    expect(pasted).toContain(copied.startComponentId);
    expect(pasted).toContain(copied.endComponentId);
  });

  it('leaves a wire behind when only one of its ends was copied', () => {
    const first = addLed();
    const second = addLed();
    store().addWire({
      startComponentId: first.id,
      startPinId: 'anode',
      endComponentId: second.id,
      endPinId: 'cathode',
      color: '#e74c3c',
      points: [0, 0, 10, 10],
    });

    store().selectComponent(first.id);
    store().copySelection();
    store().pasteClipboard();

    expect(store().wires).toHaveLength(1);
  });

  it('keeps the clipboard when a copy is asked for with nothing selected', () => {
    const led = addLed();
    store().selectComponent(led.id);
    store().copySelection();

    store().selectComponent(null);
    expect(store().copySelection()).toBe(0);

    // What was copied earlier is still there to paste.
    expect(store().canPaste()).toBe(true);
    expect(store().pasteClipboard()).toBe(1);
  });

  it('can be undone in one step', () => {
    const led = addLed();
    store().selectComponent(led.id);
    store().copySelection();
    store().pasteClipboard();
    expect(store().components).toHaveLength(2);

    store().undo();
    expect(store().components).toHaveLength(1);
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
