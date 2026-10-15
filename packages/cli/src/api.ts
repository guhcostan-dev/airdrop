import type { PublishUpdateRequest } from "@rn-airdrop/core";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface AppInfo {
  id: string;
  name: string;
  signingPublicKey: string | null;
  plan?: string;
  createdAt: string;
}

export interface UsageInfo {
  month: string;
  plan: string;
  activeDevices: number;
  activeDevicesLimit: number | null;
  storageBytes: number;
  storageBytesLimit: number | null;
  overLimit: boolean;
}

export interface UpdateInfo {
  id: string;
  createdAt: string;
  channel: string;
  platform: string;
  runtimeVersion: string;
  message: string | null;
  mandatory: boolean;
  rolloutPercentage: number;
  enabled: boolean;
  totalSize: number;
  signature: string | null;
  stats?: Record<string, number>;
}

export class Api {
  constructor(
    private serverUrl: string,
    private token: string,
  ) {}

  private async request<T>(method: string, path: string, body?: unknown, raw?: Uint8Array): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`${this.serverUrl}${path}`, {
          method,
          headers: {
            authorization: `Bearer ${this.token}`,
            ...(raw ? { "content-type": "application/octet-stream" } : {}),
            ...(body !== undefined ? { "content-type": "application/json" } : {}),
          },
          body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
        });
        if (res.status === 204) return undefined as T;
        const text = await res.text();
        const data = text ? JSON.parse(text) : undefined;
        if (!res.ok) {
          const err = new ApiError(res.status, data?.error ?? `HTTP ${res.status}`);
          // Retry only transient failures.
          if (res.status >= 500) {
            lastError = err;
            await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
            continue;
          }
          throw err;
        }
        return data as T;
      } catch (err) {
        if (err instanceof ApiError) throw err;
        lastError = err;
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      }
    }
    throw lastError;
  }

  listApps() {
    return this.request<{ apps: AppInfo[] }>("GET", "/v1/apps").then((r) => r.apps);
  }
  createApp(name: string, signingPublicKey?: string) {
    return this.request<AppInfo>("POST", "/v1/apps", { name, signingPublicKey });
  }
  getApp(appId: string) {
    return this.request<AppInfo>("GET", `/v1/apps/${appId}`);
  }
  usage(appId: string) {
    return this.request<UsageInfo>("GET", `/v1/apps/${appId}/usage`);
  }
  updateApp(appId: string, patch: { name?: string; signingPublicKey?: string | null; plan?: string }) {
    return this.request<AppInfo>("PATCH", `/v1/apps/${appId}`, patch);
  }
  missingAssets(appId: string, hashes: string[]) {
    return this.request<{ missing: string[] }>("POST", `/v1/apps/${appId}/assets/missing`, { hashes }).then(
      (r) => r.missing,
    );
  }
  uploadAsset(appId: string, hash: string, gzipped: Uint8Array) {
    return this.request<{ hash: string; size: number }>("PUT", `/v1/apps/${appId}/assets/${hash}`, undefined, gzipped);
  }
  publishUpdate(appId: string, update: PublishUpdateRequest) {
    return this.request<UpdateInfo>("POST", `/v1/apps/${appId}/updates`, update);
  }
  listUpdates(appId: string, query: Record<string, string | undefined>) {
    const qs = new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => !!e[1])).toString();
    return this.request<{ updates: UpdateInfo[] }>("GET", `/v1/apps/${appId}/updates${qs ? `?${qs}` : ""}`).then(
      (r) => r.updates,
    );
  }
  patchUpdate(appId: string, id: string, patch: { enabled?: boolean; rolloutPercentage?: number; mandatory?: boolean }) {
    return this.request<UpdateInfo>("PATCH", `/v1/apps/${appId}/updates/${id}`, patch);
  }
  promoteUpdate(appId: string, id: string, body: { channel: string; rolloutPercentage?: number }) {
    return this.request<UpdateInfo>("POST", `/v1/apps/${appId}/updates/${id}/promote`, body);
  }
  createToken(name: string, appId?: string) {
    return this.request<{ id: string; name: string; appId: string | null; token: string }>("POST", "/v1/tokens", {
      name,
      appId,
    });
  }
  listWaitlist() {
    return this.request<{ entries: { email: string; appName: string | null; mau: string | null; createdAt: string }[] }>(
      "GET",
      "/v1/waitlist",
    ).then((r) => r.entries);
  }
}
