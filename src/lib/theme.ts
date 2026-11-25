/**
 * Light / dark theme. Dark is the default; light is opt-in and remembered in
 * localStorage ("rigdle:theme"). Every HTML page has a tiny inline script in
 * <head> that applies the saved theme before first paint, so there's no flash.
 */
export type Theme = 'dark' | 'light';
export const THEME_KEY = 'rigdle:theme';
const META = { dark: '#0b0d12', light: '#f3f5f9' } as const;

export function currentTheme(): Theme {
  return typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'light') root.dataset.theme = 'light';
  else delete root.dataset.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META[theme]);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* storage unavailable: theme still applies for this visit */
  }
}
