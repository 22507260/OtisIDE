import { describe, expect, it } from 'vitest';
import { SVG_CONFIGS } from '../componentGeometry';
import {
  COMPONENT_CATALOG,
  CONNECTOR_ORDERS,
  getDefaultPins,
  type ComponentType,
} from '../types';

/**
 * Pins are placed on the connectors an SVG declares. A part that defines more
 * pins than its artwork has connectors gets no layout at all and its pins end up
 * floating off the drawing, which is how the RFM69HCW module shipped broken.
 */
const countConnectors = (raw: string) =>
  new Set(
    Array.from(raw.matchAll(/id="connector(\d+)pin"/g)).map((match) => match[1])
  ).size;

/** The highest connector number the artwork marks, which is not the count when
 * the drawing skips a number. */
const highestConnector = (raw: string) =>
  Math.max(
    -1,
    ...Array.from(raw.matchAll(/id="connector(\d+)pin"/g)).map((match) => Number(match[1]))
  );

/**
 * Parts whose artwork really does mark fewer pads than the module has. Their
 * connector order carries -1 for the unmarked pads, so the count is expected to
 * fall short by exactly that much.
 */
const UNMARKED_PADS: Partial<Record<ComponentType, number>> = {
  // The bottom of the right hand column is labelled GND but has no connector.
  rfm69hcw: 1,
};

const catalogTypes = COMPONENT_CATALOG.map((item) => item.type);

describe('component pin definitions', () => {
  it('covers every catalog entry with artwork', () => {
    for (const type of catalogTypes) {
      expect(SVG_CONFIGS[type], `${type} has no SVG config`).toBeTruthy();
    }
  });

  it.each(catalogTypes)('%s has a connector for every pin', (type: ComponentType) => {
    const pins = getDefaultPins(type);
    const connectors = countConnectors(SVG_CONFIGS[type].raw);

    // Artwork without connectors falls back to hand written coordinates, which
    // is a deliberate choice for a few parts; having too few is always a bug.
    if (connectors === 0) return;

    const unmarked = UNMARKED_PADS[type] ?? 0;
    expect(
      connectors + unmarked,
      `${type} defines ${pins.length} pins but its SVG only has ${connectors} connectors`
    ).toBeGreaterThanOrEqual(pins.length);
  });

  it.each(catalogTypes)('%s gives every pin a distinct id', (type: ComponentType) => {
    const ids = getDefaultPins(type).map((pin) => pin.id);
    expect(new Set(ids).size, `${type} repeats a pin id`).toBe(ids.length);
  });

  it('keeps the unmarked pad list honest', () => {
    for (const [type, unmarked] of Object.entries(UNMARKED_PADS)) {
      const connectors = countConnectors(SVG_CONFIGS[type as ComponentType].raw);
      const pins = getDefaultPins(type as ComponentType);
      expect(
        pins.length - connectors,
        `${type} no longer misses ${unmarked} connector(s); update UNMARKED_PADS`
      ).toBe(unmarked);
    }
  });

  describe('connector orders', () => {
    const overrides = Object.entries(CONNECTOR_ORDERS) as Array<[ComponentType, number[]]>;

    it('only lists parts in the catalog', () => {
      for (const [type] of overrides) {
        expect(catalogTypes, `${type} is not in the catalog`).toContain(type);
      }
    });

    it.each(overrides)('%s maps one connector per pin', (type, order) => {
      const pins = getDefaultPins(type);
      expect(order, `${type} lists ${order.length} connectors for ${pins.length} pins`).toHaveLength(
        pins.length
      );

      const marked = order.filter((index) => index >= 0);
      expect(new Set(marked).size, `${type} sends two pins to one connector`).toBe(marked.length);

      const highest = highestConnector(SVG_CONFIGS[type].raw);
      for (const index of marked) {
        expect(index, `${type} points at connector${index}, which the artwork does not draw`)
          .toBeLessThanOrEqual(highest);
      }
    });
  });
});
