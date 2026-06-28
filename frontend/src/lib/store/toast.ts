import { create } from "zustand";

export type ToastType = "info" | "error" | "success";
export interface ToastItem {
  id: number;
  msg: string;
  type: ToastType;
}

interface ToastState {
  toasts: ToastItem[];
  push: (msg: string, type?: ToastType, ttl?: number) => void;
  remove: (id: number) => void;
}

let seq = 0;

/** Global non-blocking notifications (ports prototype ui.js `toast`). */
export const useToast = create<ToastState>((set, get) => ({
  toasts: [],
  push: (msg, type = "info", ttl = 3000) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts, { id, msg, type }] }));
    setTimeout(() => get().remove(id), ttl);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative helper for non-component call sites. */
export const toast = (msg: string, type?: ToastType, ttl?: number) =>
  useToast.getState().push(msg, type, ttl);
