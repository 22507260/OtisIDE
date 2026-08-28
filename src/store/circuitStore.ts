import { create } from 'zustand';
import {
  CircuitComponent,
  OscilloscopeSample,
  Wire,
  ToolMode,
  RightTab,
  BottomTab,
  ErrorLogEntry,
  SimulationState,
  AIMessage,
  AIConversation,
  AIProvider,
  DEFAULT_AI_PROVIDER,
  createComponent,
  ComponentType,
  WIRE_COLORS,
  WIRE_MIN_WIDTH,
  WIRE_MAX_WIDTH,
  WIRE_DEFAULT_WIDTH,
  WIRE_WIDTH_STEP,
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
import {
  startMockArduinoRuntime,
  stopMockArduinoRuntime,
  findSketchCompileError,
} from '../lib/mockArduinoRuntime';

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
  bottomTab: BottomTab;
  setBottomTab: (tab: BottomTab) => void;
  /**
   * Bumped when the user asks for the project to be checked — Verify, Upload
   * or Start. Checks that merely inspect the circuit wait for this instead of
   * firing as parts are dropped, when a half-built circuit is not yet wrong.
   */
  validationRequestId: number;
  requestValidation: () => void;
  /** Every problem seen this session, kept after its popup is dismissed. */
  errorLog: ErrorLogEntry[];
  /** Problems raised just now, shown in a popup until it is closed. */
  errorDialog: ErrorLogEntry[] | null;
  reportErrors: (entries: Array<{ sourceId: string; text: string }>) => void;
  dismissErrorDialog: () => void;
  clearErrorLog: () => void;
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
  /** Puts the selected parts, and the wires between them, on the clipboard. */
  copySelection: () => number;
  /** Drops a copy on the canvas, offset so it does not hide the original. */
  pasteClipboard: () => number;
  canPaste: () => boolean;
  /** Right-click "Duplicate": clones one part without touching the clipboard. */
  duplicateComponent: (id: string) => void;
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
  setWireWidthById: (id: string, width: number) => void;
  thickenWire: (id: string) => void;
  thinWire: (id: string) => void;
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
/** Old problems are dropped rather than letting the log grow without bound. */
const MAX_ERROR_LOG_ENTRIES = 200;
/** How far a pasted copy lands from the part it came from. */
const PASTE_OFFSET = 24;

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
  /** Copied parts live here rather than in the state: nothing renders them. */
  let clipboard: { components: CircuitComponent[]; wires: Wire[] } | null = null;
  /** Each paste steps further from the original so copies do not stack up. */
  let pastesSinceCopy = 0;
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
    // Setting a circuit up (parsing the sketch, building the connectivity
    // graph) all happens synchronously before a single statement runs, so a
    // bad sketch can throw here too — outside the reach of the interpreter's
    // own per-statement try/catch. Guard it the same way: log it, don't crash.
    try {
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
          reportRuntimeError: (message) =>
            set((s) => ({
              simulation: { ...s.simulation, runtimeError: message },
            })),
        }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set((s) => ({
        simulation: {
          ...s.simulation,
          serialOutput: [...s.simulation.serialOutput, `[!] ${message}`].slice(-200),
          runtimeError: message,
        },
      }));
    }
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

  validationRequestId: 0,
  requestValidation: () => set((s) => ({ validationRequestId: s.validationRequestId + 1 })),

  errorLog: [],
  errorDialog: null,
  // Callers pass only what has just appeared — they track which problems were
  // already standing, so a problem fixed and then made again is reported anew.
  reportErrors: (entries) => {
    if (entries.length === 0) return;

    const fresh = entries.map((entry) => ({
      id: uuidv4(),
      sourceId: entry.sourceId,
      text: entry.text,
      at: Date.now(),
    }));

    set((s) => ({
      errorLog: [...s.errorLog, ...fresh].slice(-MAX_ERROR_LOG_ENTRIES),
      errorDialog: fresh,
    }));
  },
  dismissErrorDialog: () => set({ errorDialog: null }),
  clearErrorLog: () => set({ errorLog: [], errorDialog: null }),

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

  copySelection: () => {
    const state = get();
    const ids = new Set(state.selectedComponentIds);
    if (ids.size === 0) return 0;

    const components = state.components.filter((component) => ids.has(component.id));
    // Only wires with both ends in the selection travel with it; a wire to
    // something left behind has nothing to attach to on the copy.
    const wires = state.wires.filter(
      (item) => ids.has(item.startComponentId) && ids.has(item.endComponentId)
    );

    clipboard = {
      components: cloneComponents(components),
      wires: cloneWires(wires),
    };
    pastesSinceCopy = 0;

    return components.length;
  },

  canPaste: () => clipboard !== null && clipboard.components.length > 0,

  pasteClipboard: () => {
    if (!clipboard || clipboard.components.length === 0) return 0;

    pushUndoSnapshot();
    pastesSinceCopy += 1;
    const offset = PASTE_OFFSET * pastesSinceCopy;

    const idByOriginal = new Map<string, string>();
    const components = clipboard.components.map((component) => {
      const id = uuidv4();
      idByOriginal.set(component.id, id);
      return {
        ...component,
        id,
        x: component.x + offset,
        y: component.y + offset,
        pins: component.pins.map((pin) => ({ ...pin })),
        properties: { ...component.properties },
      };
    });

    const wires = clipboard.wires.map((item) => ({
      ...item,
      id: uuidv4(),
      startComponentId: idByOriginal.get(item.startComponentId) ?? item.startComponentId,
      endComponentId: idByOriginal.get(item.endComponentId) ?? item.endComponentId,
      points: item.points.map((value, index) => value + (index % 2 === 0 ? offset : offset)),
    }));

    const pastedIds = components.map((component) => component.id);
    set((s) => ({
      components: [...s.components, ...components],
      wires: [...s.wires, ...wires],
      selectedComponentIds: pastedIds,
      selectedComponentId: pastedIds[pastedIds.length - 1],
      selectedWireId: null,
      toolMode: 'select',
      rightTab: 'properties',
    }));
    syncRuntimeIfRunning();

    return components.length;
  },

  duplicateComponent: (id) => {
    const state = get();
    const original = state.components.find((component) => component.id === id);
    if (!original) return;

    pushUndoSnapshot();
    const [clone] = cloneComponents([original]);
    clone.id = uuidv4();
    clone.x = original.x + PASTE_OFFSET;
    clone.y = original.y + PASTE_OFFSET;

    set((s) => ({
      components: [...s.components, clone],
      selectedComponentIds: [clone.id],
      selectedComponentId: clone.id,
      selectedWireId: null,
      rightTab: 'properties',
    }));
    syncRuntimeIfRunning();
  },

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

  setWireWidthById: (id, width) => {
    const wire = get().wires.find((item) => item.id === id);
    const clamped = Math.min(WIRE_MAX_WIDTH, Math.max(WIRE_MIN_WIDTH, width));
    if (!wire || wire.width === clamped) return;

    pushUndoSnapshot();
    set((s) => ({
      wires: s.wires.map((item) => (item.id === id ? { ...item, width: clamped } : item)),
    }));
  },

  thickenWire: (id) => {
    const wire = get().wires.find((item) => item.id === id);
    if (!wire) return;
    get().setWireWidthById(id, (wire.width ?? WIRE_DEFAULT_WIDTH) + WIRE_WIDTH_STEP);
  },

  thinWire: (id) => {
    const wire = get().wires.find((item) => item.id === id);
    if (!wire) return;
    get().setWireWidthById(id, (wire.width ?? WIRE_DEFAULT_WIDTH) - WIRE_WIDTH_STEP);
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
    runtimeError: null,
  },

  startSimulation: () => {
    // Pressing Start is the user asking for the project to be checked, so the
    // static findings surface now — including the one that stops the run below.
    get().requestValidation();

    // A broken sketch can't run — its error is already visible in the
    // warning banner, so flipping into "running" here would just reset the
    // board state and immediately die. Refuse the click instead.
    if (findSketchCompileError(get().code)) return;

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
          runtimeError: null,
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
          runtimeError: null,
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
        runtimeError: null,
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
        runtimeError: null,
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
