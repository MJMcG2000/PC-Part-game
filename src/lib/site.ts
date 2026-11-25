/**
 * Site navigation and the tip ("Buy me a beer") setting.
 *
 * Tips are a placeholder for now: with no VITE_TIP_URL set, the button opens a
 * "coming soon" message and nothing links to a payment service. To enable tips
 * later, set VITE_TIP_URL (e.g. your tip page) and redeploy.
 */
export interface SitePage {
  label: string;
  href: string;
  description: string;
}

/** Static content pages, in menu order. Keep in sync with the menus in about/accuracy/privacy.html. */
export const SITE_PAGES: SitePage[] = [
  { label: 'About', href: './about.html', description: 'What Rigdle is and how it works' },
  { label: 'FPS accuracy', href: './accuracy.html', description: 'How the estimates compare with benchmarks' },
  { label: 'Privacy', href: './privacy.html', description: 'What data is stored and who handles it' },
];

const raw = (import.meta.env.VITE_TIP_URL ?? '').trim();
/** Tip page URL, or null while tips are a placeholder (only https links are accepted). */
export const TIP_URL: string | null = /^https:\/\//.test(raw) ? raw : null;

export const TIP_LABEL = 'Buy me a beer';
