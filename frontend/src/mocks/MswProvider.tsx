"use client";

import { useEffect, useState } from "react";
import { USE_MOCKS } from "@/lib/api/config";

/**
 * Boots the MSW worker on the client before rendering children, so the very
 * first API call is already intercepted. No-op when mocking is disabled
 * (NEXT_PUBLIC_API_MOCKING=disabled) — then requests hit the real backend.
 */
// Module-level singleton promise — React StrictMode invokes effects twice in
// dev; starting the MSW worker more than once throws "cannot configure an
// already enabled network". Sharing one start promise makes it idempotent.
let startPromise: Promise<unknown> | null = null;

export function MswProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!USE_MOCKS);

  useEffect(() => {
    if (!USE_MOCKS) return;
    let active = true;
    (async () => {
      if (!startPromise) {
        startPromise = import("./browser").then(({ worker }) =>
          worker.start({ onUnhandledRequest: "bypass" }),
        );
      }
      await startPromise;
      if (active) setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}
