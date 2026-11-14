import * as React from "react";
import { Check, ExternalLink, Minus, Server, Shield, Sparkles, TrendingDown } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Slider } from "../ui/slider";
import { Switch } from "../ui/switch";
import { PROVIDERS, formatMau, formatUsd } from "../../utils/pricing";

interface CompetitorRow {
  capability: string;
  airdrop: string | boolean;
  eas: string | boolean;
  stallion: string | boolean;
  revopush: string | boolean;
  hotUpdater: string | boolean;
  codepush: string | boolean;
}

const MATRIX: CompetitorRow[] = [
  {
    capability: "Free tier monthly active users (MAU)",
    airdrop: "10,000 MAU",
    eas: "1,000 MAU",
    stallion: "10,000 MAU",
    revopush: "1,000 MAU",
    hotUpdater: "Self-hosted",
    codepush: "Retired Mar 2025",
  },
  {
    capability: "Price at 100,000 MAU",
    airdrop: "$19 / mo flat",
    eas: "$449 / mo",
    stallion: "$64 / mo",
    revopush: "$75 / mo",
    hotUpdater: "Cloud bill",
    codepush: false,
  },
  {
    capability: "Price at 500,000 MAU",
    airdrop: "$79 / mo flat",
    eas: "$1,699 / mo",
    stallion: "Custom / Overage",
    revopush: "$250 / mo",
    hotUpdater: "Cloud bill",
    codepush: false,
  },
  {
    capability: "Bandwidth / CDN egress overage fees",
    airdrop: "$0 (Included)",
    eas: "Metered per GB",
    stallion: "Tiered limits",
    revopush: "Tiered limits",
    hotUpdater: "Provider dependent",
    codepush: false,
  },
  {
    capability: "Self-hostable on your own AWS or Cloudflare",
    airdrop: true,
    eas: false,
    stallion: "Enterprise only",
    revopush: false,
    hotUpdater: true,
    codepush: "Archived May 2025",
  },
  {
    capability: "Bare React Native (0.71 → 0.87+) without Expo",
    airdrop: true,
    eas: "Requires expo-updates",
    stallion: true,
    revopush: true,
    hotUpdater: true,
    codepush: "Legacy only",
  },
  {
    capability: "Expo Config Plugin (zero native file edits)",
    airdrop: true,
    eas: true,
    stallion: "Manual setup",
    revopush: "Manual setup",
    hotUpdater: true,
    codepush: false,
  },
  {
    capability: "React Native New Architecture (Fabric & TurboModules)",
    airdrop: true,
    eas: true,
    stallion: true,
    revopush: true,
    hotUpdater: true,
    codepush: "Partial / Broken",
  },
  {
    capability: "End-to-end ECDSA P-256 code signing",
    airdrop: true,
    eas: "RSA code signing",
    stallion: true,
    revopush: true,
    hotUpdater: "Plugin dependent",
    codepush: true,
  },
  {
    capability: "Promote staging → production without re-signing",
    airdrop: true,
    eas: true,
    stallion: true,
    revopush: false,
    hotUpdater: false,
    codepush: false,
  },
  {
    capability: "Automatic native 2-phase crash rollback + blacklist",
    airdrop: true,
    eas: true,
    stallion: true,
    revopush: true,
    hotUpdater: true,
    codepush: true,
  },
  {
    capability: "Content-addressed SHA-256 per-file differential sync",
    airdrop: true,
    eas: true,
    stallion: true,
    revopush: true,
    hotUpdater: true,
    codepush: false,
  },
  {
    capability: "Open-source MIT SDK, CLI & Server protocol",
    airdrop: true,
    eas: "Client only",
    stallion: "Client only",
    revopush: "Client only",
    hotUpdater: true,
    codepush: "Archived",
  },
];

const PRESETS = [10_000, 50_000, 100_000, 250_000, 500_000, 1_000_000];

export function CompetitorMatrix() {
  const [mau, setMau] = React.useState(100_000);
  const [selfHosted, setSelfHosted] = React.useState(false);

  const costs = React.useMemo(() => {
    return PROVIDERS.map((p) => {
      if (p.id === "airdrop" && selfHosted) {
        return {
          ...p,
          estimate: {
            usd: 0,
            plan: "Self-Hosted (AWS / Cloudflare Free Tier)",
            note: "Runs inside free tier up to ~500K MAU",
          },
        };
      }
      return { ...p, estimate: p.cost(mau) };
    });
  }, [mau, selfHosted]);

  const maxCost = Math.max(...costs.map((c) => c.estimate.usd ?? 0), 100);
  const airdropUsd = costs[0]!.estimate.usd ?? 0;
  const easUsd = costs.find((c) => c.id === "eas")?.estimate.usd ?? 0;
  const yearlySavings = Math.max(0, Math.round((easUsd - airdropUsd) * 12));

  const renderCell = (val: string | boolean, highlight = false) => {
    if (val === true) {
      return (
        <span className={`inline-flex items-center justify-center size-6 rounded-full ${highlight ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-slate-300"}`}>
          <Check className="size-3.5" />
        </span>
      );
    }
    if (val === false) {
      return (
        <span className="inline-flex items-center justify-center size-6 rounded-full bg-white/5 text-muted-foreground/50">
          <Minus className="size-3.5" />
        </span>
      );
    }
    return (
      <span className={highlight ? "font-semibold text-white" : "text-muted-foreground"}>
        {val}
      </span>
    );
  };

  return (
    <div className="space-y-14">
      {/* Interactive Cost & ROI Calculator */}
      <Card className="overflow-hidden border-white/12 bg-[#0B0E1A]/90">
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.1fr_1fr] items-center border-b border-white/10">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-brand">
                  Interactive Scale Calculator
                </p>
                <div className="mt-1 flex items-baseline gap-3">
                  <span className="font-mono text-4xl sm:text-5xl font-bold tracking-tight text-white">
                    {formatMau(mau)}
                  </span>
                  <span className="text-sm text-muted-foreground">Monthly Active Users</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#070911] px-3.5 py-2">
                <Server className="size-4 text-cyan-400" />
                <span className="text-xs font-medium text-slate-200">Self-Host on AWS / CF</span>
                <Switch checked={selfHosted} onCheckedChange={setSelfHosted} aria-label="Toggle self-hosted mode" />
              </div>
            </div>

            <Slider
              value={[mau]}
              min={5_000}
              max={1_000_000}
              step={5_000}
              onValueChange={(v) => setMau(v[0] ?? 100_000)}
            />

            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setMau(preset)}
                  className={`rounded-lg border px-3 py-1.5 font-mono text-xs transition-all cursor-pointer ${
                    mau === preset
                      ? "border-brand bg-brand/20 text-white shadow-[0_0_14px_-4px_rgba(139,108,255,0.6)]"
                      : "border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/25 hover:text-white"
                  }`}
                >
                  {formatMau(preset)} MAU
                </button>
              ))}
            </div>

            {yearlySavings > 0 && (
              <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
                <span className="flex items-center gap-2 text-emerald-300 font-medium">
                  <TrendingDown className="size-4 shrink-0" />
                  Annual savings vs Expo EAS Update at {formatMau(mau)} MAU:
                </span>
                <span className="font-mono text-lg font-bold text-emerald-300">
                  ${yearlySavings.toLocaleString("en-US")}/yr
                </span>
              </div>
            )}
          </div>

          {/* Live Comparison Bars */}
          <div className="space-y-4 rounded-xl border border-white/10 bg-[#070911] p-5">
            {costs.map((item) => {
              const usd = item.estimate.usd;
              const isAirdrop = item.id === "airdrop";
              const pct = usd === null ? 100 : Math.max(usd > 0 ? 4 : 0, Math.min(100, (usd / maxCost) * 100));
              return (
                <div key={item.id} className="space-y-1.5">
                  <div className="flex items-baseline justify-between text-xs sm:text-sm">
                    <span className={isAirdrop ? "font-semibold text-white flex items-center gap-1.5" : "text-slate-300"}>
                      {item.name}
                      {isAirdrop && <Badge variant="brand">You</Badge>}
                      <span className="text-[11px] font-normal text-muted-foreground">
                        · {item.estimate.plan}
                      </span>
                    </span>
                    <span className={`font-mono font-semibold ${isAirdrop ? "text-cyan-300 text-base" : "text-slate-200"}`}>
                      {formatUsd(usd)}
                      {usd !== null && <span className="text-xs font-normal text-muted-foreground">/mo</span>}
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isAirdrop
                          ? "bg-gradient-to-r from-[#8B6CFF] to-[#22D3EE]"
                          : usd === null
                            ? "bg-white/20"
                            : "bg-slate-500/60"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Deep Competitor Feature Matrix */}
      <Card className="overflow-hidden border-white/12 bg-[#0B0E1A]/90">
        <div className="border-b border-white/10 px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">
              2026 React Native OTA Architecture &amp; Feature Benchmark
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Side-by-side comparison across managed SaaS platforms and open-source self-hosted engines.
            </p>
          </div>
          <Badge variant="emerald">Verified November 2026</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-[#070911] text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-4 pl-6 pr-4 font-mono">Capability</th>
                <th className="py-4 px-4 font-mono text-brand bg-brand/[0.07]">Airdrop</th>
                <th className="py-4 px-4 font-mono">EAS Update</th>
                <th className="py-4 px-4 font-mono">Stallion</th>
                <th className="py-4 px-4 font-mono">Revopush</th>
                <th className="py-4 px-4 font-mono">Hot Updater</th>
                <th className="py-4 pl-4 pr-6 font-mono">CodePush</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {MATRIX.map((row) => (
                <tr key={row.capability} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5 pl-6 pr-4 font-medium text-slate-200">{row.capability}</td>
                  <td className="py-3.5 px-4 bg-brand/[0.05]">{renderCell(row.airdrop, true)}</td>
                  <td className="py-3.5 px-4">{renderCell(row.eas)}</td>
                  <td className="py-3.5 px-4">{renderCell(row.stallion)}</td>
                  <td className="py-3.5 px-4">{renderCell(row.revopush)}</td>
                  <td className="py-3.5 px-4">{renderCell(row.hotUpdater)}</td>
                  <td className="py-3.5 pl-4 pr-6">{renderCell(row.codepush)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
