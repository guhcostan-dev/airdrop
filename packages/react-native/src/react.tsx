import React, { useEffect, useState, type ComponentType } from "react";
import { AppState } from "react-native";
import { getState, notifyAppReady, sync } from "./client";
import type { AirdropState, SyncOptions, SyncStatus } from "./types";

export interface WithAirdropOptions extends SyncOptions {
  /** When to check: on app start (default) and/or when returning to foreground. */
  checkFrequency?: "onAppStart" | "onAppResume" | "manual";
}

/**
 * Wraps the root component: confirms the running bundle (enabling automatic
 * rollback protection) and syncs according to `checkFrequency`.
 */
export function withAirdrop<P extends object>(Component: ComponentType<P>, options: WithAirdropOptions = {}) {
  function AirdropRoot(props: P) {
    useEffect(() => {
      void notifyAppReady();
      const frequency = options.checkFrequency ?? "onAppStart";
      if (frequency === "manual") return;
      void sync(options);
      if (frequency !== "onAppResume") return;
      const sub = AppState.addEventListener("change", (s) => {
        if (s === "active") void sync(options);
      });
      return () => sub.remove();
    }, []);
    return <Component {...props} />;
  }
  AirdropRoot.displayName = `withAirdrop(${Component.displayName ?? Component.name ?? "Component"})`;
  return AirdropRoot;
}

/** Live view of the updater state, plus a `sync` you can wire to a button. */
export function useAirdrop() {
  const [state, setState] = useState<AirdropState | null>(null);
  const [status, setStatus] = useState<SyncStatus | null>(null);

  const refresh = () =>
    getState()
      .then(setState)
      .catch(() => {});

  useEffect(() => {
    void refresh();
  }, []);

  return {
    state,
    status,
    refresh,
    sync: async (options: SyncOptions = {}) => {
      const result = await sync({
        ...options,
        onStatusChange: (s) => {
          setStatus(s);
          options.onStatusChange?.(s);
        },
      });
      // The run may have been started elsewhere (e.g. withAirdrop on launch) and
      // shared with this call, so its status callbacks went to the other caller.
      setStatus(result.status);
      await refresh();
      return result;
    },
  };
}
