import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import worker from "./index";
import type { Env } from "./env";

declare const process: { env: Record<string, string | undefined> };
declare const Buffer: {
  from(data: ArrayBuffer | Uint8Array | string, encoding?: string): Uint8Array & { toString(enc?: string): string };
};

interface SqliteStatement {
  get(...params: unknown[]): Record<string, unknown> | undefined;
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): { changes?: number | bigint; lastInsertRowid?: number | bigint };
}

interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS apps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  signing_public_key TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  app_id TEXT REFERENCES apps(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);

CREATE TABLE IF NOT EXISTS updates (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  runtime_version TEXT NOT NULL,
  message TEXT,
  mandatory INTEGER NOT NULL DEFAULT 0,
  rollout_percentage INTEGER NOT NULL DEFAULT 100,
  enabled INTEGER NOT NULL DEFAULT 1,
  manifest TEXT NOT NULL,
  total_size INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS updates_lookup
  ON updates (app_id, channel, platform, runtime_version, created_at DESC);

CREATE TABLE IF NOT EXISTS update_stats (
  update_id TEXT NOT NULL REFERENCES updates(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (update_id, type)
);

CREATE TABLE IF NOT EXISTS waitlist (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  app_name TEXT,
  mau TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS active_devices (
  app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  device TEXT NOT NULL,
  PRIMARY KEY (app_id, month, device)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS assets (
  app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  hash TEXT NOT NULL,
  stored_bytes INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (app_id, hash)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

const DB_PATH = process.env.SQLITE_PATH ?? "/tmp/airdrop.sqlite";
const BUCKET_NAME = process.env.S3_BUCKET ?? "airdrop-assets-177683310249";
const DB_S3_KEY = "_db/airdrop.sqlite";
const s3 = new S3Client({ region: process.env.AWS_REGION ?? "us-east-2" });

let dbInstance: SqliteDatabase | null = null;
let dbLoadedFromS3 = false;
let dirty = false;

async function loadNodeModules(): Promise<{
  DatabaseSync: new (path: string) => SqliteDatabase;
  fs: { existsSync(p: string): boolean; writeFileSync(p: string, d: Uint8Array): void; readFileSync(p: string): Uint8Array };
}> {
  const sqliteMod = (await import(/* @vite-ignore */ "node:sqlite" as string)) as {
    DatabaseSync: new (path: string) => SqliteDatabase;
  };
  const fsMod = (await import(/* @vite-ignore */ "node:fs" as string)) as {
    existsSync(p: string): boolean;
    writeFileSync(p: string, d: Uint8Array): void;
    readFileSync(p: string): Uint8Array;
  };
  return { DatabaseSync: sqliteMod.DatabaseSync, fs: fsMod };
}

async function ensureDb(): Promise<SqliteDatabase> {
  const { DatabaseSync, fs } = await loadNodeModules();
  if (!dbLoadedFromS3) {
    dbLoadedFromS3 = true;
    if (!fs.existsSync(DB_PATH)) {
      try {
        const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: DB_S3_KEY }));
        if (obj.Body) {
          const bytes = await obj.Body.transformToByteArray();
          fs.writeFileSync(DB_PATH, bytes);
        }
      } catch {
        // First initialization: no snapshot in S3 yet
      }
    }
  }
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    dbInstance.exec("PRAGMA journal_mode = DELETE;");
    dbInstance.exec("PRAGMA synchronous = FULL;");
    dbInstance.exec("PRAGMA foreign_keys = ON;");
    dbInstance.exec(SCHEMA_SQL);
  }
  return dbInstance;
}

async function flushDbToS3(): Promise<void> {
  if (!dirty || !dbInstance) return;
  dirty = false;
  try {
    const { fs } = await loadNodeModules();
    const bytes = fs.readFileSync(DB_PATH);
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: DB_S3_KEY,
        Body: bytes,
        ContentType: "application/x-sqlite3",
      }),
    );
  } catch (err) {
    console.error("Failed to sync SQLite snapshot to S3:", err);
  }
}

function createD1Adapter(db: SqliteDatabase): D1Database {
  const sanitize = (vals: unknown[]) => vals.map((v) => (v === undefined ? null : v));
  const makeStmt = (sql: string, bound: unknown[] = []): D1PreparedStatement =>
    ({
      bind(...values: unknown[]) {
        return makeStmt(sql, sanitize(values));
      },
      async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
        const stmt = db.prepare(sql);
        const row = stmt.get(...bound);
        if (!row) return null;
        if (colName) return (row[colName] as T) ?? null;
        return row as T;
      },
      async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
        const stmt = db.prepare(sql);
        const results = stmt.all(...bound) as T[];
        return {
          results,
          success: true,
          meta: {
            changes: 0,
            duration: 0,
            last_row_id: 0,
            served_by: "aws-sqlite",
            internal_stats: null,
            size_after: 0,
            rows_read: results.length,
            rows_written: 0,
            changed_db: false,
          },
        };
      },
      async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
        const stmt = db.prepare(sql);
        const res = stmt.run(...bound);
        dirty = true;
        return {
          results: [],
          success: true,
          meta: {
            changes: Number(res.changes ?? 0),
            last_row_id: Number(res.lastInsertRowid ?? 0),
            duration: 0,
            served_by: "aws-sqlite",
            internal_stats: null,
            size_after: 0,
            rows_read: 0,
            rows_written: Number(res.changes ?? 0),
            changed_db: Number(res.changes ?? 0) > 0,
          },
        };
      },
      async raw(): Promise<never[]> {
        return [];
      },
    }) as unknown as D1PreparedStatement;

  return {
    prepare(sql: string) {
      return makeStmt(sql);
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      const out: D1Result<T>[] = [];
      for (const s of statements) {
        out.push(await s.run<T>());
      }
      return out;
    },
    async exec(sql: string): Promise<D1ExecResult> {
      db.exec(sql);
      dirty = true;
      return { count: 1, duration: 0 };
    },
    async dump(): Promise<ArrayBuffer> {
      return new ArrayBuffer(0);
    },
    withSession() {
      return this as unknown as D1DatabaseSession;
    },
  };
}

function createS3R2Adapter(): R2Bucket {
  return {
    async head(key: string) {
      try {
        const res = await s3.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
        return {
          key,
          size: res.ContentLength ?? 0,
          etag: res.ETag ?? "",
          httpEtag: res.ETag ?? "",
          uploaded: res.LastModified ?? new Date(),
          version: "1",
          checksums: {} as R2Checksums,
          storageClass: "Standard",
          writeHttpMetadata() {},
        };
      } catch {
        return null;
      }
    },
    async get(key: string) {
      try {
        const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
        if (!res.Body) return null;
        const bytes = await res.Body.transformToByteArray();
        const stream = new Blob([bytes]).stream();
        return {
          key,
          size: res.ContentLength ?? bytes.byteLength,
          etag: res.ETag ?? "",
          httpEtag: res.ETag ?? "",
          uploaded: res.LastModified ?? new Date(),
          version: "1",
          checksums: {} as R2Checksums,
          storageClass: "Standard",
          body: stream as unknown as ReadableStream,
          bodyUsed: false,
          bytes: async () => bytes,
          arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
          text: async () => new TextDecoder().decode(bytes),
          json: async <T>() => JSON.parse(new TextDecoder().decode(bytes)) as T,
          blob: async () => new Blob([bytes]),
          writeHttpMetadata() {},
        };
      } catch {
        return null;
      }
    },
    async put(key: string, value: unknown, options?: R2PutOptions) {
      const body =
        value instanceof ArrayBuffer
          ? new Uint8Array(value)
          : value instanceof Uint8Array
            ? value
            : Buffer.from(value as string);
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          Body: body,
          ContentType:
            options?.httpMetadata && "contentType" in options.httpMetadata
              ? options.httpMetadata.contentType
              : "application/octet-stream",
          ContentEncoding:
            options?.httpMetadata && "contentEncoding" in options.httpMetadata
              ? options.httpMetadata.contentEncoding
              : undefined,
          Metadata: options?.customMetadata,
        }),
      );
      return null;
    },
    async delete(keys: string | string[]) {
      const list = Array.isArray(keys) ? keys : [keys];
      if (!list.length) return;
      if (list.length === 1) {
        await s3.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: list[0]! }));
      } else {
        await s3.send(
          new DeleteObjectsCommand({
            Bucket: BUCKET_NAME,
            Delete: { Objects: list.map((Key) => ({ Key })) },
          }),
        );
      }
    },
    async list(options?: R2ListOptions) {
      const res = await s3.send(
        new ListObjectsV2Command({
          Bucket: BUCKET_NAME,
          Prefix: options?.prefix,
          ContinuationToken: options?.cursor,
          MaxKeys: options?.limit ?? 1000,
        }),
      );
      return {
        objects: (res.Contents ?? []).map((o) => ({
          key: o.Key ?? "",
          size: o.Size ?? 0,
          etag: o.ETag ?? "",
          httpEtag: o.ETag ?? "",
          uploaded: o.LastModified ?? new Date(),
          version: "1",
          checksums: {} as R2Checksums,
          storageClass: "Standard",
          writeHttpMetadata() {},
        })),
        truncated: Boolean(res.IsTruncated),
        cursor: res.NextContinuationToken ?? "",
        delimitedPrefixes: [],
      } as unknown as R2Objects;
    },
  } as unknown as R2Bucket;
}

export async function handler(event: Record<string, any>) {
  const db = await ensureDb();
  const forwardedHost = event.headers?.["x-forwarded-host"];
  const host = forwardedHost ?? event.requestContext?.domainName ?? event.headers?.host ?? "localhost";
  const proto = event.headers?.["x-forwarded-proto"] ?? "https";
  const rawPath = event.rawPath ?? "/";
  const qs = event.rawQueryString ? `?${event.rawQueryString}` : "";
  const url = `${proto}://${host}${rawPath}${qs}`;
  const method = event.requestContext?.http?.method ?? event.httpMethod ?? "GET";

  const headers = new Headers();
  for (const [k, v] of Object.entries(event.headers ?? {})) {
    if (typeof v === "string") headers.set(k, v);
  }
  if (Array.isArray(event.cookies) && event.cookies.length > 0) {
    headers.set("cookie", event.cookies.join("; "));
  }

  let body: BodyInit | undefined;
  if (event.body && method !== "GET" && method !== "HEAD") {
    body = event.isBase64Encoded ? Buffer.from(event.body, "base64") : event.body;
  }

  const pendingTasks: Promise<unknown>[] = [];
  const ctx = {
    waitUntil(p: Promise<unknown>) {
      pendingTasks.push(p);
    },
    passThroughOnException() {},
    props: {},
  } as unknown as ExecutionContext;

  const env: Env = {
    DB: createD1Adapter(db),
    BUCKET: createS3R2Adapter(),
    ADMIN_TOKEN: process.env.ADMIN_TOKEN,
    CHECK_CACHE_TTL: process.env.CHECK_CACHE_TTL ?? "0",
    PUBLIC_URL: process.env.PUBLIC_URL,
    WEB_ORIGINS: process.env.WEB_ORIGINS ?? "https://airdrop.guhcostan.dev,https://airdrop-web.guhcostan.workers.dev",
    USAGE_FLUSH_MS: "0",
    SITE_URL: process.env.SITE_URL ?? "https://airdrop.guhcostan.dev",
  };

  const req = new Request(url, { method, headers, body });
  const res = await worker.fetch(req, env, ctx);
  await Promise.allSettled(pendingTasks);
  await flushDbToS3();

  const outHeaders: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    outHeaders[k] = v;
  });
  outHeaders["x-powered-by"] = "airdrop-aws-lambda";
  outHeaders["x-aws-region"] = process.env.AWS_REGION ?? "us-east-2";

  const arrayBuf = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") ?? "";
  const isGzip = res.headers.get("content-encoding") === "gzip";
  const isBinary = isGzip || contentType.includes("octet-stream");

  if (isGzip && event.headers?.["x-cloudflare-proxy"] === "1") {
    delete outHeaders["content-encoding"];
    outHeaders["x-airdrop-gzip"] = "1";
  }

  if (isBinary) {
    return {
      statusCode: res.status,
      headers: outHeaders,
      body: Buffer.from(arrayBuf).toString("base64"),
      isBase64Encoded: true,
    };
  }

  return {
    statusCode: res.status,
    headers: outHeaders,
    body: Buffer.from(arrayBuf).toString("utf8"),
    isBase64Encoded: false,
  };
}
