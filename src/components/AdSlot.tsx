import { useEffect, useRef } from 'react';
import { normalizeAdsenseClient } from '../lib/adsense';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const CLIENT = normalizeAdsenseClient(import.meta.env.VITE_ADSENSE_CLIENT);

interface Props {
  /** AdSense ad unit ID. */
  slot: string | undefined;
}

/**
 * One AdSense display unit. Renders nothing unless a valid publisher ID
 * (VITE_ADSENSE_CLIENT) and a slot ID are configured. Reserves a fixed height
 * so the page doesn't jump when the ad loads, and is labeled "Advertisement".
 *
 * Placement rules (AdSense policy): keep it outside the board, part pickers
 * and modals, and away from buttons so it can't be clicked by accident.
 */
export function AdSlot({ slot }: Props) {
  const pushed = useRef(false);
  const enabled = Boolean(CLIENT && slot && /^\d+$/.test(slot));

  useEffect(() => {
    // Push once per mount; the ref also guards React StrictMode's double effect in dev.
    if (!enabled || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* ad blocked or script not loaded: leave the reserved space empty */
    }
  }, [enabled]);

  if (!enabled) return null;

  return (
    <aside className="ad-slot" aria-label="Advertisement">
      <span className="ad-label">Advertisement</span>
      {/* Size comes from CSS (.ad-unit), so data-ad-format is intentionally omitted. */}
      <ins className="adsbygoogle ad-unit" data-ad-client={CLIENT!} data-ad-slot={slot} />
    </aside>
  );
}
