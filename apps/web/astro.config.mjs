// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://airdrop.guhcostan.dev",
  redirects: {
    "/docs/pesquisa-alternativas": "/docs/alternatives",
    "/docs/deploy-cloudflare": "/docs/getting-started",
    "/docs/testing": "/docs",
  },
  // Tailwind v4 + Basecoat are only imported by the landing page (src/styles/landing.css).
  vite: { plugins: [tailwindcss()] },
  integrations: [
    react(),
    starlight({
      title: "Airdrop",
      description: "Self-hosted over-the-air updates for React Native on Cloudflare.",
      logo: { src: "./src/assets/logo.svg", replacesTitle: false },
      favicon: "/favicon.svg",
      head: [
        { tag: "meta", attrs: { property: "og:image", content: "https://airdrop.guhcostan.dev/og.png" } },
        { tag: "meta", attrs: { name: "twitter:card", content: "summary_large_image" } },
      ],
      customCss: ["@fontsource-variable/geist", "@fontsource-variable/geist-mono", "./src/styles/docs.css"],
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/guhcostan-dev/airdrop" }],
      sidebar: [
        {
          label: "Start here",
          items: [
            { label: "Introduction", slug: "docs" },
            { slug: "docs/getting-started" },
            { slug: "docs/how-it-works" },
          ],
        },
        {
          label: "Reference",
          items: [
            { slug: "docs/react-native-sdk" },
            { slug: "docs/cli" },
            { slug: "docs/http-api" },
            { slug: "docs/security" },
          ],
        },
        { label: "Research", items: [{ slug: "docs/alternatives" }] },
      ],
    }),
  ],
});
