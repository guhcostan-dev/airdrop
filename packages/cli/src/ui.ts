const color = (code: number) => (s: string) => (process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
export const c = { green: color(32), yellow: color(33), red: color(31), dim: color(2), bold: color(1), cyan: color(36) };

export const log = {
  info: (msg: string) => console.log(msg),
  ok: (msg: string) => console.log(`${c.green("✔")} ${msg}`),
  warn: (msg: string) => console.warn(`${c.yellow("!")} ${msg}`),
  error: (msg: string) => console.error(`${c.red("✖")} ${msg}`),
  dim: (msg: string) => console.log(c.dim(msg)),
};

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function table(rows: Record<string, string>[]): void {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]!);
  const widths = cols.map((col) => Math.max(col.length, ...rows.map((r) => (r[col] ?? "").length)));
  const line = (vals: string[]) => vals.map((v, i) => v.padEnd(widths[i]!)).join("  ");
  console.log(c.bold(line(cols)));
  for (const r of rows) console.log(line(cols.map((col) => r[col] ?? "")));
}
