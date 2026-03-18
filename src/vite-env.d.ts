/// <reference types="vite/client" />

interface ElectronDialogOptions {
  title?: string;
  defaultPath?: string;
  filterName?: string;
}

interface ElectronAPI {
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
  setWindowTitle?: (title: string) => void;
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
