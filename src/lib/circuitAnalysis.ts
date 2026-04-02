import {
  ARDUINO_COMPONENT_ID,
  DEFAULT_CONTROLLER_BOARD_POSITION,
  findArduinoPin,
  type ControllerBoardType,
} from '../models/arduinoUno';
import {
  BREADBOARD_COMPONENT_ID,
  DEFAULT_BREADBOARD_POSITION,
  getBreadboardHoleGlobal,
  isBreadboardReference,
} from '../models/breadboard';
import {
  createComponent,
  type CircuitComponent,
  type Wire,
} from '../models/types';
import { getComponentPinWorldPosition, snapToBreadboard } from './canvasSnap';
import type {
  LessonEndpointRef,
  LessonFocusTarget,
  LessonProjectSeed,
} from '../education/types';
import { LESSON_REF_PROPERTY } from '../education/types';

export type ResolvedCircuitEndpoint = {
  componentId: string;
  pinId: string;
  x: number;
  y: number;
};

export type CircuitBuildResult = {
  components: CircuitComponent[];
  wires: Wire[];
  code: string;
  boardType: ControllerBoardType;
  boardPosition: { x: number; y: number };
  breadboardPosition: { x: number; y: number };
};

export const normalizeReferenceToken = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0131/g, 'i')
    .replace(/[^a-z0-9_-]/g, '');

export const getComponentLessonRef = (component: CircuitComponent): string | null => {
  const rawValue = component.properties[LESSON_REF_PROPERTY];
  return typeof rawValue === 'string' && rawValue.trim()
    ? rawValue.trim()
    : null;
};

export const findComponentByLessonRef = (
  components: CircuitComponent[],
  ref: string
): CircuitComponent | null => {
  const normalizedRef = normalizeReferenceToken(ref);
  if (!normalizedRef) return null;

  return (
    components.find((component) => {
      const lessonRef = getComponentLessonRef(component);
      return lessonRef
        ? normalizeReferenceToken(lessonRef) === normalizedRef
        : false;
    }) ?? null
  );
};

export const findComponentsByType = (
  components: CircuitComponent[],
  type: CircuitComponent['type']
) => components.filter((component) => component.type === type);

export const normalizeBoardPinId = (
  pinId: string,
  boardType: ControllerBoardType
) => findArduinoPin(pinId, boardType)?.id ?? pinId;

export const resolveLessonEndpoint = (
  endpoint: LessonEndpointRef,
  components: CircuitComponent[],
  boardType: ControllerBoardType,
  boardPosition = DEFAULT_CONTROLLER_BOARD_POSITION,
  breadboardPosition = DEFAULT_BREADBOARD_POSITION
): ResolvedCircuitEndpoint | null => {
  if (
    endpoint.component === 'arduino' ||
    normalizeReferenceToken(endpoint.component) ===
      normalizeReferenceToken(ARDUINO_COMPONENT_ID)
  ) {
    const pin = findArduinoPin(endpoint.pin, boardType);
    if (!pin) return null;

    return {
      componentId: ARDUINO_COMPONENT_ID,
      pinId: pin.id,
      x: boardPosition.x + pin.x,
      y: boardPosition.y + pin.y,
    };
  }

  if (
    endpoint.component === 'breadboard' ||
    isBreadboardReference(endpoint.component)
  ) {
    const hole = getBreadboardHoleGlobal(endpoint.pin, breadboardPosition);
    if (!hole) return null;

    return {
      componentId: BREADBOARD_COMPONENT_ID,
      pinId: hole.id,
      x: hole.x,
      y: hole.y,
    };
  }

  const component = findComponentByLessonRef(components, endpoint.component);
  if (!component) return null;

  const pinPosition = getComponentPinWorldPosition(component, endpoint.pin);
  if (!pinPosition) return null;

  return {
    componentId: component.id,
    pinId: pinPosition.pin.id,
    x: pinPosition.x,
    y: pinPosition.y,
  };
};

export const toLessonFocusTarget = (
  endpoint: LessonEndpointRef,
  components: CircuitComponent[],
  boardType: ControllerBoardType
): LessonFocusTarget | undefined => {
  if (endpoint.component === 'arduino') {
    return {
      kind: 'board-pin',
      pinId: normalizeBoardPinId(endpoint.pin, boardType),
    };
  }

  const component = findComponentByLessonRef(components, endpoint.component);
  if (!component) return undefined;

  const pin = component.pins.find(
    (item) => normalizeReferenceToken(item.id) === normalizeReferenceToken(endpoint.pin)
  );

  if (!pin) {
    return {
      kind: 'component',
      componentId: component.id,
    };
  }

  return {
    kind: 'component-pin',
    componentId: component.id,
    pinId: pin.id,
  };
};

export const wireConnectsEndpoints = (
  wire: Wire,
  start: ResolvedCircuitEndpoint,
  end: ResolvedCircuitEndpoint
) =>
  (wire.startComponentId === start.componentId &&
    wire.startPinId === start.pinId &&
    wire.endComponentId === end.componentId &&
    wire.endPinId === end.pinId) ||
  (wire.startComponentId === end.componentId &&
    wire.startPinId === end.pinId &&
    wire.endComponentId === start.componentId &&
    wire.endPinId === start.pinId);

export const wireTouchesEndpoint = (
  wire: Wire,
  endpoint: ResolvedCircuitEndpoint
) =>
  (wire.startComponentId === endpoint.componentId &&
    wire.startPinId === endpoint.pinId) ||
  (wire.endComponentId === endpoint.componentId &&
    wire.endPinId === endpoint.pinId);

export const buildLessonProjectData = (
  project: LessonProjectSeed,
  options?: {
    boardPosition?: { x: number; y: number };
    breadboardPosition?: { x: number; y: number };
  }
): CircuitBuildResult => {
  const boardPosition = {
    ...DEFAULT_CONTROLLER_BOARD_POSITION,
    ...options?.boardPosition,
  };
  const breadboardPosition = {
    ...DEFAULT_BREADBOARD_POSITION,
    ...options?.breadboardPosition,
  };
  const refs = new Map<string, string>();
  const components = project.components.map((seed) => {
    const snapped = snapToBreadboard(
      seed.x,
      seed.y,
      seed.type,
      undefined,
      breadboardPosition,
      seed.rotation ?? 0
    );
    const component = createComponent(seed.type, snapped.x, snapped.y);
    component.rotation = seed.rotation ?? 0;
    component.properties = {
      ...component.properties,
      ...seed.properties,
      [LESSON_REF_PROPERTY]: seed.ref,
    };
    refs.set(seed.ref, component.id);
    return component;
  });

  const wires = project.wires.flatMap((seed, index) => {
    const start = resolveLessonEndpoint(
      seed.from,
      components,
      project.boardType,
      boardPosition,
      breadboardPosition
    );
    const end = resolveLessonEndpoint(
      seed.to,
      components,
      project.boardType,
      boardPosition,
      breadboardPosition
    );
    if (!start || !end) return [];

    return [
      {
        id: `lesson-wire-${index}`,
        startComponentId: start.componentId,
        startPinId: start.pinId,
        endComponentId: end.componentId,
        endPinId: end.pinId,
        color: seed.color || '#e74c3c',
        points: [start.x, start.y, end.x, end.y],
      } satisfies Wire,
    ];
  });

  return {
    components,
    wires,
    code: project.code,
    boardType: project.boardType,
    boardPosition,
    breadboardPosition,
  };
};
