/**
 * Where a component's pins end up once it has been mirrored, resized and turned.
 *
 * The canvas hands rotation and scale to Konva, which applies them to everything
 * drawn inside the component's group. Anything living in world coordinates —
 * wire ends, breadboard snapping, probe anchors — has to do the same arithmetic
 * itself, and this is the one place that arithmetic lives.
 */

export type ComponentTransform = {
  rotation?: number;
  scale?: number;
  flipX?: boolean;
};

/** Smallest and largest a component may be drawn, relative to its artwork. */
export const MIN_COMPONENT_SCALE = 0.4;
export const MAX_COMPONENT_SCALE = 3;

export function normalizeRotation(rotation: number): number {
  return ((rotation % 360) + 360) % 360;
}

export function clampComponentScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(MAX_COMPONENT_SCALE, Math.max(MIN_COMPONENT_SCALE, scale));
}

export function getComponentTransform(component: {
  rotation?: number;
  scale?: number;
  flipX?: boolean;
}): ComponentTransform {
  return {
    rotation: component.rotation ?? 0,
    scale: component.scale ?? 1,
    flipX: component.flipX === true,
  };
}

/** Negating a zero coordinate yields -0, which reads badly everywhere it lands. */
const withoutNegativeZero = (value: number): number => (value === 0 ? 0 : value);

/**
 * Mirror first, then scale, then turn — the order Konva composes a node's own
 * transform, so a pin computed here lands exactly where the canvas draws it.
 */
export function transformPoint(
  x: number,
  y: number,
  transform?: ComponentTransform
): { x: number; y: number } {
  const scale = clampComponentScale(transform?.scale ?? 1);
  const mirroredX = transform?.flipX ? -x : x;
  const scaledX = withoutNegativeZero(mirroredX * scale);
  const scaledY = withoutNegativeZero(y * scale);

  const normalized = normalizeRotation(transform?.rotation ?? 0);
  const snappedRightAngle = (Math.round(normalized / 90) * 90) % 360;

  // Right angles are the common case and exact, so keep them free of the
  // rounding error trigonometry would introduce.
  if (Math.abs(normalized - snappedRightAngle) < 0.001) {
    switch (snappedRightAngle) {
      case 90:
        return { x: withoutNegativeZero(-scaledY), y: scaledX };
      case 180:
        return { x: withoutNegativeZero(-scaledX), y: withoutNegativeZero(-scaledY) };
      case 270:
        return { x: scaledY, y: withoutNegativeZero(-scaledX) };
      default:
        return { x: scaledX, y: scaledY };
    }
  }

  const radians = (normalized * Math.PI) / 180;
  const rotatedX = scaledX * Math.cos(radians) - scaledY * Math.sin(radians);
  const rotatedY = scaledX * Math.sin(radians) + scaledY * Math.cos(radians);

  return {
    x: Math.round(rotatedX * 1000) / 1000,
    y: Math.round(rotatedY * 1000) / 1000,
  };
}

export function getTransformedPins<T extends { x: number; y: number }>(
  pins: T[],
  transform?: ComponentTransform
): T[] {
  const rotation = normalizeRotation(transform?.rotation ?? 0);
  const scale = clampComponentScale(transform?.scale ?? 1);

  if (pins.length === 0 || (rotation === 0 && scale === 1 && !transform?.flipX)) {
    return pins;
  }

  return pins.map((pin) => {
    const moved = transformPoint(pin.x, pin.y, transform);
    return { ...pin, x: moved.x, y: moved.y };
  });
}

/**
 * Left edge of a part's artwork relative to its anchor. Mirroring flips the
 * drawing about the anchor, so a part whose anchor is not in the middle — the
 * RC522 and the keypad, for instance — moves to the other side of it. Anything
 * framing the artwork has to start from here rather than scaling itself by -1,
 * because a node's own scale does not act on its position.
 */
export function getArtworkLeft(
  config: { width: number; offsetX: number },
  flipX?: boolean
): number {
  return flipX ? config.offsetX - config.width : -config.offsetX;
}

/** Only the mirror, for pins that Konva will still rotate and scale itself. */
export function getMirroredPins<T extends { x: number; y: number }>(
  pins: T[],
  flipX?: boolean
): T[] {
  if (!flipX || pins.length === 0) return pins;
  return pins.map((pin) => ({ ...pin, x: -pin.x }));
}
