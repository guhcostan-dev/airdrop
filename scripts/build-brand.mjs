import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(path.join(root, "apps/web/package.json"));
const sharp = require("sharp");

const brandDir = path.join(root, "brand");
const webBrandDir = path.join(root, "apps/web/public/brand");
fs.mkdirSync(brandDir, { recursive: true });
fs.mkdirSync(webBrandDir, { recursive: true });

const logoSvg = fs.readFileSync(path.join(brandDir, "logo.svg"), "utf8");
const innerLogo = logoSvg
  .replace(/^<svg[^>]*>/, "")
  .replace(/<\/svg>\s*$/, "");

function wordmarkSvg(theme) {
  const isDark = theme === "dark";
  const textFill = isDark ? "#F8FAFC" : "#090D16";
  const subFill = isDark ? "#94A3B8" : "#475569";
  const pillBg = isDark ? "#131728" : "#F1F5F9";
  const pillBorder = isDark ? "#2E3656" : "#CBD5E1";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 112" fill="none">
  <g transform="translate(8, 8) scale(1.5)">
    ${innerLogo}
  </g>
  <text x="122" y="62" font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="48" font-weight="800" letter-spacing="-1.6" fill="${textFill}">Airdrop</text>
  <rect x="308" y="31" width="124" height="32" rx="16" fill="${pillBg}" stroke="${pillBorder}" stroke-width="1.5"/>
  <circle cx="326" cy="47" r="4.5" fill="#10B981"/>
  <text x="338" y="52" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="13.5" font-weight="700" letter-spacing="0.8" fill="#8B6CFF">OTA ENGINE</text>
  <text x="124" y="88" font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="15.5" font-weight="500" fill="${subFill}">Zero-Trust Over-The-Air Updates for React Native</text>
</svg>`;
}

const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" fill="none">
  <defs>
    <linearGradient id="og-bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#070912"/>
      <stop offset="50%" stop-color="#0B0F1E"/>
      <stop offset="100%" stop-color="#060810"/>
    </linearGradient>
    <radialGradient id="og-glow-1" cx="280" cy="140" r="480" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#8B6CFF" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="#8B6CFF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="og-glow-2" cx="960" cy="480" r="420" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#22D3EE" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#22D3EE" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="og-title-grad" x1="80" y1="220" x2="860" y2="340" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#C4B5FD"/>
      <stop offset="50%" stop-color="#8B6CFF"/>
      <stop offset="100%" stop-color="#22D3EE"/>
    </linearGradient>
    <pattern id="og-grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#ffffff" stroke-opacity="0.04" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#og-bg)"/>
  <rect width="1200" height="630" fill="url(#og-grid)"/>
  <circle cx="280" cy="140" r="480" fill="url(#og-glow-1)"/>
  <circle cx="960" cy="480" r="420" fill="url(#og-glow-2)"/>

  <!-- Top Brand Header -->
  <g transform="translate(80, 66) scale(1.25)">
    ${innerLogo}
  </g>
  <text x="176" y="114" font-family="Inter, -apple-system, sans-serif" font-size="36" font-weight="800" letter-spacing="-1" fill="#F8FAFC">Airdrop</text>
  <rect x="326" y="86" width="276" height="36" rx="18" fill="#12172B" stroke="#2D365A" stroke-width="1.5"/>
  <circle cx="348" cy="104" r="5" fill="#10B981"/>
  <text x="364" y="109" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="13.5" font-weight="600" fill="#CBD5E1">REACT NATIVE 0.71 → 0.87+</text>

  <!-- Main Headline -->
  <text x="80" y="245" font-family="Inter, -apple-system, sans-serif" font-size="68" font-weight="800" letter-spacing="-2.4" fill="#F8FAFC">Ship React Native hotfixes</text>
  <text x="80" y="325" font-family="Inter, -apple-system, sans-serif" font-size="68" font-weight="800" letter-spacing="-2.4" fill="url(#og-title-grad)">in minutes, not store weeks.</text>
  <text x="80" y="388" font-family="Inter, -apple-system, sans-serif" font-size="24" font-weight="400" fill="#94A3B8">End-to-end ECDSA P-256 signing · Automatic crash rollback · SHA-256 diffing · AWS &amp; Cloudflare Edge</text>

  <!-- Terminal & Feature Pills -->
  <rect x="80" y="445" width="675" height="110" rx="18" fill="#0D1222" stroke="#252E4D" stroke-width="1.5"/>
  <circle cx="108" cy="472" r="5.5" fill="#EF4444" fill-opacity="0.8"/>
  <circle cx="126" cy="472" r="5.5" fill="#F59E0B" fill-opacity="0.8"/>
  <circle cx="144" cy="472" r="5.5" fill="#10B981" fill-opacity="0.8"/>
  <text x="108" y="510" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="18.5" fill="#94A3B8">$</text>
  <text x="128" y="510" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="18.5" font-weight="600" fill="#F8FAFC">airdrop release -p ios -m "Fix checkout" --rollout 25</text>
  <text x="108" y="538" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="15.5" fill="#10B981">✔ Signed (ECDSA P-256) · 1 file changed (48 KB gz) · Live on Edge</text>

  <!-- Right Metric Cards -->
  <rect x="780" y="445" width="340" height="110" rx="18" fill="#0D1222" stroke="#252E4D" stroke-width="1.5"/>
  <text x="806" y="492" font-family="Inter, -apple-system, sans-serif" font-size="33" font-weight="800" fill="#22D3EE">95% Lower Cost</text>
  <text x="806" y="526" font-family="Inter, -apple-system, sans-serif" font-size="17.5" fill="#94A3B8">Free to 10K MAU · $19/mo at 100K</text>
</svg>`;

const archSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1120 420" fill="none">
  <defs>
    <linearGradient id="ar-bg" x1="0" y1="0" x2="1120" y2="420" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#090C16"/>
      <stop offset="100%" stop-color="#0D1222"/>
    </linearGradient>
    <linearGradient id="ar-accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#8B6CFF"/>
      <stop offset="100%" stop-color="#22D3EE"/>
    </linearGradient>
  </defs>
  <rect width="1120" height="420" rx="20" fill="url(#ar-bg)" stroke="#1E293B" stroke-width="2"/>
  <text x="40" y="46" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="13" font-weight="700" letter-spacing="1.5" fill="#8B6CFF">ZERO-TRUST OTA ARCHITECTURE · AWS + CLOUDFLARE EDGE</text>
  <text x="40" y="76" font-family="Inter, -apple-system, sans-serif" font-size="24" font-weight="700" fill="#F8FAFC">End-to-End Signed Release Pipeline &amp; Native 2-Phase Crash Rollback</text>

  <!-- Box 1: Developer / CI -->
  <rect x="40" y="110" width="290" height="268" rx="16" fill="#11172A" stroke="#2E3A5C" stroke-width="1.5"/>
  <rect x="60" y="130" width="114" height="26" rx="13" fill="#1E1B4B"/>
  <text x="74" y="147" font-family="ui-monospace, monospace" font-size="11" font-weight="700" fill="#A78BFA">1 · CLI / CI</text>
  <text x="60" y="180" font-family="Inter, sans-serif" font-size="18" font-weight="700" fill="#F8FAFC">airdrop release</text>
  <text x="60" y="206" font-family="Inter, sans-serif" font-size="13" fill="#94A3B8">• Metro bundle + Hermes bytecode</text>
  <text x="60" y="230" font-family="Inter, sans-serif" font-size="13" fill="#94A3B8">• SHA-256 per-file content hashing</text>
  <text x="60" y="254" font-family="Inter, sans-serif" font-size="13" fill="#94A3B8">• Uploads only missing gzipped blobs</text>
  <rect x="60" y="278" width="250" height="78" rx="10" fill="#0B0F1C" stroke="#312E81" stroke-width="1"/>
  <text x="74" y="302" font-family="ui-monospace, monospace" font-size="12" font-weight="700" fill="#22D3EE">ECDSA P-256 Private Key</text>
  <text x="74" y="322" font-family="ui-monospace, monospace" font-size="11" fill="#94A3B8">Signs canonical manifest</text>
  <text x="74" y="340" font-family="ui-monospace, monospace" font-size="11" fill="#10B981">Never leaves laptop / CI</text>

  <!-- Arrow 1 -> 2 -->
  <path d="M336 244H398" stroke="url(#ar-accent)" stroke-width="2.5" stroke-dasharray="5 4"/>
  <polygon points="398,239 408,244 398,249" fill="#22D3EE"/>
  <text x="340" y="230" font-family="ui-monospace, monospace" font-size="10.5" fill="#94A3B8">HTTPS PUT</text>

  <!-- Box 2: AWS + Cloudflare Edge -->
  <rect x="414" y="110" width="300" height="268" rx="16" fill="#11172A" stroke="#2E3A5C" stroke-width="1.5"/>
  <rect x="434" y="130" width="184" height="26" rx="13" fill="#083344"/>
  <text x="448" y="147" font-family="ui-monospace, monospace" font-size="11" font-weight="700" fill="#22D3EE">2 · AWS &amp; EDGE CLOUD</text>
  <text x="434" y="180" font-family="Inter, sans-serif" font-size="18" font-weight="700" fill="#F8FAFC">OTA Control Plane &amp; CDN</text>
  <text x="434" y="206" font-family="Inter, sans-serif" font-size="13" fill="#94A3B8">• Decompresses &amp; verifies SHA-256</text>
  <text x="434" y="230" font-family="Inter, sans-serif" font-size="13" fill="#94A3B8">• AWS S3 / R2 immutable asset store</text>
  <text x="434" y="254" font-family="Inter, sans-serif" font-size="13" fill="#94A3B8">• SQLite / D1 candidate lookup cache</text>
  <rect x="434" y="278" width="260" height="78" rx="10" fill="#0B0F1C" stroke="#1E3A8A" stroke-width="1"/>
  <text x="448" y="302" font-family="ui-monospace, monospace" font-size="12" font-weight="700" fill="#A78BFA">Deterministic Rollout</text>
  <text x="448" y="322" font-family="ui-monospace, monospace" font-size="11" fill="#94A3B8">SHA256(deviceId:updateId) % 100</text>
  <text x="448" y="340" font-family="ui-monospace, monospace" font-size="11" fill="#10B981">Staging → Prod zero-rebuild promote</text>

  <!-- Arrow 2 -> 3 -->
  <path d="M720 244H782" stroke="url(#ar-accent)" stroke-width="2.5" stroke-dasharray="5 4"/>
  <polygon points="782,239 792,244 782,249" fill="#22D3EE"/>
  <text x="724" y="230" font-family="ui-monospace, monospace" font-size="10.5" fill="#94A3B8">Diff + Sig</text>

  <!-- Box 3: Native Device SDK -->
  <rect x="798" y="110" width="282" height="268" rx="16" fill="#11172A" stroke="#2E3A5C" stroke-width="1.5"/>
  <rect x="818" y="130" width="194" height="26" rx="13" fill="#064E3B"/>
  <text x="832" y="147" font-family="ui-monospace, monospace" font-size="11" font-weight="700" fill="#34D399">3 · NATIVE iOS &amp; ANDROID</text>
  <text x="818" y="180" font-family="Inter, sans-serif" font-size="18" font-weight="700" fill="#F8FAFC">RNAirdrop / UpdateManager</text>
  <text x="818" y="206" font-family="Inter, sans-serif" font-size="13" fill="#94A3B8">• Copies unchanged local files</text>
  <text x="818" y="230" font-family="Inter, sans-serif" font-size="13" fill="#94A3B8">• Verifies SHA-256 + ECDSA P-256</text>
  <text x="818" y="254" font-family="Inter, sans-serif" font-size="13" fill="#94A3B8">• Stages pending → pendingLaunched</text>
  <rect x="818" y="278" width="242" height="78" rx="10" fill="#0B0F1C" stroke="#065F46" stroke-width="1"/>
  <text x="832" y="302" font-family="ui-monospace, monospace" font-size="12" font-weight="700" fill="#34D399">Crash Rollback Guard</text>
  <text x="832" y="322" font-family="ui-monospace, monospace" font-size="11" fill="#94A3B8">notifyAppReady() promotes current</text>
  <text x="832" y="340" font-family="ui-monospace, monospace" font-size="11" fill="#F87171">Crash → auto-revert &amp; blacklist</text>
</svg>`;

async function main() {
  const darkSvg = wordmarkSvg("dark");
  const lightSvg = wordmarkSvg("light");
  fs.writeFileSync(path.join(brandDir, "logo-wordmark-dark.svg"), darkSvg);
  fs.writeFileSync(path.join(brandDir, "logo-wordmark-light.svg"), lightSvg);
  fs.writeFileSync(path.join(brandDir, "architecture.svg"), archSvg);
  fs.writeFileSync(path.join(webBrandDir, "architecture.svg"), archSvg);
  fs.writeFileSync(path.join(webBrandDir, "logo.svg"), logoSvg);

  await sharp(Buffer.from(logoSvg)).resize(512, 512).png().toFile(path.join(brandDir, "logo-512.png"));
  await sharp(Buffer.from(logoSvg)).resize(512, 512).png().toFile(path.join(webBrandDir, "logo-512.png"));

  await sharp(Buffer.from(darkSvg)).resize(1120, 224).png().toFile(path.join(brandDir, "logo-wordmark-dark.png"));
  await sharp(Buffer.from(darkSvg)).resize(1120, 224).png().toFile(path.join(webBrandDir, "logo-wordmark-dark.png"));

  await sharp(Buffer.from(lightSvg)).resize(1120, 224).png().toFile(path.join(brandDir, "logo-wordmark-light.png"));
  await sharp(Buffer.from(lightSvg)).resize(1120, 224).png().toFile(path.join(webBrandDir, "logo-wordmark-light.png"));

  await sharp(Buffer.from(ogSvg)).resize(1200, 630).png().toFile(path.join(brandDir, "og.png"));
  await sharp(Buffer.from(ogSvg)).resize(1200, 630).png().toFile(path.join(root, "apps/web/public/og.png"));

  await sharp(Buffer.from(archSvg)).resize(2240, 840).png().toFile(path.join(brandDir, "architecture.png"));
  await sharp(Buffer.from(archSvg)).resize(2240, 840).png().toFile(path.join(webBrandDir, "architecture.png"));

  console.log("Brand assets generated successfully!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
