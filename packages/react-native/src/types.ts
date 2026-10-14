export type Platform = "ios" | "android";

export interface ServedFile {
  path: string;
  hash: string;
  size: number;
  url: string;
}

export interface UpdateManifest {
  id: string;
  createdAt: string;
  channel: string;
  platform: Platform;
  runtimeVersion: string;
  message: string | null;
  mandatory: boolean;
  launchAsset: ServedFile;
  assets: ServedFile[];
  signature: string | null;
}

export type CheckResult =
  | { status: "noUpdate" }
  | { status: "update"; update: UpdateManifest }
  | { status: "rollbackToEmbedded" };

/**
 * - `nextRestart`: apply the next time the app is cold-started (default, invisible to users).
 * - `nextResume`: apply when the app returns from background after `minimumBackgroundDuration`.
 * - `immediate`: restart now.
 */
export type InstallMode = "nextRestart" | "nextResume" | "immediate";

export interface AirdropConfig {
  /** Defaults to Info.plist `AirdropServerURL` / Android `airdrop_server_url`. */
  serverUrl?: string;
  /** Defaults to Info.plist `AirdropAppId` / Android `airdrop_app_id`. */
  appId?: string;
  /** Defaults to native config, else "production". */
  channel?: string;
  /** Request timeout for the update check, in ms. Default 10s. */
  timeout?: number;
}

export interface SyncOptions {
  installMode?: InstallMode;
  /** Install mode used when the update is mandatory. Default `immediate`. */
  mandatoryInstallMode?: InstallMode;
  /** Seconds in background before a `nextResume` update is applied. Default 0. */
  minimumBackgroundDuration?: number;
  onStatusChange?: (status: SyncStatus) => void;
}

export type SyncStatus =
  | "checking"
  | "upToDate"
  | "downloading"
  | "installed"
  | "rolledBackToEmbedded"
  | "disabled"
  | "error";

export interface SyncResult {
  status: SyncStatus;
  update?: UpdateManifest;
  error?: Error;
}

export interface AirdropState {
  enabled: boolean;
  platform: Platform;
  sdkVersion: string;
  runtimeVersion: string;
  channel: string;
  deviceId: string;
  /** Update this JS is running from, or null when running the embedded bundle. */
  currentUpdateId: string | null;
  /** Downloaded update waiting for a restart. */
  pendingUpdateId: string | null;
  rollbackToEmbeddedPending: boolean;
  failedUpdateIds: string[];
}
