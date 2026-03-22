import { create } from 'zustand';
import type { ControllerBoardType } from '../models/arduinoUno';
import { t } from '../lib/i18n';
import { useCircuitStore } from './circuitStore';

export type HardwareConsoleKind = 'system' | 'upload' | 'serial' | 'error';

export interface HardwareConsoleEntry {
  id: string;
  kind: HardwareConsoleKind;
  text: string;
  timestamp: string;
}

export interface HardwarePortInfo {
  path: string;
  label: string;
  protocol: string;
  protocolLabel: string;
  manufacturer: string;
  serialNumber: string;
  vendorId: string;
  productId: string;
  fqbn: string;
  boardName: string;
  boardType: ControllerBoardType | null;
  detected: boolean;
  serialCapable: boolean;
}

type HardwareSerialStatusPayload = {
  open?: boolean;
  path?: string;
  baudRate?: number;
};

type HardwareSerialErrorPayload = {
  path?: string;
  error?: string;
};

type HardwareSerialDataPayload = {
  path?: string;
  line?: string;
};

interface HardwareOperationResult {
  ok: boolean;
  error?: string;
  fqbn?: string;
  boardName?: string;
  boardType?: ControllerBoardType;
  logs?: Array<{ type: HardwareConsoleKind; text: string }>;
}

interface HardwareListResult {
  ok: boolean;
  cliAvailable?: boolean;
  cliVersion?: string;
  ports?: HardwarePortInfo[];
  error?: string;
}

interface HardwarePrepareResult {
  ok: boolean;
  cliAvailable?: boolean;
  cliVersion?: string;
  error?: string;
}

interface HardwareStore {
  supported: boolean;
  preparing: boolean;
  cliAvailable: boolean;
  cliVersion: string;
  ports: HardwarePortInfo[];
  selectedPortPath: string | null;
  detectedBoardType: ControllerBoardType | null;
  detectedBoardName: string;
  uploadInProgress: boolean;
  serialMonitorOpen: boolean;
  serialBaudRate: number;
  activeFqbn: string;
  lastError: string | null;
  consoleEntries: HardwareConsoleEntry[];
  init: () => Promise<void>;
  dispose: () => void;
  prepareHardwareIde: (force?: boolean) => Promise<void>;
  refreshDevices: (options?: { quiet?: boolean }) => Promise<void>;
  setSelectedPortPath: (path: string | null) => void;
  setSerialBaudRate: (baudRate: number) => void;
  clearConsole: () => void;
  appendConsoleEntries: (
    entries: Array<{ kind: HardwareConsoleKind; text: string }>
  ) => void;
  appendSerialData: (payload: HardwareSerialDataPayload) => void;
  handleSerialStatus: (payload: HardwareSerialStatusPayload) => void;
  handleSerialError: (payload: HardwareSerialErrorPayload) => void;
  verifySketch: (
    code: string,
    fallbackBoardType: ControllerBoardType
  ) => Promise<boolean>;
  uploadSketch: (
    code: string,
    fallbackBoardType: ControllerBoardType
  ) => Promise<boolean>;
  toggleSerialMonitor: () => Promise<void>;
  disconnectSerialMonitor: () => Promise<void>;
}

export const HARDWARE_BAUD_RATE_OPTIONS = [
  9600,
  19200,
  38400,
  57600,
  115200,
  230400,
];

const MAX_CONSOLE_ENTRIES = 500;

let refreshTimer: number | null = null;
let unsubscribeSerialData: (() => void) | null = null;
let unsubscribeSerialStatus: (() => void) | null = null;
let unsubscribeSerialError: (() => void) | null = null;

const getLanguage = () => useCircuitStore.getState().language;

const isDesktopHardwareSupported = () =>
  Boolean(
    window.electronAPI?.prepareHardwareIde &&
      window.electronAPI?.listHardwareDevices
  );

const createConsoleEntry = (
  kind: HardwareConsoleKind,
  text: string
): HardwareConsoleEntry => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  kind,
  text,
  timestamp: new Date().toISOString(),
});

const appendEntries = (
  currentEntries: HardwareConsoleEntry[],
  nextEntries: Array<{ kind: HardwareConsoleKind; text: string }>
) =>
  [
    ...currentEntries,
    ...nextEntries.flatMap((entry) => {
      const text = entry.text.trim();
      return text ? [createConsoleEntry(entry.kind, text)] : [];
    }),
  ].slice(-MAX_CONSOLE_ENTRIES);

const getPreferredPortPath = (
  ports: HardwarePortInfo[],
  currentPath: string | null
) => {
  if (currentPath && ports.some((port) => port.path === currentPath)) {
    return currentPath;
  }

  return ports.find((port) => port.detected)?.path ?? ports[0]?.path ?? null;
};

const getPortByPath = (
  ports: HardwarePortInfo[],
  path: string | null
) => ports.find((port) => port.path === path) ?? null;

export const useHardwareStore = create<HardwareStore>((set, get) => ({
  supported: isDesktopHardwareSupported(),
  preparing: false,
  cliAvailable: false,
  cliVersion: '',
  ports: [],
  selectedPortPath: null,
  detectedBoardType: null,
  detectedBoardName: '',
  uploadInProgress: false,
  serialMonitorOpen: false,
  serialBaudRate: 115200,
  activeFqbn: '',
  lastError: null,
  consoleEntries: [],

  init: async () => {
    if (!isDesktopHardwareSupported()) {
      set({ supported: false });
      return;
    }

    set({ supported: true });

    if (!unsubscribeSerialData) {
      unsubscribeSerialData = window.electronAPI?.onHardwareSerialData?.(
        (payload) => {
          get().appendSerialData(payload);
        }
      ) ?? null;
    }

    if (!unsubscribeSerialStatus) {
      unsubscribeSerialStatus = window.electronAPI?.onHardwareSerialStatus?.(
        (payload) => {
          get().handleSerialStatus(payload);
        }
      ) ?? null;
    }

    if (!unsubscribeSerialError) {
      unsubscribeSerialError = window.electronAPI?.onHardwareSerialError?.(
        (payload) => {
          get().handleSerialError(payload);
        }
      ) ?? null;
    }

    if (refreshTimer === null) {
      refreshTimer = window.setInterval(() => {
        void get().refreshDevices({ quiet: true });
      }, 2500);
    }

    await get().prepareHardwareIde();
    await get().refreshDevices({ quiet: true });
  },

  dispose: () => {
    if (refreshTimer !== null) {
      window.clearInterval(refreshTimer);
      refreshTimer = null;
    }

    unsubscribeSerialData?.();
    unsubscribeSerialStatus?.();
    unsubscribeSerialError?.();
    unsubscribeSerialData = null;
    unsubscribeSerialStatus = null;
    unsubscribeSerialError = null;
  },

  prepareHardwareIde: async (force = false) => {
    if (!window.electronAPI?.prepareHardwareIde) return;

    set({ preparing: true, lastError: null });
    const result = (await window.electronAPI.prepareHardwareIde({
      force,
    })) as HardwarePrepareResult;

    if (!result.ok) {
      set({
        preparing: false,
        cliAvailable: false,
        lastError: result.error || 'IDE prepare failed',
      });
      get().appendConsoleEntries([
        {
          kind: 'error',
          text: result.error || t(getLanguage(), 'hardwarePrepareFailed'),
        },
      ]);
      return;
    }

    set({
      preparing: false,
      cliAvailable: Boolean(result.cliAvailable),
      cliVersion: result.cliVersion || '',
      lastError: null,
    });
  },

  refreshDevices: async (options = {}) => {
    if (!window.electronAPI?.listHardwareDevices) return;

    const result = (await window.electronAPI.listHardwareDevices()) as HardwareListResult;
    if (!result.ok) {
      if (!options.quiet) {
        set({ lastError: result.error || 'USB scan failed' });
        get().appendConsoleEntries([
          {
            kind: 'error',
            text: result.error || t(getLanguage(), 'hardwareScanFailed'),
          },
        ]);
      }
      return;
    }

    const nextPorts = Array.isArray(result.ports) ? result.ports : [];
    const nextSelectedPath = getPreferredPortPath(
      nextPorts,
      get().selectedPortPath
    );
    const nextSelectedPort = getPortByPath(nextPorts, nextSelectedPath);

    set((state) => ({
      cliAvailable: Boolean(result.cliAvailable ?? state.cliAvailable),
      cliVersion: result.cliVersion || state.cliVersion,
      ports: nextPorts,
      selectedPortPath: nextSelectedPath,
      detectedBoardType:
        nextSelectedPort?.boardType ??
        nextPorts.find((port) => port.boardType)?.boardType ??
        null,
      detectedBoardName:
        nextSelectedPort?.boardName ||
        nextPorts.find((port) => port.boardName)?.boardName ||
        '',
      serialMonitorOpen:
        state.serialMonitorOpen && Boolean(nextSelectedPort) && nextSelectedPort.serialCapable,
      lastError: null,
    }));
  },

  setSelectedPortPath: (path) => {
    const nextPort = getPortByPath(get().ports, path);
    set({
      selectedPortPath: path,
      detectedBoardType: nextPort?.boardType ?? null,
      detectedBoardName: nextPort?.boardName || '',
    });
  },

  setSerialBaudRate: (baudRate) => set({ serialBaudRate: baudRate }),

  clearConsole: () => set({ consoleEntries: [] }),

  appendConsoleEntries: (entries) =>
    set((state) => ({
      consoleEntries: appendEntries(state.consoleEntries, entries),
    })),

  appendSerialData: (payload) => {
    const line = payload.line?.trim();
    if (!line) return;

    get().appendConsoleEntries([{ kind: 'serial', text: line }]);
  },

  handleSerialStatus: (payload) => {
    set({
      serialMonitorOpen: Boolean(payload.open),
    });
  },

  handleSerialError: (payload) => {
    const errorText = payload.error?.trim();
    set({
      serialMonitorOpen: false,
      lastError: errorText || null,
    });

    if (errorText) {
      get().appendConsoleEntries([{ kind: 'error', text: errorText }]);
    }
  },

  verifySketch: async (code, fallbackBoardType) => {
    if (!window.electronAPI?.verifyHardwareSketch) return false;

    const activePort = getPortByPath(get().ports, get().selectedPortPath);
    const activeBoardType = activePort?.boardType ?? fallbackBoardType;

    set({ uploadInProgress: true, lastError: null });
    const result = (await window.electronAPI.verifyHardwareSketch({
      code,
      boardType: activeBoardType,
      portPath: get().selectedPortPath,
    })) as HardwareOperationResult;

    set({
      uploadInProgress: false,
      activeFqbn: result.fqbn || '',
      lastError: result.ok ? null : result.error || 'Verify failed',
    });

    get().appendConsoleEntries(
      (result.logs || []).map((entry) => ({
        kind: entry.type,
        text: entry.text,
      }))
    );

    return Boolean(result.ok);
  },

  uploadSketch: async (code, fallbackBoardType) => {
    if (!window.electronAPI?.uploadHardwareSketch) return false;

    const activePort = getPortByPath(get().ports, get().selectedPortPath);
    const activeBoardType = activePort?.boardType ?? fallbackBoardType;

    set({ uploadInProgress: true, lastError: null });
    const result = (await window.electronAPI.uploadHardwareSketch({
      code,
      boardType: activeBoardType,
      portPath: get().selectedPortPath,
    })) as HardwareOperationResult;

    set({
      uploadInProgress: false,
      activeFqbn: result.fqbn || '',
      detectedBoardName:
        result.boardName || get().detectedBoardName,
      detectedBoardType:
        result.boardType || get().detectedBoardType,
      lastError: result.ok ? null : result.error || 'Upload failed',
    });

    get().appendConsoleEntries(
      (result.logs || []).map((entry) => ({
        kind: entry.type,
        text: entry.text,
      }))
    );

    return Boolean(result.ok);
  },

  toggleSerialMonitor: async () => {
    if (get().serialMonitorOpen) {
      await get().disconnectSerialMonitor();
      return;
    }

    if (!window.electronAPI?.openHardwareSerialMonitor || !get().selectedPortPath) {
      return;
    }

    const result = await window.electronAPI.openHardwareSerialMonitor({
      portPath: get().selectedPortPath,
      baudRate: get().serialBaudRate,
    });

    if (!result.ok) {
      set({ lastError: result.error || 'Serial monitor failed' });
      get().appendConsoleEntries([
        { kind: 'error', text: result.error || t(getLanguage(), 'serialMonitorFailed') },
      ]);
    }
  },

  disconnectSerialMonitor: async () => {
    if (!window.electronAPI?.closeHardwareSerialMonitor) return;

    await window.electronAPI.closeHardwareSerialMonitor();
    set({ serialMonitorOpen: false });
  },
}));
