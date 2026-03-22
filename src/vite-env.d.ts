/// <reference types="vite/client" />
import type { ControllerBoardType } from './models/arduinoUno';

declare global {
interface ElectronDialogOptions {
  title?: string;
  defaultPath?: string;
  filterName?: string;
}

interface HardwarePortInfo {
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

interface HardwareLogEntry {
  type: 'system' | 'upload' | 'serial' | 'error';
  text: string;
}

interface HardwarePrepareResult {
  ok: boolean;
  cliAvailable?: boolean;
  cliVersion?: string;
  error?: string;
}

interface HardwareListResult {
  ok: boolean;
  cliAvailable?: boolean;
  cliVersion?: string;
  ports?: HardwarePortInfo[];
  error?: string;
}

interface HardwareOperationResult {
  ok: boolean;
  error?: string;
  fqbn?: string;
  boardName?: string;
  boardType?: ControllerBoardType;
  logs?: HardwareLogEntry[];
}

interface HardwareMonitorResult {
  ok: boolean;
  error?: string;
}

interface ElectronAPI {
  isCustomWindowChrome?: boolean;
  saveProject: (
    data: unknown,
    options?: ElectronDialogOptions
  ) => Promise<string | null>;
  loadProject: (options?: ElectronDialogOptions) => Promise<unknown | null>;
  exportPng: (
    dataUrl: string,
    options?: ElectronDialogOptions
  ) => Promise<string | null>;
  aiChat?: (payload: unknown) => Promise<{ content: string; error?: string }>;
  prepareHardwareIde?: (payload?: { force?: boolean }) => Promise<HardwarePrepareResult>;
  listHardwareDevices?: () => Promise<HardwareListResult>;
  verifyHardwareSketch?: (payload: {
    code: string;
    boardType: ControllerBoardType;
    portPath?: string | null;
  }) => Promise<HardwareOperationResult>;
  uploadHardwareSketch?: (payload: {
    code: string;
    boardType: ControllerBoardType;
    portPath?: string | null;
  }) => Promise<HardwareOperationResult>;
  openHardwareSerialMonitor?: (payload: {
    portPath: string;
    baudRate: number;
  }) => Promise<HardwareMonitorResult>;
  closeHardwareSerialMonitor?: () => Promise<HardwareMonitorResult>;
  onHardwareSerialData?: (
    callback: (payload: { path?: string; line?: string }) => void
  ) => () => void;
  onHardwareSerialStatus?: (
    callback: (payload: {
      open?: boolean;
      path?: string;
      baudRate?: number;
    }) => void
  ) => () => void;
  onHardwareSerialError?: (
    callback: (payload: { path?: string; error?: string }) => void
  ) => () => void;
  setWindowTitle?: (title: string) => void;
  minimizeWindow?: () => Promise<boolean>;
  toggleMaximizeWindow?: () => Promise<boolean>;
  closeWindow?: () => Promise<boolean>;
}

interface Window {
  electronAPI?: ElectronAPI;
  snapToBreadboard?: (
    x: number,
    y: number,
    type?: string,
    pins?: Array<{ x: number; y: number }>,
    rotation?: number
  ) => { x: number; y: number };
}
}

export {};
