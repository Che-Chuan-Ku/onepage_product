"use client";

import { useToast } from "@/lib/store/toast";

/** Global toast host — mount once in the root layout. */
export function ToastHost() {
  const toasts = useToast((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="toast-host">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast ${t.type === "info" ? "" : t.type}`}
          role={t.type === "error" ? "alert" : "status"}
          aria-live={t.type === "error" ? "assertive" : "polite"}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}
