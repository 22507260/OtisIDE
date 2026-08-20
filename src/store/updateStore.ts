import { create } from 'zustand';

type UpdateStatus = UpdaterStatusPayload;

interface UpdateStore {
  supported: boolean;
  appVersion: string;
  status: UpdateStatus | null;
  /** True while the user is waiting on a check they started themselves. */
  manualCheck: boolean;
  dismissedVersion: string | null;
  init: () => void;
  dispose: () => void;
  checkNow: () => Promise<void>;
  download: () => Promise<void>;
  install: () => Promise<void>;
  dismiss: () => void;
}

let unsubscribeStatus: (() => void) | null = null;

const isUpdateSupported = () =>
  Boolean(window.electronAPI?.onUpdateStatus && window.electronAPI?.checkForUpdates);

export const useUpdateStore = create<UpdateStore>((set, get) => ({
  supported: isUpdateSupported(),
  appVersion: '',
  status: null,
  manualCheck: false,
  dismissedVersion: null,

  init: () => {
    if (!isUpdateSupported()) {
      set({ supported: false });
      return;
    }

    set({ supported: true });

    if (!unsubscribeStatus) {
      unsubscribeStatus =
        window.electronAPI?.onUpdateStatus?.((payload) => {
          set((state) => ({
            status: payload,
            appVersion: payload.currentVersion || state.appVersion,
          }));
        }) ?? null;
    }

    void window.electronAPI?.getAppVersion?.().then((version) => {
      if (version) set({ appVersion: version });
    });

    void window.electronAPI?.getUpdateState?.().then((payload) => {
      if (payload) {
        set((state) => ({
          status: payload,
          appVersion: payload.currentVersion || state.appVersion,
        }));
      }
    });
  },

  dispose: () => {
    unsubscribeStatus?.();
    unsubscribeStatus = null;
  },

  checkNow: async () => {
    if (!window.electronAPI?.checkForUpdates) return;

    set({ manualCheck: true, dismissedVersion: null });
    await window.electronAPI.checkForUpdates(false);
  },

  download: async () => {
    await window.electronAPI?.downloadUpdate?.();
  },

  install: async () => {
    await window.electronAPI?.installUpdate?.();
  },

  dismiss: () => {
    const version = get().status?.info?.version ?? 'unknown';
    set({ dismissedVersion: version, manualCheck: false });
  },
}));
