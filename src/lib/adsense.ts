/**
 * Google AdSense configuration. Ads stay completely off (no script, no ad
 * markup) unless VITE_ADSENSE_CLIENT is set to a valid publisher ID.
 * Used both by vite.config.ts (to inject the loader script) and by <AdSlot>.
 */
const CLIENT_RE = /^ca-pub-\d{16}$/;

/** Returns the publisher ID if it looks like `ca-pub-` + 16 digits, else null. */
export function normalizeAdsenseClient(raw: string | undefined | null): string | null {
  const v = (raw ?? '').trim();
  return CLIENT_RE.test(v) ? v : null;
}

/** The loader <script> tag for a publisher ID. */
export function adsenseScriptTag(client: string): string {
  return `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}" crossorigin="anonymous"></script>`;
}
