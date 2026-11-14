import * as React from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { Card } from "../ui/card";

const FAQS = [
  {
    id: "item-1",
    q: "Is Over-The-Air (OTA) JavaScript updating allowed by Apple App Store and Google Play?",
    a: "Yes. Both Apple (Developer Program License Agreement §3.3.1(B) & Review Guideline 2.5.2) and Google Play explicitly permit updating interpreted JavaScript and assets over the air as long as the update does not alter the primary advertised purpose of the app. Native code (Swift, Objective-C, Kotlin, Java, C++) cannot be updated OTA on any platform and must go through a new store binary—which Airdrop enforces automatically via Runtime Version targeting.",
  },
  {
    id: "item-2",
    q: "How does Airdrop compare to Expo EAS Update, Stallion, and Revopush?",
    a: "Airdrop combines the zero-ops developer experience of managed platforms with complete open-source freedom (MIT). Unlike EAS Update (which charges $449+/mo at 100K MAU plus bandwidth overage fees and locks you into SaaS), Airdrop is Free up to 10K MAU, $19/mo flat up to 100K MAU with $0 bandwidth overages, AND can be self-hosted on your own AWS (S3 + CloudFront + Lambda/EC2) or Cloudflare (Workers + D1 + R2) in under 5 minutes.",
  },
  {
    id: "item-3",
    q: "What happens if an OTA update has a fatal startup bug?",
    a: "Your users stay safe. Every Airdrop update goes through a strict two-phase native launch protocol (pending → pendingLaunched → notifyAppReady()). If a newly downloaded bundle crashes before your root component mounts and calls notifyAppReady(), the very next launch automatically reverts to the previous healthy bundle, blacklists the broken update ID on that device, and sends a rollback telemetry event to your dashboard.",
  },
  {
    id: "item-4",
    q: "Can a compromised OTA server or CDN push malicious code to our users?",
    a: "No—when you enable ECDSA P-256 code signing (`airdrop init --sign`), your private key never leaves your developer machine or CI runner. Your app binary embeds only the public key in `Info.plist` / `strings.xml`. Native Objective-C and Android Java verify the cryptographic signature of the manifest and the SHA-256 hash of every single file before staging. Even if the server were compromised, unsigned or modified bundles are rejected immediately.",
  },
  {
    id: "item-5",
    q: "Does Airdrop work with Bare React Native, Expo, and the New Architecture (Fabric / TurboModules)?",
    a: "Yes. Airdrop supports React Native 0.71 through 0.87+, both Old and New Architecture (Bridgeless / Fabric / TurboModules), Hermes bytecode and JSC, on iOS and Android. For Expo apps (development builds / prebuild), add `\"react-native-airdrop\"` to `plugins` in `app.json` and run `npx expo prebuild`—no manual Objective-C, Swift, or Kotlin edits required.",
  },
  {
    id: "item-6",
    q: "How does per-file differential downloading work?",
    a: "Every file in an update (your Hermes bytecode bundle, images, fonts) is content-addressed by its uncompressed SHA-256 hash and stored gzip-compressed on the edge. When you publish a release, the CLI uploads only the files that changed. When a device downloads an update, it copies unchanged assets directly from its local cache and downloads only the delta.",
  },
  {
    id: "item-7",
    q: "We are migrating from Microsoft App Center CodePush. How long does it take?",
    a: "Usually less than an hour. The concepts map 1:1: `codePush(App)` becomes `withAirdrop(App)`, `codePush.sync()` becomes `Airdrop.sync()`, `codePush.notifyAppReady()` becomes `Airdrop.notifyAppReady()`, and deployments become channels (`staging`, `production`). Even better, promoting a signed release from `staging` to `production` keeps its cryptographic signature valid without rebuilding.",
  },
];

export function FaqAccordion() {
  return (
    <Card className="border-white/12 bg-[#0B0E1A]/90 px-6 py-2">
      <Accordion type="single" collapsible defaultValue="item-1" className="w-full">
        {FAQS.map((f) => (
          <AccordionItem key={f.id} value={f.id}>
            <AccordionTrigger>{f.q}</AccordionTrigger>
            <AccordionContent>{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </Card>
  );
}
