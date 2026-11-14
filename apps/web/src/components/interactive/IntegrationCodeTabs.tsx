import * as React from "react";
import { Check, Code2, Copy, GitBranch, Layers, Smartphone, Terminal } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

const SNIPPETS = {
  expo: {
    title: "Expo Config Plugin (Zero native edits)",
    badge: "Recommended for Expo SDK 50–57+",
    file: "app.json",
    code: `{
  "expo": {
    "name": "Acme Shop",
    "slug": "acme-shop",
    "version": "2.4.0",
    "plugins": [
      [
        "react-native-airdrop",
        {
          "serverUrl": "https://airdrop-api.guhcostan.dev",
          "appId": "9f1c2d4a-88b1-4c90-a12f-78e9102bc301",
          "publicKey": "BOr8k2...base64UncompressedP256Point...",
          "channel": "production"
        }
      ]
    ]
  }
}`,
    foot: "Run `npx expo prebuild` — Airdrop automatically wires Info.plist, strings.xml, AppDelegate.swift and MainApplication.kt.",
  },
  bare: {
    title: "Bare React Native (iOS Swift + Android Kotlin)",
    badge: "RN 0.71 → 0.87+ · Old & New Arch",
    file: "ios/AppDelegate.swift & android/MainApplication.kt",
    code: `// 1. iOS — AppDelegate.swift
import ReactNativeAirdrop

override func bundleURL() -> URL? {
#if DEBUG
  RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
  RNAirdrop.bundleURL()
#endif
}

// 2. Android — MainApplication.kt
import com.rnairdrop.Airdrop

override val reactHost: ReactHost by lazy {
  getDefaultReactHost(
    context = applicationContext,
    packageList = PackageList(this).packages,
    jsBundleFilePath = Airdrop.getJSBundleFile(applicationContext),
  )
}`,
    foot: "Classic native module with full Fabric & TurboModules interop.",
  },
  react: {
    title: "JS / TypeScript SDK (HOC & Hook API)",
    badge: "Automatic Sync + Custom UI Hook",
    file: "src/App.tsx",
    code: `import React from "react";
import { withAirdrop, useAirdrop, Airdrop } from "react-native-airdrop";

function ReleaseStatusBanner() {
  const { status, update, sync } = useAirdrop();

  if (status === "downloading") {
    return <Banner text="Downloading hotfix from edge..." />;
  }
  if (status === "installed") {
    return (
      <Banner
        text={\`Update \${update?.id.slice(0, 8)} ready\`}
        onPress={() => Airdrop.restartApp()}
      />
    );
  }
  return null;
}

export default withAirdrop(App, {
  checkFrequency: "onAppResume",
  installMode: "nextRestart",
  mandatoryInstallMode: "immediate",
});`,
    foot: "`withAirdrop(App)` automatically calls `notifyAppReady()` after the first render to commit the two-phase launch protocol.",
  },
  ci: {
    title: "GitHub Actions CI/CD Signed OTA Pipeline",
    badge: "Zero-Trust ECDSA Signing in CI",
    file: ".github/workflows/ota-release.yml",
    code: `name: Ship OTA Update
on:
  push:
    branches: [main]

jobs:
  airdrop:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - name: Publish signed OTA bundle to Staging (100%) & Canary Prod (10%)
        env:
          AIRDROP_TOKEN: \${{ secrets.AIRDROP_APP_TOKEN }}
          AIRDROP_PRIVATE_KEY: \${{ secrets.AIRDROP_SIGNING_PRIVATE_KEY }}
        run: |
          npx react-native-airdrop-cli login --token "$AIRDROP_TOKEN"
          printf '%s\\n' "$AIRDROP_PRIVATE_KEY" > /tmp/airdrop.pem
          npx react-native-airdrop-cli release -p ios --channel production --rollout 10 --private-key /tmp/airdrop.pem -m "\${{ github.event.head_commit.message }}"
          npx react-native-airdrop-cli release -p android --channel production --rollout 10 --private-key /tmp/airdrop.pem -m "\${{ github.event.head_commit.message }}"`,
    foot: "Your ECDSA P-256 private key stays in GitHub Secrets and never touches the Airdrop server.",
  },
} as const;

export function IntegrationCodeTabs() {
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  const copyCode = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1600);
    } catch {}
  };

  return (
    <Card className="overflow-hidden border-white/12 bg-[#0B0E1A]/90">
      <Tabs defaultValue="expo" className="w-full">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-[#070911] px-5 py-3.5">
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="expo">
              <Smartphone className="size-3.5 text-brand" />
              Expo Plugin
            </TabsTrigger>
            <TabsTrigger value="bare">
              <Layers className="size-3.5 text-cyan-400" />
              Bare React Native
            </TabsTrigger>
            <TabsTrigger value="react">
              <Code2 className="size-3.5 text-emerald-400" />
              React Hook &amp; HOC
            </TabsTrigger>
            <TabsTrigger value="ci">
              <GitBranch className="size-3.5 text-amber-400" />
              GitHub Actions CI
            </TabsTrigger>
          </TabsList>
        </div>

        {(Object.keys(SNIPPETS) as Array<keyof typeof SNIPPETS>).map((key) => {
          const item = SNIPPETS[key];
          return (
            <TabsContent key={key} value={key} className="m-0 p-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs text-slate-300">{item.file}</span>
                  <Badge variant="brand">{item.badge}</Badge>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyCode(key, item.code)}
                >
                  {copiedKey === key ? (
                    <>
                      <Check className="size-3.5 text-emerald-400" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      Copy snippet
                    </>
                  )}
                </Button>
              </div>
              <pre className="overflow-x-auto rounded-xl border border-white/10 bg-[#060810] p-4 font-mono text-xs sm:text-[13px] leading-relaxed text-slate-200">
                <code>{item.code}</code>
              </pre>
              <p className="mt-3 text-xs text-muted-foreground">{item.foot}</p>
            </TabsContent>
          );
        })}
      </Tabs>
    </Card>
  );
}
