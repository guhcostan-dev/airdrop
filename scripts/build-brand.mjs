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
  const textFill = isDark ? "#F3F3F1" : "#1A1A1A";
  const subFill = isDark ? "#959595" : "#696965";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 112" fill="none">
  <g transform="translate(8, 8) scale(1.5)">
    ${innerLogo}
  </g>
  <text x="122" y="60" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif" font-size="46" font-weight="600" letter-spacing="-1.6" fill="${textFill}">Airdrop</text>
  <text x="124" y="88" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif" font-size="15.5" font-weight="400" fill="${subFill}">Self-hosted OTA updates for React Native</text>
</svg>`;
}

const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" fill="none">
  <rect width="1200" height="630" fill="#0B0B0C"/>
  <radialGradient id="og-soft" cx="50%" cy="18%" r="55%">
    <stop offset="0%" stop-color="#9A9A89" stop-opacity="0.16"/>
    <stop offset="100%" stop-color="#0B0B0C" stop-opacity="0"/>
  </radialGradient>
  <rect width="1200" height="630" fill="url(#og-soft)"/>

  <g transform="translate(84, 72) scale(1.15)">
    ${innerLogo}
  </g>
  <text x="174" y="118" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif" font-size="34" font-weight="600" letter-spacing="-1" fill="#F3F3F1">Airdrop</text>
  <text x="1010" y="116" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="14" fill="#959595">airdrop.guhcostan.dev</text>

  <text x="84" y="255" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif" font-size="68" font-weight="300" letter-spacing="-2.8" fill="#F3F3F1">Sua release.</text>
  <text x="84" y="335" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif" font-size="68" font-weight="300" letter-spacing="-2.8" fill="#B5B5B3">Em um comando.</text>
  <text x="84" y="398" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif" font-size="22" font-weight="400" fill="#959595">ECDSA P-256 · Rollout canário · Rollback automático · AWS S3 + Cloudflare Edge</text>

  <rect x="84" y="454" width="1032" height="100" rx="22" fill="#171718" stroke="#FFFFFF1A" stroke-width="1.5"/>
  <text x="116" y="498" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="19" fill="#959595">$</text>
  <text x="138" y="498" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="19" fill="#F3F3F1">airdrop release --platform ios --channel production --rollout 20</text>
  <text x="116" y="530" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="15.5" fill="#B8CDBB">Assinado com P-256 · 180 KB (Hermes delta) · Disponível no Edge</text>
</svg>`;

const archSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1120 400" fill="none">
  <rect width="1120" height="400" rx="24" fill="#0B0B0C" stroke="#FFFFFF18" stroke-width="1.5"/>
  <text x="40" y="48" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif" font-size="22" font-weight="500" letter-spacing="-0.5" fill="#F3F3F1">Fluxo de release assinado e watchdog nativo</text>
  <text x="40" y="74" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif" font-size="14" fill="#959595">Da máquina de build ao dispositivo, com validação criptográfica antes do boot</text>

  <rect x="40" y="106" width="316" height="252" rx="18" fill="#171718" stroke="#FFFFFF14" stroke-width="1"/>
  <text x="64" y="142" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="12" fill="#B8CDBB">01 · CLI / CI</text>
  <text x="64" y="174" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="18" font-weight="500" fill="#F3F3F1">airdrop release</text>
  <text x="64" y="206" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="13.5" fill="#B5B5B3">Metro bundle + Hermes .hbc</text>
  <text x="64" y="230" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="13.5" fill="#B5B5B3">Hash SHA-256 por arquivo</text>
  <text x="64" y="254" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="13.5" fill="#B5B5B3">Upload apenas do delta faltante</text>
  <rect x="64" y="282" width="268" height="54" rx="10" fill="#111112" stroke="#FFFFFF12" stroke-width="1"/>
  <text x="80" y="306" font-family="ui-monospace, monospace" font-size="12" fill="#F3F3F1">Chave privada P-256 local</text>
  <text x="80" y="324" font-family="ui-monospace, monospace" font-size="11" fill="#959595">Assina o envelope canônico v1</text>

  <path d="M362 232H398" stroke="#FFFFFF40" stroke-width="1.5"/>
  <polygon points="396,228 404,232 396,236" fill="#B8CDBB"/>

  <rect x="408" y="106" width="316" height="252" rx="18" fill="#171718" stroke="#FFFFFF14" stroke-width="1"/>
  <text x="432" y="142" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="12" fill="#B8CDBB">02 · AWS + CLOUDFLARE</text>
  <text x="432" y="174" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="18" font-weight="500" fill="#F3F3F1">Control Plane + Edge</text>
  <text x="432" y="206" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="13.5" fill="#B5B5B3">Valida SHA-256 no upload gzip</text>
  <text x="432" y="230" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="13.5" fill="#B5B5B3">Storage imutável em S3 / R2</text>
  <text x="432" y="254" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="13.5" fill="#B5B5B3">Cache global sem taxa de egresso</text>
  <rect x="432" y="282" width="268" height="54" rx="10" fill="#111112" stroke="#FFFFFF12" stroke-width="1"/>
  <text x="448" y="306" font-family="ui-monospace, monospace" font-size="12" fill="#F3F3F1">Canário determinístico</text>
  <text x="448" y="324" font-family="ui-monospace, monospace" font-size="11" fill="#959595">SHA256(deviceId:updateId) % 100</text>

  <path d="M730 232H766" stroke="#FFFFFF40" stroke-width="1.5"/>
  <polygon points="764,228 772,232 764,236" fill="#B8CDBB"/>

  <rect x="776" y="106" width="304" height="252" rx="18" fill="#171718" stroke="#FFFFFF14" stroke-width="1"/>
  <text x="800" y="142" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="12" fill="#B8CDBB">03 · SDK NATIVO</text>
  <text x="800" y="174" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="18" font-weight="500" fill="#F3F3F1">iOS + Android</text>
  <text x="800" y="206" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="13.5" fill="#B5B5B3">Copia assets inalterados em disco</text>
  <text x="800" y="230" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="13.5" fill="#B5B5B3">Verifica SHA-256 + ECDSA P-256</text>
  <text x="800" y="254" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="13.5" fill="#B5B5B3">Prepara pending para próximo boot</text>
  <rect x="800" y="282" width="256" height="54" rx="10" fill="#111112" stroke="#FFFFFF12" stroke-width="1"/>
  <text x="816" y="306" font-family="ui-monospace, monospace" font-size="12" fill="#F3F3F1">Watchdog em 2 execuções</text>
  <text x="816" y="324" font-family="ui-monospace, monospace" font-size="11" fill="#959595">Crash antes de ready → rollback</text>
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

  await sharp(Buffer.from(archSvg)).resize(2240, 800).png().toFile(path.join(brandDir, "architecture.png"));
  await sharp(Buffer.from(archSvg)).resize(2240, 800).png().toFile(path.join(webBrandDir, "architecture.png"));

  console.log("Brand assets generated successfully!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
