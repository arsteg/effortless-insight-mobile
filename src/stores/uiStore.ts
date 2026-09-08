/**
 * UI Store
 * Manages UI state using Zustand
 */

import { create } from 'zustand';
import { Appearance, ColorSchemeName } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { getThemeMode, setThemeMode as persistThemeMode } from '../services/storage/secure';
import type { ThemeMode } from '../theme/palettes';
import { useOfflineStore } from './offlineStore';
import { summariseSync } from '../utils/syncReporting';
import { getOfflinePreferences } from '../services/offlinePreferences';
import { syncHeldReason } from '../utils/offlinePreferences';

/**
 * An optional button on a toast — the "Undo" affordance for actions that are
 * one tap to perform and otherwise fiddly to reverse (TC-MOB-045).
 */
export interface ToastAction {
  label: string;
  onPress: () => void;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  action?: ToastAction;
}

interface UIState {
  // Connectivity
  isOnline: boolean;
  connectionType: string | null;
  /** Dev-only override; see setForcedOffline. */
  forcedOffline: boolean;

  // Theme
  darkModeEnabled: boolean;
  /** Light, Dark, or follow the OS. */
  themeMode: ThemeMode;
  /** The OS setting, kept live so `system` mode actually follows it. */
  colorScheme: ColorSchemeName;

  // Loading states
  globalLoading: boolean;
  loadingMessage: string | null;

  // Toasts/Notifications
  toasts: Toast[];

  // Modals
  activeModal: string | null;
  modalData: Record<string, unknown> | null;

  // Actions
  initializeNetInfo: () => () => void;
  initializeTheme: () => Promise<() => void>;
  setDarkModeEnabled: (enabled: boolean) => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setOnlineStatus: (isOnline: boolean, connectionType?: string | null) => void;
  /**
   * Force the app to behave as offline regardless of the real network.
   *
   * The iOS Simulator has no airplane mode, and dropping the host's Wi-Fi is
   * not an option over a remote session — it disconnects the operator. This
   * makes the offline paths testable without touching the network.
   */
  setForcedOffline: (forced: boolean) => void;
  /** Drain both offline queues and report the outcome. */
  runReconnectSync: () => Promise<void>;
  setGlobalLoading: (loading: boolean, message?: string | null) => void;
  showToast: (
    type: Toast['type'],
    message: string,
    duration?: number,
    action?: ToastAction
  ) => void;
  hideToast: (id: string) => void;
  openModal: (modalId: string, data?: Record<string, unknown>) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  // Initial state
  isOnline: true,
  connectionType: null,
  forcedOffline: false,
  darkModeEnabled: false,
  themeMode: 'system',
  colorScheme: Appearance.getColorScheme() ?? 'light',
  globalLoading: false,
  loadingMessage: null,
  toasts: [],
  activeModal: null,
  modalData: null,

  /**
   * Initialize theme from storage
   */
  initializeTheme: async () => {
    const mode = await getThemeMode();
    set({
      themeMode: mode,
      darkModeEnabled: mode === 'dark',
      colorScheme: Appearance.getColorScheme() ?? 'light',
    });

    // Follow the OS while in `system` mode. Without this listener the scheme
    // was read once at store creation and never changed again, so "match
    // system theme" could not work (TC-MOB-065).
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      set({ colorScheme: colorScheme ?? 'light' });
    });

    return () => subscription.remove();
  },

  /**
   * Toggle dark mode and persist to storage.
   * Kept for callers that think in terms of a boolean.
   */
  setDarkModeEnabled: async (enabled: boolean) => {
    await get().setThemeMode(enabled ? 'dark' : 'light');
  },

  setThemeMode: async (mode: ThemeMode) => {
    await persistThemeMode(mode);
    set({ themeMode: mode, darkModeEnabled: mode === 'dark' });

    // Deliberately NOT calling Appearance.setColorScheme: overriding the app's
    // reported scheme makes `system` mode unresolvable, because the OS value
    // is then whatever we last wrote. The palette is applied through the theme
    // hooks instead.
  },

  /**
   * Initialize network info listener
   * Returns unsubscribe function
   */
  initializeNetInfo: () => {
    // Treat a captive portal (connected but no real internet) as offline by
    // also honouring isInternetReachable (audit B-netinfo).
    const computeOnline = (state: NetInfoState) =>
      (state.isConnected ?? false) && state.isInternetReachable !== false;

    const handleState = (state: NetInfoState) => {
      const wasOnline = get().isOnline;
      // A forced offline must survive NetInfo's own events, which would
      // otherwise reset it the moment the network reported anything.
      const nowOnline = computeOnline(state) && !get().forcedOffline;
      set({ isOnline: nowOnline, connectionType: state.type });

      // Auto-flush the offline queue on an offline → online transition, instead
      // of relying on the user pressing the banner's Sync button (audit B3).
      if (!wasOnline && nowOnline) {
        void get().runReconnectSync();
      }
    };

    const unsubscribe = NetInfo.addEventListener(handleState);
    NetInfo.fetch().then(handleState);

    return unsubscribe;
  },

  /**
   * Manually set online status
   */
  /**
   * Drain both queues and tell the user what happened.
   *
   * Previously each caller fired the syncs and discarded the results, so a
   * successful sync was invisible and a failed one was indistinguishable from
   * one still in progress — the banner just kept showing a count
   * (TC-MOB-059).
   */
  runReconnectSync: async () => {
    // Respect the Wi-Fi-only preference. Scans are multi-megabyte; uploading
    // them over a metered connection is a real cost (TC-MOB-061).
    const held = syncHeldReason(getOfflinePreferences(), get().connectionType);
    if (held) {
      get().showToast('info', held, 5000);
      return;
    }

    const actions = await useOfflineStore
      .getState()
      .syncQueue()
      .catch(() => ({ processed: 0, failed: 0, conflicts: 0 }));

    const uploads = await import('../services/pendingUploads')
      .then((module) => module.syncPendingUploads())
      .catch(() => ({ uploaded: 0, failed: 0, remaining: 0 }));

    const message = summariseSync({
      actionsProcessed: actions.processed,
      actionsFailed: actions.failed,
      uploadsProcessed: uploads.uploaded,
      uploadsFailed: uploads.failed,
      conflicts: actions.conflicts ?? 0,
    });

    // Longer than a normal toast: this arrives unprompted, often while the
    // user is looking at something else.
    if (message) get().showToast(message.type, message.text, 6000);
  },

  setForcedOffline: (forced: boolean) => {
    set({ forcedOffline: forced });

    if (forced) {
      set({ isOnline: false });
      return;
    }

    // Coming back: re-read the real state and run the same reconnect work a
    // genuine offline → online transition would, so queued actions and
    // pending uploads flush exactly as they do in the field.
    NetInfo.fetch().then((state) => {
      const nowOnline = (state.isConnected ?? false) && state.isInternetReachable !== false;
      set({ isOnline: nowOnline, connectionType: state.type });

      if (nowOnline) {
        void get().runReconnectSync();
      }
    });
  },

  setOnlineStatus: (isOnline: boolean, connectionType: string | null = null) => {
    set({ isOnline, connectionType });
  },

  /**
   * Set global loading state
   */
  setGlobalLoading: (loading: boolean, message: string | null = null) => {
    set({
      globalLoading: loading,
      loadingMessage: message,
    });
  },

  /**
   * Show a toast notification
   */
  showToast: (type: Toast['type'], message: string, duration = 3000, action?: ToastAction) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const toast: Toast = { id, type, message, duration, action };

    set((state) => ({
      toasts: [...state.toasts, toast],
    }));

    // Auto-dismiss
    if (duration > 0) {
      setTimeout(() => {
        get().hideToast(id);
      }, duration);
    }
  },

  /**
   * Hide a toast notification
   */
  hideToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  /**
   * Open a modal
   */
  openModal: (modalId: string, data: Record<string, unknown> = {}) => {
    set({
      activeModal: modalId,
      modalData: data,
    });
  },

  /**
   * Close active modal
   */
  closeModal: () => {
    set({
      activeModal: null,
      modalData: null,
    });
  },
}));
