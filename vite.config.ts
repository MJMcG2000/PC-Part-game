/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { adsenseScriptTag, normalizeAdsenseClient } from './src/lib/adsense.ts';

/**
 * Inject the AdSense loader into index.html only when VITE_ADSENSE_CLIENT is a
 * valid publisher ID. Without it (local dev, CI, forks) no ad code is loaded.
 */
function adsense(rawClient: string | undefined): Plugin {
  const client = normalizeAdsenseClient(rawClient);
  if (rawClient && !client) {
    console.warn(`[adsense] Ignoring VITE_ADSENSE_CLIENT="${rawClient}": expected ca-pub- followed by 16 digits.`);
  }
  return {
    name: 'rigdle-adsense',
    transformIndexHtml(html, ctx) {
      // Ads only run on the game page, not on About/Privacy.
      if (!client || !ctx.filename.endsWith('index.html')) return html;
      return html.replace('</head>', `    ${adsenseScriptTag(client)}\n  </head>`);
    },
  };
}

const page = (file: string) => fileURLToPath(new URL(file, import.meta.url));

// `base: './'` produces relative asset URLs, so the same build works at the
// root of a custom domain (Cloudflare Pages) and under a GitHub Pages sub-path.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    base: './',
    plugins: [react(), adsense(env.VITE_ADSENSE_CLIENT)],
    build: {
      rollupOptions: {
        // Multi-page build: the game plus crawlable static content pages.
        input: {
          main: page('index.html'),
          about: page('about.html'),
          planner: page('planner.html'),
          games: page('games.html'),
          tiers: page('tiers.html'),
          accuracy: page('accuracy.html'),
          privacy: page('privacy.html'),
        },
      },
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    },
  };
});
