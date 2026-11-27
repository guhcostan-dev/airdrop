import { AppState, type AppStateStatus } from "react-native";
import { getConstants, getNative } from "./native";
import type {
  AirdropConfig,
  AirdropState,
  CheckResult,
  InstallMode,
  SyncOptions,
  SyncResult,
  SyncStatus,
  UpdateManifest,
} from "./types";

let config: AirdropConfig = {};
let syncInFlight: Promise<SyncResult> | null = null;
let appReadyPromise: Promise<void> | null = null;
let resumeSubscription: { remove(): void } | null = null;

export function configure(next: AirdropConfig): void {
  config = { ...config, ...next };
}

function resolved() {
  const c = getConstants();
  const serverUrl = (config.serverUrl ?? c.serverUrl ?? "").replace(/\/+$/, "");
  const appId = config.appId ?? c.appId;
  if (!serverUrl || !appId)
    throw new Error(
      "react-native-airdrop: serverUrl/appId not configured (set them in Info.plist / strings.xml or call configure()).",
    );
  return { ...c, serverUrl, appId, channel: config.channel ?? c.channel ?? "production" };
}

export async function getState(): Promise<AirdropState> {
  const c = getConstants();
  const s = await getNative().getState();
  return {
    enabled: c.enabled,
    platform: c.platform,
    sdkVersion: c.sdkVersion,
    runtimeVersion: c.runtimeVersion,
    channel: config.channel ?? c.channel,
    ...s,
  };
}

async function post(url: string, body: unknown, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function checkForUpdate(): Promise<CheckResult> {
  const c = resolved();
  const state = await getNative().getState();
  const res = await post(
    `${c.serverUrl}/v1/check`,
    {
      appId: c.appId,
      channel: c.channel,
      platform: c.platform,
      runtimeVersion: c.runtimeVersion,
      deviceId: state.deviceId,
      currentUpdateId: state.currentUpdateId,
      sdkVersion: c.sdkVersion,
    },
    config.timeout ?? 10000,
  );
  if (!res.ok) throw new Error(`update check failed: HTTP ${res.status}`);
  const result = (await res.json()) as CheckResult;
  // Never re-offer something this device already rolled back from. An update that is
  // already staged is still reported (sync() then reports it as installed; the native
  // download is a no-op for it).
  if (result.status === "update" && state.failedUpdateIds.includes(result.update.id)) {
    return { status: "noUpdate" };
  }
  if (result.status === "rollbackToEmbedded" && state.currentUpdateId === null) return { status: "noUpdate" };
  return result;
}

export async function downloadUpdate(update: UpdateManifest): Promise<void> {
  await getNative().downloadUpdate(update);
  void reportEvents([{ type: "download", updateId: update.id }]);
}

/** Restart now so a downloaded update (or a rollback) takes effect. */
export function restartApp(): void {
  getNative().restartApp();
}

/** Go back to the bundle embedded in the binary on next launch. */
export function clearUpdates(): Promise<void> {
  return getNative().clearUpdates();
}

async function reportEvents(events: { type: string; updateId: string; message?: string }[]): Promise<void> {
  if (!events.length) return;
  try {
    const c = resolved();
    const { deviceId } = await getNative().getState();
    await post(`${c.serverUrl}/v1/events`, { appId: c.appId, deviceId, events }, 5000);
  } catch {
    // Telemetry is best effort.
  }
}

/**
 * Tells the SDK the running bundle works. MUST be called once the app has
 * rendered; if a freshly installed update crashes before this, the next launch
 * rolls back automatically. `withAirdrop` / `sync` call it for you.
 */
export function notifyAppReady(): Promise<void> {
  if (!appReadyPromise) {
    appReadyPromise = getNative()
      .notifyAppReady()
      .then(({ installedUpdateId, rolledBackUpdateIds }) => {
        const events = rolledBackUpdateIds.map((updateId) => ({ type: "rollback", updateId }));
        if (installedUpdateId) events.push({ type: "install", updateId: installedUpdateId });
        void reportEvents(events);
      })
      .catch(() => {
        appReadyPromise = null;
      });
  }
  return appReadyPromise;
}

function applyWhenResumed(minimumBackgroundDuration: number) {
  resumeSubscription?.remove();
  let backgroundedAt = 0;
  resumeSubscription = AppState.addEventListener("change", (next: AppStateStatus) => {
    if (next === "background") backgroundedAt = Date.now();
    else if (next === "active" && backgroundedAt && Date.now() - backgroundedAt >= minimumBackgroundDuration * 1000) {
      resumeSubscription?.remove();
      resumeSubscription = null;
      restartApp();
    }
  });
}

function install(mode: InstallMode, minimumBackgroundDuration: number) {
  if (mode === "immediate") restartApp();
  else if (mode === "nextResume") applyWhenResumed(minimumBackgroundDuration);
}

/**
 * Check, download and schedule installation of the latest update.
 * Safe to call repeatedly; concurrent calls share one run.
 */
export function sync(options: SyncOptions = {}): Promise<SyncResult> {
  if (!syncInFlight) {
    syncInFlight = doSync(options).finally(() => {
      syncInFlight = null;
    });
  }
  return syncInFlight;
}

async function doSync(options: SyncOptions): Promise<SyncResult> {
  const emit = (status: SyncStatus) => options.onStatusChange?.(status);
  try {
    if (!getConstants().enabled) {
      emit("disabled");
      return { status: "disabled" };
    }
    void notifyAppReady();
    emit("checking");
    const result = await checkForUpdate();
    if (result.status === "noUpdate") {
      emit("upToDate");
      return { status: "upToDate" };
    }
    if (result.status === "rollbackToEmbedded") {
      await clearUpdates();
      emit("rolledBackToEmbedded");
      install(options.installMode ?? "nextRestart", options.minimumBackgroundDuration ?? 0);
      return { status: "rolledBackToEmbedded" };
    }
    emit("downloading");
    await downloadUpdate(result.update);
    emit("installed");
    const mode = result.update.mandatory
      ? (options.mandatoryInstallMode ?? "immediate")
      : (options.installMode ?? "nextRestart");
    install(mode, options.minimumBackgroundDuration ?? 0);
    return { status: "installed", update: result.update };
  } catch (err) {
    emit("error");
    return { status: "error", error: err instanceof Error ? err : new Error(String(err)) };
  }
}
