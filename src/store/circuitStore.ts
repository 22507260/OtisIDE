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
import { v4 as uuidv4 } from 'uuid';
import { startMockArduinoRuntime, stopMockArduinoRuntime } from '../lib/mockArduinoRuntime';

interface CircuitStore {
  // Components
  components: CircuitComponent[];
  selectedComponentId: string | null;

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
  updateComponent: (id: string, updates: Partial<CircuitComponent>) => void;
  selectComponent: (id: string | null) => void;
  updateComponentProperty: (id: string, key: string, value: string | number | boolean) => void;

  // Wire actions
  addWire: (wire: Omit<Wire, 'id'>) => void;
  removeWire: (id: string) => void;
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
  loadProject: (data: {
    components: CircuitComponent[];
    wires: Wire[];
    code: string;
    boardType?: ControllerBoardType;
    boardPosition?: { x: number; y: number };
    breadboardPosition?: { x: number; y: number };
  }) => void;
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

const AI_CONVERSATIONS_STORAGE_KEY = 'ai_conversations';
const AI_CURRENT_CONVERSATION_STORAGE_KEY = 'ai_currentConversationId';
const APP_LANGUAGE_STORAGE_KEY = 'app_language';
const AI_PROVIDER_STORAGE_KEY = 'ai_provider';

const loadLanguage = (): AppLanguage => {
  const stored = localStorage.getItem(APP_LANGUAGE_STORAGE_KEY);
  return stored === 'tr' ? 'tr' : 'en';
};

const loadAIProvider = (): AIProvider => {
  const stored = localStorage.getItem(AI_PROVIDER_STORAGE_KEY);
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
    const raw = localStorage.getItem(AI_CONVERSATIONS_STORAGE_KEY);
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
  const storedId = localStorage.getItem(AI_CURRENT_CONVERSATION_STORAGE_KEY);
  if (!storedId) return null;
  return conversations.some((conversation) => conversation.id === storedId)
    ? storedId
    : null;
};

const persistAIConversationState = (
  conversations: AIConversation[],
  currentConversationId: string | null
) => {
  localStorage.setItem(
    AI_CONVERSATIONS_STORAGE_KEY,
    JSON.stringify(conversations)
  );

  if (currentConversationId) {
    localStorage.setItem(
      AI_CURRENT_CONVERSATION_STORAGE_KEY,
      currentConversationId
    );
  } else {
    localStorage.removeItem(AI_CURRENT_CONVERSATION_STORAGE_KEY);
  }
};

export const useCircuitStore = create<CircuitStore>((set, get) => {
  const initialLanguage = loadLanguage();
  const initialAIConversations = loadAIConversations(
    getDefaultConversationTitle(initialLanguage)
  );
  const initialCurrentAIConversationId = loadCurrentAIConversationId(initialAIConversations);
  const undoStack: ProjectSnapshot[] = [];

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
      selectedWireId: state.selectedWireId,
    };
  };

  const pushUndoSnapshot = () => {
    undoStack.push(createSnapshot());
    if (undoStack.length > MAX_UNDO_HISTORY) {
      undoStack.shift();
    }
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
  components: [],
  selectedComponentId: null,

  // Wires
  wires: [],
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
    localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, language);
    set({ language });
  },

  // Canvas
  zoom: 1,
  stagePos: { x: 0, y: 0 },
  setZoom: (z) => set({ zoom: Math.max(0.2, Math.min(3, z)) }),
  setStagePos: (pos) => set({ stagePos: pos }),
  boardType: DEFAULT_CONTROLLER_BOARD_TYPE,
  setBoardType: (boardType) => {
    if (get().boardType === boardType) return;
    pushUndoSnapshot();
    set({ boardType });
    syncRuntimeIfRunning();
  },
  boardPosition: { ...DEFAULT_CONTROLLER_BOARD_POSITION },
  setBoardPosition: (boardPosition) => set({ boardPosition }),
  breadboardPosition: { ...DEFAULT_BREADBOARD_POSITION },
  setBreadboardPosition: (breadboardPosition) => set({ breadboardPosition }),
  captureUndoSnapshot: () => pushUndoSnapshot(),

  // Component actions
  addComponent: (type, x, y) => {
    pushUndoSnapshot();
    const comp = createComponent(type, x, y);
    set((s) => ({
      components: [...s.components, comp],
      selectedComponentId: comp.id,
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
    }));
    syncRuntimeIfRunning();
  },

  updateComponent: (id, updates) => {
    if (!get().components.some((component) => component.id === id)) return;
    pushUndoSnapshot();
    set((s) => ({
      components: s.components.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    }));
    syncRuntimeIfRunning();
  },

  selectComponent: (id) =>
    set({ selectedComponentId: id, selectedWireId: null, rightTab: id ? 'properties' : 'properties' }),

  updateComponentProperty: (id, key, value) => {
    if (!get().components.some((component) => component.id === id)) return;
    pushUndoSnapshot();
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
    set({ selectedWireId: id, selectedComponentId: null }),

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
  code: DEFAULT_CODE,
  setCode: (code) => {
    if (get().code === code) return;
    set({ code });
    syncRuntimeIfRunning();
  },
  undo: () => {
    const snapshot = undoStack.pop();
    if (!snapshot) return;
    restoreSnapshot(snapshot);
  },
  canUndo: () => undoStack.length > 0,

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
  apiKey: localStorage.getItem('ai_apiKey') || '',
  setApiKey: (key) => { localStorage.setItem('ai_apiKey', key); set({ apiKey: key }); },
  aiProvider: loadAIProvider(),
  setAIProvider: (provider) => {
    localStorage.setItem(AI_PROVIDER_STORAGE_KEY, provider);
    set({ aiProvider: provider });
  },
  aiModel: localStorage.getItem('ai_model') || '',
  setAIModel: (model) => { localStorage.setItem('ai_model', model); set({ aiModel: model }); },
  aiBaseUrl: localStorage.getItem('ai_baseUrl') || '',
  setAIBaseUrl: (url) => { localStorage.setItem('ai_baseUrl', url); set({ aiBaseUrl: url }); },

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
    pushUndoSnapshot();
    stopMockArduinoRuntime();
    set({
      components: data.components,
      wires: data.wires,
      code: data.code,
      boardType: getControllerBoardDefinition(
        data.boardType ?? DEFAULT_CONTROLLER_BOARD_TYPE
      ).type,
      boardPosition: {
        ...DEFAULT_CONTROLLER_BOARD_POSITION,
        ...data.boardPosition,
      },
      breadboardPosition: {
        ...DEFAULT_BREADBOARD_POSITION,
        ...data.breadboardPosition,
      },
      selectedComponentId: null,
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
