import { NativeModules, Platform } from "react-native";
import type { UpdateManifest } from "./types";

export interface NativeConstants {
  platform: "ios" | "android";
  sdkVersion: string;
  enabled: boolean;
  runtimeVersion: string;
  serverUrl: string | null;
  appId: string | null;
  channel: string;
}

export interface NativeAirdrop extends NativeConstants {
  getConstants?: () => NativeConstants;
  getState(): Promise<{
    deviceId: string;
    currentUpdateId: string | null;
    pendingUpdateId: string | null;
    rollbackToEmbeddedPending: boolean;
    failedUpdateIds: string[];
  }>;
  downloadUpdate(manifest: UpdateManifest): Promise<string>;
  notifyAppReady(): Promise<{ installedUpdateId: string | null; rolledBackUpdateIds: string[] }>;
  clearUpdates(): Promise<void>;
  restartApp(): void;
}

const LINKING_ERROR =
  `react-native-airdrop: native module not found. Make sure you rebuilt the app after installing ` +
  (Platform.OS === "ios" ? "(and ran `pod install`)." : "(autolinking should add AirdropPackage).");

export function getNative(): NativeAirdrop {
  const mod = NativeModules.RNAirdrop as NativeAirdrop | undefined;
  if (!mod) throw new Error(LINKING_ERROR);
  return mod;
}

export function getConstants(): NativeConstants {
  const mod = getNative();
  // Interop layer exposes constants via getConstants() on the new architecture.
  return typeof mod.getConstants === "function" ? mod.getConstants() : mod;
}
