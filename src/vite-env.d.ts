/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google AdSense publisher ID, e.g. ca-pub-1234567890123456. Unset = no ads. */
  readonly VITE_ADSENSE_CLIENT?: string;
  /** AdSense ad unit (slot) ID for the unit below the game. Unset = no ad unit. */
  readonly VITE_ADSENSE_SLOT?: string;
  /** Optional https tip page for "Buy me a beer". Unset = placeholder message. */
  readonly VITE_TIP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
