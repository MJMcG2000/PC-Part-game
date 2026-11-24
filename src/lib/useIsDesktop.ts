import { useEffect, useState } from 'react';

/**
 * Desktop vs. mobile layout check. Width-based (not user-agent sniffing), so it
 * also does the right thing for a narrow desktop window (mobile layout) or a
 * wide landscape tablet (desktop layout), and it updates live on resize/rotate.
 */
export const DESKTOP_QUERY = '(min-width: 960px)';

export function useIsDesktop(query: string = DESKTOP_QUERY): boolean {
  const get = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
  const [isDesktop, setIsDesktop] = useState(get);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(query);
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [query]);

  return isDesktop;
}
