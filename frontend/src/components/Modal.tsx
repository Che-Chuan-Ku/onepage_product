"use client";

import { useEffect } from "react";

interface ModalProps {
  children: React.ReactNode;
  /** false = non-dismissable (no backdrop/esc close), e.g. result overlay */
  dismissable?: boolean;
  onClose?: () => void;
}

/** Overlay dialog — ports prototype ui.js showModal/closeModal semantics. */
export function Modal({ children, dismissable = true, onClose }: ModalProps) {
  useEffect(() => {
    if (!dismissable) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [dismissable, onClose]);

  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (dismissable && e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="modal card pad-lg" role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}
