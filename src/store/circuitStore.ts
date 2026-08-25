import { create } from 'zustand';
import {
  CircuitComponent,
  OscilloscopeSample,
  Wire,
  ToolMode,
  RightTab,
  SimulationState,
  AIMessage,
  AIConversation,
  AIProvider,
  DEFAULT_AI_PROVIDER,
  createComponent,
  ComponentType,
  WIRE_COLORS,
} from '../models/types';
import {
  type AppLanguage,
  getDefaultConversationTitle,
} from '../lib/i18n';
import {
  DEFAULT_CONTROLLER_BOARD_TYPE,
  DEFAULT_CONTROLLER_BOARD_POSITION,
  type ControllerBoardType,
  getControllerBoardDefinition,
  getControllerBoardPins,
} from '../models/arduinoUno';
import { DEFAULT_BREADBOARD_POSITION } from '../models/breadboard';
import { sanitizeProjectData, type ProjectData } from '../lib/projectFile';
import { readStorage, removeStorage, writeStorage } from '../lib/storage';
import { v4 as uuidv4 } from 'uuid';
import { startMockArduinoRuntime, stopMockArduinoRuntime } from '../lib/mockArduinoRuntime';

interface CircuitStore {
  // Components
  components: CircuitComponent[];
  selectedComponentId: string | null;
  /** Every selected part, with the primary one last. Holding Ctrl adds to it. */
  selectedComponentIds: string[];

  // Wires
  wires: Wire[];
  selectedWireId: string | null;
  wireColor: string;

  // Tool
  toolMode: ToolMode;
  setToolMode: (mode: ToolMode) => void;

  // UI
  rightTab: RightTab;
  setRightTab: (tab: RightTab) => void;
  bottomPanelCollapsed: boolean;
  toggleBottomPanel: () => void;
  bottomTab: 'code' | 'serial' | 'device' | 'oscilloscope';
  setBottomTab: (tab: 'code' | 'serial' | 'device' | 'oscilloscope') => void;
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;

  // Canvas
  zoom: number;
  stagePos: { x: number; y: number };
  setZoom: (z: number) => void;
  setStagePos: (pos: { x: number; y: number }) => void;
  boardType: ControllerBoardType;
  setBoardType: (boardType: ControllerBoardType) => void;
  boardPosition: { x: number; y: number };
  setBoardPosition: (pos: { x: number; y: number }) => void;
  breadboardPosition: { x: number; y: number };
  setBreadboardPosition: (pos: { x: number; y: number }) => void;
  captureUndoSnapshot: () => void;

  // Component actions
  addComponent: (type: ComponentType, x: number, y: number) => void;
  removeComponent: (id: string) => void;
  updateComponent: (
    id: string,
    updates: Partial<CircuitComponent>,
    options?: { recordHistory?: boolean }
  ) => void;
  selectComponent: (id: string | null) => void;
  /** Ctrl+click: adds the part to the selection, or drops it if it was in it. */
  toggleComponentSelection: (id: string) => void;
  selectComponents: (ids: string[]) => void;
  updateComponentProperty: (
    id: string,
    key: string,
    value: string | number | boolean,
    options?: { recordHistory?: boolean }
  ) => void;

  // Wire actions
  addWire: (wire: Omit<Wire, 'id'>) => void;
  removeWire: (id: string) => void;
  updateWirePoints: (id: string, points: number[]) => void;
  /** Unplug one end of a wire and plug it into another pin. */
  updateWireEndpoint: (
    id: string,
    end: 'start' | 'end',
    componentId: string,
    pinId: string,
    position: { x: number; y: number }
  ) => void;
  setWireColorById: (id: string, color: string) => void;
  selectWire: (id: string | null) => void;
  setWireColor: (color: string) => void;

  // Simulation
  simulation: SimulationState;
  startSimulation: () => void;
  stopSimulation: () => void;
  updateLedState: (componentId: string, on: boolean, brightness: number) => void;
  addSerialOutput: (text: string) => void;
  clearSerialOutput: () => void;
  addOscilloscopeSample: (componentId: string, sample: OscilloscopeSample) => void;
  clearOscilloscopeTraces: () => void;

  // Code
  code: string;
  setCode: (code: string) => void;
  undo: () => void;
  canUndo: () => boolean;
  redo: () => void;
  canRedo: () => boolean;

  // AI
  aiConversations: AIConversation[];
  currentAIConversationId: string | null;
  aiLoading: boolean;
  createAIConversation: (title?: string) => string;
  selectAIConversation: (id: string | null) => void;
  deleteAIConversation: (id: string) => void;
  updateAIConversationTitle: (id: string, title: string) => void;
  addAIMessage: (conversationId: string, msg: AIMessage) => void;
  setAILoading: (loading: boolean) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  aiProvider: AIProvider;
  setAIProvider: (provider: AIProvider) => void;
  aiModel: string;
  setAIModel: (model: string) => void;
  aiBaseUrl: string;
  setAIBaseUrl: (url: string) => void;

  // Project
  clearProject: () => void;
  loadProject: (data: unknown) => boolean;
  getProjectData: () => {
    components: CircuitComponent[];
    wires: Wire[];
    code: string;
    boardType: ControllerBoardType;
    boardPosition: { x: number; y: number };
    breadboardPosition: { x: number; y: number };
  };
}

type ProjectSnapshot = {
  components: CircuitComponent[];
  wires: Wire[];
  code: string;
  boardType: ControllerBoardType;
  boardPosition: { x: number; y: number };
  breadboardPosition: { x: number; y: number };
  selectedComponentId: string | null;
  /** Every selected part, with the primary one last. Holding Ctrl adds to it. */
  selectedComponentIds: string[];
  selectedWireId: string | null;
};

const DEFAULT_CODE = `// Arduino sketch
void setup() {
  pinMode(13, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
  Serial.println("LED Blink!");
}
`;

const MAX_UNDO_HISTORY = 100;

function getBoardLogicHighVoltage(boardType: ControllerBoardType): number {
  switch (boardType) {
    case 'deneyap-kart-1a':
    case 'deneyap-kart-1a-v2':
    case 'deneyap-kart-g':
    case 'deneyap-mini':
    case 'deneyap-mini-v2':
    case 'nodemcu':
    case 'nodemcu-v3':
    case 'wemos-d1-mini':
    case 'arduino-fio':
    case 'pico':
    case 'feather-huzzah32':
    case 'esp32-s3-devkitc-1':
      return 3.3;
    default:
      return 5;
  }
}

const cloneComponents = (components: CircuitComponent[]): CircuitComponent[] =>
  components.map((component) => ({
    ...component,
    pins: component.pins.map((pin) => ({ ...pin })),
    properties: { ...component.properties },
  }));

const cloneWires = (wires: Wire[]): Wire[] =>
  wires.map((wire) => ({
    ...wire,
    points: [...wire.points],
  }));

const MAX_STORED_AI_CONVERSATIONS = 50;

const AI_CONVERSATIONS_STORAGE_KEY = 'ai_conversations';
const AI_CURRENT_CONVERSATION_STORAGE_KEY = 'ai_currentConversationId';
const APP_LANGUAGE_STORAGE_KEY = 'app_language';
const AI_PROVIDER_STORAGE_KEY = 'ai_provider';
const PROJECT_DRAFT_STORAGE_KEY = 'project_draft';
/** How long the circuit has to sit still before it is written back. */
const PROJECT_DRAFT_DELAY_MS = 800;

/**
 * The circuit on screen is kept in storage so that closing the window, a power
 * cut or a crash does not throw the work away. Anything unreadable is ignored
 * and the app starts empty, which is what happened before this existed.
 */
const loadProjectDraft = (): ProjectData | null => {
  const stored = readStorage(PROJECT_DRAFT_STORAGE_KEY);
  if (!stored) return null;

  try {
    return sanitizeProjectData(JSON.parse(stored), DEFAULT_CODE);
  } catch {
    return null;
  }
};

// Turkish is what the program is written for, so that is what it opens in;
// anyone who picked English keeps English.
const loadLanguage = (): AppLanguage => {
  const stored = readStorage(APP_LANGUAGE_STORAGE_KEY);
  return stored === 'en' ? 'en' : 'tr';
};

const loadAIProvider = (): AIProvider => {
  const stored = readStorage(AI_PROVIDER_STORAGE_KEY);
  if (
    stored === 'groq' ||
    stored === 'openai' ||
    stored === 'gemini' ||
    stored === 'compatible'
  ) {
    return stored;
  }
  return DEFAULT_AI_PROVIDER;
};

const normalizeConversations = (conversations: AIConversation[]) =>
  [...conversations].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

const loadAIConversations = (defaultConversationTitle: string): AIConversation[] => {
  try {
    const raw = readStorage(AI_CONVERSATIONS_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const conversations = parsed.flatMap((item) => {
      const candidate = item as Record<string, unknown> | null;
      if (
        !candidate ||
        typeof candidate.id !== 'string' ||
        typeof candidate.title !== 'string' ||
        !Array.isArray(candidate.messages) ||
        typeof candidate.createdAt !== 'string' ||
        typeof candidate.updatedAt !== 'string'
      ) {
        return [];
      }

      const messages = candidate.messages.flatMap((message: unknown) => {
        const messageCandidate = message as Record<string, unknown> | null;
        if (
          !messageCandidate ||
          (messageCandidate.role !== 'user' &&
            messageCandidate.role !== 'assistant') ||
          typeof messageCandidate.content !== 'string'
        ) {
          return [];
        }

        return [{
          role: messageCandidate.role,
          content: messageCandidate.content,
        } satisfies AIMessage];
      });

      return [{
        id: candidate.id,
        title: candidate.title || defaultConversationTitle,
        messages,
        createdAt: candidate.createdAt,
        updatedAt: candidate.updatedAt,
      } satisfies AIConversation];
    });

    return normalizeConversations(conversations);
  } catch {
    return [];
  }
};

const loadCurrentAIConversationId = (conversations: AIConversation[]) => {
  const storedId = readStorage(AI_CURRENT_CONVERSATION_STORAGE_KEY);
  if (!storedId) return null;
  return conversations.some((conversation) => conversation.id === storedId)
    ? storedId
    : null;
};

const persistAIConversationState = (
  conversations: AIConversation[],
  currentConversationId: string | null
) => {
  // Storage is finite, so only the most recent chats are kept, and a rejected
  // write sheds the oldest ones and tries once more rather than throwing.
  let kept = conversations.slice(0, MAX_STORED_AI_CONVERSATIONS);

  while (
    !writeStorage(AI_CONVERSATIONS_STORAGE_KEY, JSON.stringify(kept)) &&
    kept.length > 1
  ) {
    kept = kept.slice(0, Math.floor(kept.length / 2));
  }

  if (currentConversationId) {
    writeStorage(AI_CURRENT_CONVERSATION_STORAGE_KEY, currentConversationId);
  } else {
    removeStorage(AI_CURRENT_CONVERSATION_STORAGE_KEY);
  }
};

export const useCircuitStore = create<CircuitStore>((set, get) => {
  const initialLanguage = loadLanguage();
  const initialAIConversations = loadAIConversations(
    getDefaultConversationTitle(initialLanguage)
  );
  const initialCurrentAIConversationId = loadCurrentAIConversationId(initialAIConversations);
  const draft = loadProjectDraft();
  const undoStack: ProjectSnapshot[] = [];
  const redoStack: ProjectSnapshot[] = [];

  const createSnapshot = (): ProjectSnapshot => {
    const state = get();
    return {
      components: cloneComponents(state.components),
      wires: cloneWires(state.wires),
      code: state.code,
      boardType: state.boardType,
      boardPosition: { ...state.boardPosition },
      breadboardPosition: { ...state.breadboardPosition },
      selectedComponentId: state.selectedComponentId,
      selectedComponentIds: [...state.selectedComponentIds],
      selectedWireId: state.selectedWireId,
    };
  };

  const pushHistory = (stack: ProjectSnapshot[]) => {
    stack.push(createSnapshot());
    if (stack.length > MAX_UNDO_HISTORY) {
      stack.shift();
    }
  };

  // A fresh edit makes whatever was undone unreachable, so the redo trail goes.
  const pushUndoSnapshot = () => {
    pushHistory(undoStack);
    redoStack.length = 0;
  };

  const startRuntime = () => {
    const state = get();
    startMockArduinoRuntime(
      state.code,
      state.components,
      state.wires,
      getControllerBoardPins(state.boardType),
      getBoardLogicHighVoltage(state.boardType),
      {
      addSerialOutput: (text) =>
        set((s) => ({
          simulation: {
            ...s.simulation,
            serialOutput: [...s.simulation.serialOutput, text].slice(-200),
          },
        })),
      pushOscilloscopeSample: (componentId, sample) =>
        set((s) => {
          const currentTrace = s.simulation.oscilloscopeTraces[componentId] ?? [];
          const lastSample = currentTrace[currentTrace.length - 1];
          const nextTrace =
            lastSample &&
            lastSample.timeMs === sample.timeMs &&
            Math.abs(lastSample.voltage - sample.voltage) < 0.0001
              ? currentTrace
              : [...currentTrace, sample].slice(-600);

          return {
            simulation: {
              ...s.simulation,
              oscilloscopeTraces: {
                ...s.simulation.oscilloscopeTraces,
                [componentId]: nextTrace,
              },
            },
          };
        }),
      setLedState: (componentId, on, brightness) =>
        set((s) => ({
          simulation: {
            ...s.simulation,
            ledStates: {
              ...s.simulation.ledStates,
              [componentId]: { on, brightness },
            },
          },
        })),
      clearLedStates: () =>
        set((s) => ({
          simulation: {
            ...s.simulation,
            ledStates: {},
          },
        })),
      setPinStates: (pinStates) =>
        set((s) => ({
          simulation: {
            ...s.simulation,
            pinStates,
          },
        })),
      setComponentState: (componentId, properties) =>
        set((s) => ({
          simulation: {
            ...s.simulation,
            componentStates: {
              ...s.simulation.componentStates,
              [componentId]: {
                ...(s.simulation.componentStates[componentId] ?? {}),
                ...properties,
              },
            },
          },
        })),
      clearComponentStates: () =>
        set((s) => ({
          simulation: {
            ...s.simulation,
            componentStates: {},
          },
        })),
      }
    );
  };

  const syncRuntimeIfRunning = () => {
    if (!get().simulation.running) return;
    stopMockArduinoRuntime();
    startRuntime();
  };

  const restoreSnapshot = (snapshot: ProjectSnapshot) => {
    const wasRunning = get().simulation.running;
    stopMockArduinoRuntime();

    set((state) => ({
      components: cloneComponents(snapshot.components),
      wires: cloneWires(snapshot.wires),
      code: snapshot.code,
      boardType: snapshot.boardType,
      boardPosition: { ...snapshot.boardPosition },
      breadboardPosition: { ...snapshot.breadboardPosition },
      selectedComponentId: snapshot.selectedComponentId,
      selectedComponentIds: [...(snapshot.selectedComponentIds ?? [])],
      selectedWireId: snapshot.selectedWireId,
      simulation: wasRunning
        ? {
            ...state.simulation,
            running: true,
            pinStates: {},
            ledStates: {},
            componentStates: {},
            serialOutput: [],
            oscilloscopeTraces: {},
          }
        : {
            ...state.simulation,
            pinStates: {},
            ledStates: {},
            componentStates: {},
            oscilloscopeTraces: {},
          },
    }));

    if (wasRunning) {
      startRuntime();
    }
  };

  const setAIConversationState = (
    conversations: AIConversation[],
    currentConversationId: string | null
  ) => {
    const normalizedConversations = normalizeConversations(conversations);
    const normalizedCurrentConversationId =
      currentConversationId &&
      normalizedConversations.some(
        (conversation) => conversation.id === currentConversationId
      )
        ? currentConversationId
        : null;

    persistAIConversationState(
      normalizedConversations,
      normalizedCurrentConversationId
    );

    set({
      aiConversations: normalizedConversations,
      currentAIConversationId: normalizedCurrentConversationId,
    });
  };

  return ({
  // Components
  components: draft?.components ?? [],
  selectedComponentId: null,
  selectedComponentIds: [],

  // Wires
  wires: draft?.wires ?? [],
  selectedWireId: null,
  wireColor: WIRE_COLORS[0].value,

  // Tool
  toolMode: 'select',
  setToolMode: (mode) => set({ toolMode: mode }),

  // UI
  rightTab: 'properties',
  setRightTab: (tab) => set({ rightTab: tab }),
  bottomPanelCollapsed: false,
  toggleBottomPanel: () => set((s) => ({ bottomPanelCollapsed: !s.bottomPanelCollapsed })),
  bottomTab: 'code',
  setBottomTab: (tab) => set({ bottomTab: tab }),
  language: initialLanguage,
  setLanguage: (language) => {
    writeStorage(APP_LANGUAGE_STORAGE_KEY, language);
    set({ language });
  },

  // Canvas
  zoom: 1,
  stagePos: { x: 0, y: 0 },
  setZoom: (z) => set({ zoom: Math.max(0.2, Math.min(3, z)) }),
  setStagePos: (pos) => set({ stagePos: pos }),
  boardType: draft?.boardType ?? DEFAULT_CONTROLLER_BOARD_TYPE,
  setBoardType: (boardType) => {
    if (get().boardType === boardType) return;
    pushUndoSnapshot();
    set({ boardType });
    syncRuntimeIfRunning();
  },
  boardPosition: draft?.boardPosition ?? { ...DEFAULT_CONTROLLER_BOARD_POSITION },
  setBoardPosition: (boardPosition) => set({ boardPosition }),
  breadboardPosition: draft?.breadboardPosition ?? { ...DEFAULT_BREADBOARD_POSITION },
  setBreadboardPosition: (breadboardPosition) => set({ breadboardPosition }),
  captureUndoSnapshot: () => pushUndoSnapshot(),

  // Component actions
  addComponent: (type, x, y) => {
    pushUndoSnapshot();
    const comp = createComponent(type, x, y);
    set((s) => ({
      components: [...s.components, comp],
      selectedComponentId: comp.id,
      selectedComponentIds: [comp.id],
      toolMode: 'select',
    }));
    syncRuntimeIfRunning();
  },

  removeComponent: (id) => {
    if (!get().components.some((component) => component.id === id)) return;
    pushUndoSnapshot();
    set((s) => ({
      components: s.components.filter((c) => c.id !== id),
      wires: s.wires.filter(
        (w) => w.startComponentId !== id && w.endComponentId !== id
      ),
      selectedComponentId: s.selectedComponentId === id ? null : s.selectedComponentId,
      selectedComponentIds: s.selectedComponentIds.filter((selected) => selected !== id),
    }));
    syncRuntimeIfRunning();
  },

  updateComponent: (id, updates, options) => {
    if (!get().components.some((component) => component.id === id)) return;
    if (options?.recordHistory !== false) pushUndoSnapshot();
    set((s) => ({
      components: s.components.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    }));
    syncRuntimeIfRunning();
  },

  selectComponent: (id) =>
    set({
      selectedComponentId: id,
      selectedComponentIds: id ? [id] : [],
      selectedWireId: null,
      rightTab: 'properties',
    }),

  toggleComponentSelection: (id) =>
    set((s) => {
      if (!s.components.some((component) => component.id === id)) return {};

      const without = s.selectedComponentIds.filter((selected) => selected !== id);
      const next = without.length === s.selectedComponentIds.length ? [...without, id] : without;

      return {
        selectedComponentIds: next,
        selectedComponentId: next.length > 0 ? next[next.length - 1] : null,
        selectedWireId: null,
        rightTab: 'properties',
      };
    }),

  selectComponents: (ids) =>
    set((s) => {
      const known = ids.filter((id) => s.components.some((component) => component.id === id));
      return {
        selectedComponentIds: known,
        selectedComponentId: known.length > 0 ? known[known.length - 1] : null,
        selectedWireId: null,
      };
    }),

  updateComponentProperty: (id, key, value, options) => {
    if (!get().components.some((component) => component.id === id)) return;
    if (options?.recordHistory !== false) pushUndoSnapshot();
    set((s) => ({
      components: s.components.map((c) =>
        c.id === id
          ? { ...c, properties: { ...c.properties, [key]: value } }
          : c
      ),
    }));
    syncRuntimeIfRunning();
  },

  // Wire actions
  addWire: (wire) => {
    pushUndoSnapshot();
    const newWire = { ...wire, id: uuidv4() };
    set((s) => ({ wires: [...s.wires, newWire] }));
    syncRuntimeIfRunning();
  },

  updateWirePoints: (id, points) => {
    // Geometry only — the simulation reads endpoints, not the route.
    set((s) => ({
      wires: s.wires.map((wire) =>
        wire.id === id ? { ...wire, points } : wire
      ),
    }));
  },

  updateWireEndpoint: (id, end, componentId, pinId, position) => {
    const wire = get().wires.find((item) => item.id === id);
    if (!wire) return;

    const alreadyThere =
      end === 'start'
        ? wire.startComponentId === componentId && wire.startPinId === pinId
        : wire.endComponentId === componentId && wire.endPinId === pinId;
    if (alreadyThere) return;

    // Both ends in the same socket would be a wire to nowhere.
    const otherEnd =
      end === 'start'
        ? { componentId: wire.endComponentId, pinId: wire.endPinId }
        : { componentId: wire.startComponentId, pinId: wire.startPinId };
    if (otherEnd.componentId === componentId && otherEnd.pinId === pinId) return;

    pushUndoSnapshot();
    set((s) => ({
      wires: s.wires.map((item) => {
        if (item.id !== id) return item;

        const points = [...item.points];
        if (points.length < 4) {
          points.splice(0, points.length, position.x, position.y, position.x, position.y);
        }

        if (end === 'start') {
          points[0] = position.x;
          points[1] = position.y;
          return {
            ...item,
            startComponentId: componentId,
            startPinId: pinId,
            points,
          };
        }

        points[points.length - 2] = position.x;
        points[points.length - 1] = position.y;
        return {
          ...item,
          endComponentId: componentId,
          endPinId: pinId,
          points,
        };
      }),
    }));
    syncRuntimeIfRunning();
  },

  setWireColorById: (id, color) => {
    const wire = get().wires.find((item) => item.id === id);
    if (!wire || wire.color === color) return;

    pushUndoSnapshot();
    set((s) => ({
      wires: s.wires.map((item) => (item.id === id ? { ...item, color } : item)),
    }));
  },

  removeWire: (id) => {
    if (!get().wires.some((wire) => wire.id === id)) return;
    pushUndoSnapshot();
    set((s) => ({
      wires: s.wires.filter((w) => w.id !== id),
      selectedWireId: s.selectedWireId === id ? null : s.selectedWireId,
    }));
    syncRuntimeIfRunning();
  },

  selectWire: (id) =>
    set({
      selectedWireId: id,
      selectedComponentId: null,
      selectedComponentIds: [],
      rightTab: 'properties',
    }),

  setWireColor: (color) => set({ wireColor: color }),

  // Simulation
  simulation: {
    running: false,
    pinStates: {},
    ledStates: {},
    componentStates: {},
    serialOutput: [],
    oscilloscopeTraces: {},
  },

  startSimulation: () => {
    set((s) => {
      stopMockArduinoRuntime();
      return {
        simulation: {
          ...s.simulation,
          running: true,
          pinStates: {},
          ledStates: {},
          componentStates: {},
          serialOutput: [],
          oscilloscopeTraces: {},
        },
      };
    });
    startRuntime();
  },

  stopSimulation: () => {
    set((s) => {
      stopMockArduinoRuntime();
      return {
        simulation: {
          ...s.simulation,
          running: false,
          pinStates: {},
          ledStates: {},
          componentStates: {},
        },
      };
    });
  },

  updateLedState: (componentId, on, brightness) =>
    set((s) => ({
      simulation: {
        ...s.simulation,
        ledStates: {
          ...s.simulation.ledStates,
          [componentId]: { on, brightness },
        },
      },
    })),

  addSerialOutput: (text) =>
    set((s) => ({
      simulation: {
        ...s.simulation,
        serialOutput: [...s.simulation.serialOutput, text].slice(-200),
      },
    })),

  clearSerialOutput: () =>
    set((s) => ({
      simulation: { ...s.simulation, serialOutput: [] },
    })),

  addOscilloscopeSample: (componentId, sample) =>
    set((s) => {
      const currentTrace = s.simulation.oscilloscopeTraces[componentId] ?? [];
      const lastSample = currentTrace[currentTrace.length - 1];
      const nextTrace =
        lastSample &&
        lastSample.timeMs === sample.timeMs &&
        Math.abs(lastSample.voltage - sample.voltage) < 0.0001
          ? currentTrace
          : [...currentTrace, sample].slice(-600);

      return {
        simulation: {
          ...s.simulation,
          oscilloscopeTraces: {
            ...s.simulation.oscilloscopeTraces,
            [componentId]: nextTrace,
          },
        },
      };
    }),

  clearOscilloscopeTraces: () =>
    set((s) => ({
      simulation: { ...s.simulation, oscilloscopeTraces: {} },
    })),

  // Code
  code: draft?.code ?? DEFAULT_CODE,
  setCode: (code) => {
    if (get().code === code) return;
    set({ code });
    syncRuntimeIfRunning();
  },
  undo: () => {
    const snapshot = undoStack.pop();
    if (!snapshot) return;
    pushHistory(redoStack);
    restoreSnapshot(snapshot);
  },
  canUndo: () => undoStack.length > 0,

  redo: () => {
    const snapshot = redoStack.pop();
    if (!snapshot) return;
    pushHistory(undoStack);
    restoreSnapshot(snapshot);
  },
  canRedo: () => redoStack.length > 0,

  // AI
  aiConversations: initialAIConversations,
  currentAIConversationId: initialCurrentAIConversationId,
  aiLoading: false,
  createAIConversation: (title) => {
    const timestamp = new Date().toISOString();
    const conversation: AIConversation = {
      id: uuidv4(),
      title: title?.trim() || getDefaultConversationTitle(get().language),
      messages: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    setAIConversationState(
      [conversation, ...get().aiConversations],
      conversation.id
    );

    return conversation.id;
  },
  selectAIConversation: (id) => {
    const nextId =
      id && get().aiConversations.some((conversation) => conversation.id === id)
        ? id
        : null;

    persistAIConversationState(get().aiConversations, nextId);
    set({ currentAIConversationId: nextId });
  },
  deleteAIConversation: (id) => {
    const state = get();
    const conversations = state.aiConversations.filter(
      (conversation) => conversation.id !== id
    );
    const nextId =
      state.currentAIConversationId === id ? null : state.currentAIConversationId;

    setAIConversationState(conversations, nextId);
  },
  updateAIConversationTitle: (id, title) => {
    const state = get();
    const cleanedTitle =
      title.trim() || getDefaultConversationTitle(state.language);
    const conversations = state.aiConversations.map((conversation) =>
      conversation.id === id
        ? { ...conversation, title: cleanedTitle }
        : conversation
    );

    setAIConversationState(conversations, state.currentAIConversationId);
  },
  addAIMessage: (conversationId, msg) => {
    const state = get();
    const conversation = state.aiConversations.find(
      (item) => item.id === conversationId
    );
    if (!conversation) return;

    const updatedConversation: AIConversation = {
      ...conversation,
      messages: [...conversation.messages, msg],
      updatedAt: new Date().toISOString(),
    };

    setAIConversationState(
      [
        updatedConversation,
        ...state.aiConversations.filter((item) => item.id !== conversationId),
      ],
      conversationId
    );
  },
  setAILoading: (loading) => set({ aiLoading: loading }),
  apiKey: readStorage('ai_apiKey') || '',
  setApiKey: (key) => { writeStorage('ai_apiKey', key); set({ apiKey: key }); },
  aiProvider: loadAIProvider(),
  setAIProvider: (provider) => {
    writeStorage(AI_PROVIDER_STORAGE_KEY, provider);
    set({ aiProvider: provider });
  },
  aiModel: readStorage('ai_model') || '',
  setAIModel: (model) => { writeStorage('ai_model', model); set({ aiModel: model }); },
  aiBaseUrl: readStorage('ai_baseUrl') || '',
  setAIBaseUrl: (url) => { writeStorage('ai_baseUrl', url); set({ aiBaseUrl: url }); },

  // Project
  clearProject: () => {
    if (
      get().components.length > 0 ||
      get().wires.length > 0 ||
      get().code !== DEFAULT_CODE ||
      get().boardType !== DEFAULT_CONTROLLER_BOARD_TYPE ||
      get().boardPosition.x !== DEFAULT_CONTROLLER_BOARD_POSITION.x ||
      get().boardPosition.y !== DEFAULT_CONTROLLER_BOARD_POSITION.y ||
      get().breadboardPosition.x !== DEFAULT_BREADBOARD_POSITION.x ||
      get().breadboardPosition.y !== DEFAULT_BREADBOARD_POSITION.y
    ) {
      pushUndoSnapshot();
    }
    stopMockArduinoRuntime();
    set({
      components: [],
      wires: [],
      selectedComponentId: null,
      selectedComponentIds: [],
      selectedWireId: null,
      code: DEFAULT_CODE,
      boardType: DEFAULT_CONTROLLER_BOARD_TYPE,
      boardPosition: { ...DEFAULT_CONTROLLER_BOARD_POSITION },
      breadboardPosition: { ...DEFAULT_BREADBOARD_POSITION },
      simulation: {
        running: false,
        pinStates: {},
        ledStates: {},
        componentStates: {},
        serialOutput: [],
        oscilloscopeTraces: {},
      },
    });
  },

  loadProject: (data) => {
    const project = sanitizeProjectData(data, DEFAULT_CODE);
    if (!project) return false;

    pushUndoSnapshot();
    stopMockArduinoRuntime();
    set({
      components: project.components,
      wires: project.wires,
      code: project.code,
      boardType: getControllerBoardDefinition(project.boardType).type,
      boardPosition: project.boardPosition,
      breadboardPosition: project.breadboardPosition,
      selectedComponentId: null,
      selectedComponentIds: [],
      selectedWireId: null,
      simulation: {
        running: false,
        pinStates: {},
        ledStates: {},
        componentStates: {},
        serialOutput: [],
        oscilloscopeTraces: {},
      },
    });

    return true;
  },

  getProjectData: () => {
    const {
      components,
      wires,
      code,
      boardType,
      boardPosition,
      breadboardPosition,
    } = get();
    return {
      components,
      wires,
      code,
      boardType,
      boardPosition,
      breadboardPosition,
    };
  },
  });
});

let draftTimer: number | null = null;

const saveProjectDraftNow = () => {
  const project = useCircuitStore.getState().getProjectData();
  writeStorage(PROJECT_DRAFT_STORAGE_KEY, JSON.stringify(project));
};

/** Writes the circuit back once it has stopped changing for a moment. */
const scheduleProjectDraftSave = () => {
  if (typeof window === 'undefined') return;

  if (draftTimer !== null) window.clearTimeout(draftTimer);
  draftTimer = window.setTimeout(() => {
    draftTimer = null;
    saveProjectDraftNow();
  }, PROJECT_DRAFT_DELAY_MS);
};

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  // Closing the window during the pause would otherwise drop the last edit.
  window.addEventListener('beforeunload', () => {
    if (draftTimer === null) return;
    window.clearTimeout(draftTimer);
    draftTimer = null;
    saveProjectDraftNow();
  });
}

useCircuitStore.subscribe((state, previous) => {
  const changed =
    state.components !== previous.components ||
    state.wires !== previous.wires ||
    state.code !== previous.code ||
    state.boardType !== previous.boardType ||
    state.boardPosition !== previous.boardPosition ||
    state.breadboardPosition !== previous.breadboardPosition;

  if (changed) scheduleProjectDraftSave();
});
