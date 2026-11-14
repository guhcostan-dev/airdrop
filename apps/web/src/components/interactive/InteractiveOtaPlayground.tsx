import * as React from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Cpu,
  FileCode2,
  KeyRound,
  Layers,
  Lock,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Slider } from "../ui/slider";
import { Switch } from "../ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

const SCENARIOS = [
  {
    id: "checkout",
    label: "Fix Checkout $NaN Bug",
    channel: "production",
    platform: "ios",
    runtime: "2.4.0",
    hash: "7c070454e9b2",
    diffSize: "48 KB gz",
    totalFiles: 38,
    changedFiles: 1,
    cmd: 'airdrop release -p ios -m "Fix currency parser on checkout" --rollout 100',
    bugTitle: "Checkout Total: $NaN",
    bugSub: "TypeError: Cannot read price of undefined",
    fixTitle: "Checkout Total: $42.00",
    fixSub: "Apple Pay & Pix ready · Verified ECDSA P-256",
    codeBefore: `const total = items.reduce(\n  (sum, item) => sum + item.price.amount,\n  0\n); // 💥 Crashes when discount item has flat price`,
    codeAfter: `const total = items.reduce(\n  (sum, item) => sum + (item.price?.amount ?? item.amount ?? 0),\n  0\n); // ✅ Safe fallback shipped OTA in 2.4s`,
  },
  {
    id: "campaign",
    label: "Launch Flash Sale Banner",
    channel: "production",
    platform: "android",
    runtime: "2.4.0",
    hash: "9a41bc82d10f",
    diffSize: "62 KB gz",
    totalFiles: 38,
    changedFiles: 2,
    cmd: 'airdrop release -p android -m "Enable Black Friday 40% banner" --rollout 100',
    bugTitle: "Standard Storefront",
    bugSub: "Waiting 4 days for Play Store review...",
    fixTitle: "⚡ Black Friday 40% OFF Live",
    fixSub: "Hero banner + countdown asset hot-swapped",
    codeBefore: `<PromoBanner\n  active={false}\n  headline="Free shipping over $50"\n/>`,
    codeAfter: `<PromoBanner\n  active={true}\n  badge="LIVE NOW"\n  headline="Black Friday · 40% OFF Everything"\n/>`,
  },
  {
    id: "failover",
    label: "Emergency API Failover",
    channel: "production",
    platform: "ios",
    runtime: "2.4.0",
    hash: "f3189e01a77c",
    diffSize: "31 KB gz",
    totalFiles: 38,
    changedFiles: 1,
    cmd: 'airdrop release -p ios -m "Failover gateway to us-east-2" --mandatory',
    bugTitle: "502 Bad Gateway (us-east-1)",
    bugSub: "Primary payment gateway timeout",
    fixTitle: "Connected: AWS us-east-2 Edge",
    fixSub: "Mandatory hotfix applied immediately on resume",
    codeBefore: `export const API_URL =\n  "https://legacy-us-east-1.acme.internal/v1";`,
    codeAfter: `export const API_URL =\n  "https://airdrop-api.guhcostan.dev/v1"; // Multi-region`,
  },
] as const;

// Deterministic LCG shuffle for the 100-device fleet visual
const FLEET_ORDER = (() => {
  const arr = Array.from({ length: 100 }, (_, i) => i);
  let seed = 1337;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
})();

export function InteractiveOtaPlayground() {
  const [scenarioIdx, setScenarioIdx] = React.useState(0);
  const scenario = SCENARIOS[scenarioIdx]!;

  // Tab 1 state: Live OTA Hotfix
  const [releaseState, setReleaseState] = React.useState<"bug" | "bundling" | "uploading" | "verifying" | "fixed">("fixed");
  const [progress, setProgress] = React.useState(100);

  // Tab 2 state: Staged Canary Rollout
  const [rolloutPct, setRolloutPct] = React.useState(25);
  const [channel, setChannel] = React.useState<"staging" | "production">("production");

  // Tab 3 state: Crash Auto-Rollback
  const [crashStep, setCrashStep] = React.useState<0 | 1 | 2 | 3>(3);

  // Tab 4 state: Zero-Trust Signing
  const [tampered, setTampered] = React.useState(false);

  const runLiveRelease = React.useCallback(() => {
    setReleaseState("bundling");
    setProgress(18);
    const t1 = setTimeout(() => {
      setReleaseState("uploading");
      setProgress(64);
    }, 550);
    const t2 = setTimeout(() => {
      setReleaseState("verifying");
      setProgress(92);
    }, 1150);
    const t3 = setTimeout(() => {
      setReleaseState("fixed");
      setProgress(100);
    }, 1750);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  const triggerBadRelease = () => {
    setCrashStep(0);
    setTimeout(() => setCrashStep(1), 650);
    setTimeout(() => setCrashStep(2), 1450);
    setTimeout(() => setCrashStep(3), 2350);
  };

  const activeSet = React.useMemo(() => {
    const count = channel === "staging" ? 4 : rolloutPct;
    return new Set(FLEET_ORDER.slice(0, count));
  }, [rolloutPct, channel]);

  return (
    <div className="mx-auto max-w-6xl px-5 pt-8">
      <Card className="overflow-hidden border-white/12 bg-[#0B0E1A]/90 shadow-[0_24px_80px_-16px_rgba(139,108,255,0.28)]">
        <Tabs defaultValue="hotfix" className="w-full">
          {/* Top Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-[#080A12]/90 px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="size-3 rounded-full bg-rose-500/80" />
              <span className="size-3 rounded-full bg-amber-400/80" />
              <span className="size-3 rounded-full bg-emerald-400/80" />
              <span className="ml-2 font-mono text-xs text-muted-foreground hidden sm:inline">
                airdrop-interactive-sandbox · v0.2.0
              </span>
            </div>

            <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:grid-cols-4">
              <TabsTrigger value="hotfix">
                <Zap className="size-3.5 text-brand" />
                <span>1. Live Hotfix</span>
              </TabsTrigger>
              <TabsTrigger value="rollout">
                <Activity className="size-3.5 text-cyan-400" />
                <span>2. Staged Rollout</span>
              </TabsTrigger>
              <TabsTrigger value="rollback">
                <RotateCcw className="size-3.5 text-emerald-400" />
                <span>3. Crash Guard</span>
              </TabsTrigger>
              <TabsTrigger value="signing">
                <ShieldCheck className="size-3.5 text-amber-400" />
                <span>4. Zero-Trust Sign</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* TAB 1: LIVE HOTFIX */}
          <TabsContent value="hotfix" className="m-0 p-6 sm:p-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground mr-1">
                  Scenario:
                </span>
                {SCENARIOS.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setScenarioIdx(idx);
                      setReleaseState("bug");
                      setTimeout(() => runLiveRelease(), 300);
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                      scenarioIdx === idx
                        ? "border-brand/60 bg-brand/20 text-white shadow-[0_0_16px_-4px_rgba(139,108,255,0.5)]"
                        : "border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/20 hover:text-white"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setReleaseState("bug");
                    setProgress(0);
                  }}
                >
                  <AlertTriangle className="size-3.5 text-rose-400" />
                  Inject Bug
                </Button>
                <Button size="sm" variant="glow" onClick={runLiveRelease}>
                  <Play className="size-3.5 fill-current" />
                  Push OTA Fix (2.4s)
                </Button>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.25fr_320px]">
              {/* Left: Code Diff + CLI Terminal */}
              <div className="grid gap-4">
                <div className="rounded-xl border border-white/10 bg-[#070911] p-4 font-mono text-xs leading-relaxed">
                  <div className="mb-2.5 flex items-center justify-between border-b border-white/10 pb-2 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <FileCode2 className="size-3.5 text-brand" />
                      src/screens/CheckoutScreen.tsx
                    </span>
                    <Badge variant={releaseState === "fixed" ? "emerald" : "rose"}>
                      {releaseState === "fixed" ? "PATCHED OTA" : "BUG IN PROD"}
                    </Badge>
                  </div>
                  <pre className="overflow-x-auto text-rose-300/80 line-through opacity-70">
                    <code>- {scenario.codeBefore}</code>
                  </pre>
                  <pre className="mt-2 overflow-x-auto text-emerald-300">
                    <code>+ {scenario.codeAfter}</code>
                  </pre>
                </div>

                {/* CLI Output */}
                <div className="rounded-xl border border-white/10 bg-[#070911] p-4 font-mono text-xs leading-6">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-2">
                    <span className="flex items-center gap-1.5">
                      <Terminal className="size-3.5 text-cyan-400" />
                      Terminal — zsh
                    </span>
                    <span>runtimeVersion: {scenario.runtime}</span>
                  </div>
                  <p className="text-white">
                    <span className="text-brand">$</span> {scenario.cmd}
                  </p>
                  {releaseState !== "bug" && (
                    <div className="mt-2 space-y-1 text-muted-foreground">
                      <p>
                        → Bundling React Native ({scenario.platform}) +{" "}
                        <span className="text-cyan-300">hermesc -O -output-source-map</span>…{" "}
                        <span className="text-emerald-400">done (840ms)</span>
                      </p>
                      <p>
                        → Content-addressed SHA-256 scan: {scenario.totalFiles} files ·{" "}
                        <span className="text-amber-300 font-semibold">
                          {scenario.changedFiles} changed ({scenario.diffSize})
                        </span>{" "}
                        · {scenario.totalFiles - scenario.changedFiles} deduplicated on edge
                      </p>
                      <div className="flex items-center gap-3 py-1">
                        <span className="text-xs text-white/80">↑ Uploading diff</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#8B6CFF] to-[#22D3EE] transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-cyan-300">{progress}%</span>
                      </div>
                      {releaseState === "fixed" && (
                        <p className="text-emerald-400 font-medium">
                          ✔ Published update {scenario.hash} · Signed (ECDSA P-256) · Live on AWS + Cloudflare Edge
                        </p>
                      )}
                    </div>
                  )}
                  {releaseState === "bug" && (
                    <p className="mt-3 text-rose-400">
                      ⚠ Production currently running broken bundle. Click &ldquo;Push OTA Fix&rdquo; above to ship the patch.
                    </p>
                  )}
                </div>
              </div>

              {/* Right: Live Phone Frame */}
              <div className="relative mx-auto flex w-full max-w-[300px] flex-col justify-between rounded-[34px] border-2 border-white/15 bg-[#06080F] p-4 shadow-2xl">
                <div className="mx-auto mb-3 h-4 w-24 rounded-full bg-black border border-white/10" />
                <div className="flex-1 rounded-2xl border border-white/10 bg-[#0D1120] p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="font-mono uppercase">{scenario.platform} · v{scenario.runtime}</span>
                      <span className="inline-flex items-center gap-1 text-emerald-400">
                        <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Edge Connected
                      </span>
                    </div>

                    <div className="mt-4 rounded-xl border border-white/10 bg-black/40 p-3.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Item Subtotal</span>
                        <span>$38.00</span>
                      </div>
                      <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
                        <span>Express Delivery</span>
                        <span>$4.00</span>
                      </div>
                      <div className="my-2.5 h-px bg-white/10" />
                      <div className="flex items-center justify-between font-semibold text-sm">
                        <span>Total</span>
                        <span className={releaseState === "fixed" ? "text-emerald-400" : "text-rose-400 font-mono"}>
                          {releaseState === "fixed" ? "$42.00" : "$NaN"}
                        </span>
                      </div>
                    </div>

                    <div
                      className={`mt-3.5 rounded-xl border p-3 transition-all duration-300 ${
                        releaseState === "fixed"
                          ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
                          : "border-rose-500/35 bg-rose-500/10 text-rose-300"
                      }`}
                    >
                      <p className="text-xs font-semibold flex items-center gap-1.5">
                        {releaseState === "fixed" ? (
                          <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="size-4 shrink-0 text-rose-400" />
                        )}
                        {releaseState === "fixed" ? scenario.fixTitle : scenario.bugTitle}
                      </p>
                      <p className="mt-1 text-[11px] opacity-85">
                        {releaseState === "fixed" ? scenario.fixSub : scenario.bugSub}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div
                      className={`w-full rounded-xl py-2.5 text-center text-xs font-semibold transition-all ${
                        releaseState === "fixed"
                          ? "bg-gradient-to-r from-[#8B6CFF] to-[#22D3EE] text-slate-950"
                          : "bg-white/10 text-muted-foreground"
                      }`}
                    >
                      {releaseState === "fixed" ? "Complete Order · $42.00" : "Checkout Unavailable"}
                    </div>
                    <p className="text-center font-mono text-[10px] text-muted-foreground">
                      Bundle: {releaseState === "fixed" ? `ota-${scenario.hash.slice(0, 7)}` : "embedded-store"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: STAGED ROLLOUT */}
          <TabsContent value="rollout" className="m-0 p-6 sm:p-8">
            <div className="grid gap-8 lg:grid-cols-[1fr_360px] items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <Badge variant="cyan">Deterministic SHA-256 Bucketing</Badge>
                  <Badge variant="outline">Zero-Rebuild Channel Promote</Badge>
                </div>
                <h3 className="text-2xl font-semibold tracking-tight">
                  Dial your rollout from 1% to 100% with mathematical precision.
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Airdrop hashes <code className="text-cyan-300 font-mono">SHA-256(deviceId + &quot;:&quot; + updateId)</code> into a deterministic bucket (0–99). When you widen a rollout from 5% to 25%, the original 5% never re-download or flicker.
                </p>

                <div className="mt-6 rounded-xl border border-white/10 bg-[#070911] p-5 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs text-muted-foreground uppercase font-mono">Target Channel</span>
                      <div className="mt-1.5 flex gap-2">
                        <Button
                          size="sm"
                          variant={channel === "staging" ? "default" : "outline"}
                          onClick={() => setChannel("staging")}
                        >
                          staging (QA team)
                        </Button>
                        <Button
                          size="sm"
                          variant={channel === "production" ? "default" : "outline"}
                          onClick={() => setChannel("production")}
                        >
                          production (Fleet)
                        </Button>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-muted-foreground uppercase font-mono">Active Rollout</span>
                      <p className="font-mono text-3xl font-bold text-cyan-300">
                        {channel === "staging" ? "Staging (4 QA)" : `${rolloutPct}%`}
                      </p>
                    </div>
                  </div>

                  {channel === "production" && (
                    <div className="space-y-3">
                      <Slider
                        value={[rolloutPct]}
                        min={1}
                        max={100}
                        step={1}
                        onValueChange={(v) => setRolloutPct(v[0] ?? 25)}
                      />
                      <div className="flex flex-wrap gap-2">
                        {[1, 5, 10, 25, 50, 100].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setRolloutPct(pct)}
                            className={`rounded-md border px-2.5 py-1 font-mono text-xs cursor-pointer transition-colors ${
                              rolloutPct === pct
                                ? "border-cyan-400 bg-cyan-400/15 text-cyan-300"
                                : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-white"
                            }`}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="rounded-lg border border-white/10 bg-black/50 p-3 font-mono text-xs text-emerald-300">
                    $ {channel === "staging"
                      ? "airdrop promote 7c070454 --to production --rollout 25"
                      : `airdrop rollout 7c070454 ${rolloutPct}`}
                  </div>
                </div>
              </div>

              {/* 100-Device Fleet Matrix */}
              <div className="rounded-2xl border border-white/10 bg-[#070911] p-5">
                <div className="mb-3 flex items-center justify-between text-xs">
                  <span className="font-medium text-white">100 Production Devices</span>
                  <span className="font-mono text-cyan-300">{activeSet.size}/100 updated</span>
                </div>
                <div className="grid grid-cols-10 gap-2">
                  {Array.from({ length: 100 }, (_, i) => {
                    const active = activeSet.has(i);
                    return (
                      <div
                        key={i}
                        className={`aspect-square rounded-full transition-all duration-300 ${
                          active
                            ? channel === "staging"
                              ? "bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.7)] scale-105"
                              : "bg-brand shadow-[0_0_10px_rgba(139,108,255,0.65)] scale-105"
                            : "bg-white/10"
                        }`}
                      />
                    );
                  })}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-brand" /> Updated (v42)
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-white/20" /> Running v41
                  </span>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: CRASH AUTO-ROLLBACK */}
          <TabsContent value="rollback" className="m-0 p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <Badge variant="emerald" className="mb-2">Two-Phase Native Launch Protocol</Badge>
                <h3 className="text-2xl font-semibold tracking-tight">
                  If an update crashes before first render, devices heal themselves.
                </h3>
              </div>
              <Button variant="glow" size="sm" onClick={triggerBadRelease}>
                <RotateCcw className="size-3.5" />
                Simulate Bad Update &amp; Auto-Rollback
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              {[
                {
                  step: 0,
                  title: "1. Stage Pending",
                  status: "pending = v43",
                  desc: "Device downloads v43, verifies SHA-256 & ECDSA P-256 signature, and sets state.json pending = v43.",
                  color: "border-cyan-400/40 bg-cyan-400/10 text-cyan-300",
                },
                {
                  step: 1,
                  title: "2. First Launch",
                  status: "pendingLaunched = true",
                  desc: "Native getJSBundleFile() boots v43 and flips pendingLaunched = true before executing JS.",
                  color: "border-amber-400/40 bg-amber-400/10 text-amber-300",
                },
                {
                  step: 2,
                  title: "3. Uncaught JS Crash",
                  status: "notifyAppReady() missed",
                  desc: "v43 throws an uncaught error on startup before React mounts and calls notifyAppReady().",
                  color: "border-rose-500/40 bg-rose-500/10 text-rose-300",
                },
                {
                  step: 3,
                  title: "4. Instant Rollback",
                  status: "Restored v42 + Blacklisted",
                  desc: "Next launch sees pendingLaunched == true, deletes v43, boots healthy v42, and reports rollback.",
                  color: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
                },
              ].map((item) => {
                const active = crashStep >= item.step;
                return (
                  <div
                    key={item.step}
                    className={`rounded-xl border p-4 transition-all duration-300 ${
                      active ? item.color : "border-white/10 bg-white/[0.02] opacity-40"
                    }`}
                  >
                    <p className="font-mono text-xs uppercase opacity-80">{item.status}</p>
                    <h4 className="mt-1 font-semibold text-white text-base">{item.title}</h4>
                    <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* TAB 4: ZERO-TRUST SIGNING */}
          <TabsContent value="signing" className="m-0 p-6 sm:p-8">
            <div className="grid gap-6 lg:grid-cols-2 items-center">
              <div>
                <Badge variant="amber" className="mb-2">ECDSA P-256 End-to-End Verification</Badge>
                <h3 className="text-2xl font-semibold tracking-tight">
                  Not even a compromised server or CDN can ship code to your users.
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Your private key signs the canonical manifest locally in your CLI or CI. The public key is compiled into{" "}
                  <code className="font-mono text-white">Info.plist</code> and{" "}
                  <code className="font-mono text-white">strings.xml</code>. Native Objective-C (<code className="font-mono">SecKeyVerifySignature</code>) and Android Java (<code className="font-mono">SHA256withECDSA</code>) verify every byte before staging.
                </p>

                <div className="mt-5 flex items-center justify-between rounded-xl border border-white/12 bg-[#070911] p-4">
                  <div>
                    <p className="text-sm font-medium text-white">Simulate MITM / Tampered Server Bundle</p>
                    <p className="text-xs text-muted-foreground">
                      Modify 1 byte in <code className="font-mono">main.jsbundle</code> without the private key
                    </p>
                  </div>
                  <Switch checked={tampered} onCheckedChange={setTampered} aria-label="Toggle tamper simulation" />
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#070911] p-5 font-mono text-xs space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <span className="text-muted-foreground">Canonical Signing Envelope</span>
                  <Badge variant={tampered ? "rose" : "emerald"}>
                    {tampered ? "ERR_SIGNATURE · REJECTED" : "VERIFIED P-256"}
                  </Badge>
                </div>
                <pre className="overflow-x-auto text-[11px] leading-5 text-slate-300">
{`airdrop-v1
runtimeVersion: 2.4.0
platform: ios
launchAsset: main.jsbundle:${tampered ? "deadbeef9999... (TAMPERED)" : "e3b0c44298fc1c149afbf4c8996fb924"}:612480
asset: assets/logo.png:8f434346648f6b96df89dda901c5176b:14200`}
                </pre>
                <div
                  className={`rounded-lg border p-3 ${
                    tampered
                      ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                      : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  }`}
                >
                  {tampered ? (
                    <p className="flex items-center gap-2">
                      <ShieldAlert className="size-4 shrink-0" />
                      Native SDK aborted staging: ECDSA signature mismatch against embedded Info.plist public key.
                    </p>
                  ) : (
                    <p className="flex items-center gap-2">
                      <ShieldCheck className="size-4 shrink-0" />
                      Signature verified by native OS CryptoKit / JCA. Update staged safely.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
