/**
 * UI Store
 * Manages UI state using Zustand
 */

import { create } from 'zustand';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

interface UIState {
  // Connectivity
  isOnline: boolean;
  connectionType: string | null;

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
  setOnlineStatus: (isOnline: boolean, connectionType?: string | null) => void;
  setGlobalLoading: (loading: boolean, message?: string | null) => void;
  showToast: (type: Toast['type'], message: string, duration?: number) => void;
  hideToast: (id: string) => void;
  openModal: (modalId: string, data?: Record<string, unknown>) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  // Initial state
  isOnline: true,
  connectionType: null,
  globalLoading: false,
  loadingMessage: null,
  toasts: [],
  activeModal: null,
  modalData: null,

  /**
   * Initialize network info listener
   * Returns unsubscribe function
   */
  initializeNetInfo: () => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      set({
        isOnline: state.isConnected ?? false,
        connectionType: state.type,
      });
    });

    // Get initial state
    NetInfo.fetch().then((state) => {
      set({
        isOnline: state.isConnected ?? false,
        connectionType: state.type,
      });
    });

    return unsubscribe;
  },

  /**
   * Manually set online status
   */
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
  showToast: (type: Toast['type'], message: string, duration = 3000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const toast: Toast = { id, type, message, duration };

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
