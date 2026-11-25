/**
 * Central tunables for Rigdle. Changing anything here (or in /src/data)
 * changes every puzzle, so treat edits after launch as a "new season".
 */

/** Puzzle #1 is played on this local date (YYYY-MM-DD). */
export const LAUNCH_DATE = '2026-12-01';

/**
 * The deterministic puzzle sequence is replayed from this date so that the
 * "no repeats within N days" rule has history to look at. Must be on or
 * before LAUNCH_DATE. Dates before it are generated without history.
 */
export const SEQUENCE_START = '2026-01-01';

/** Guesses per puzzle in normal mode. */
export const MAX_GUESSES = 6;
/** Guesses per puzzle in Hard mode (exact minimum build only, so it gets more tries). */
export const HARD_MAX_GUESSES = 8;
/** Guess limit for a puzzle. */
export const maxGuesses = (hard: boolean) => (hard ? HARD_MAX_GUESSES : MAX_GUESSES);

/** A hint (answer launch years and recommended RAM) appears after this many guesses without a win. */
export const HINT_AFTER_GUESSES = 3;

/**
 * You also win if your build's estimated FPS is within this fraction of the
 * target (above or below), even if it isn't the exact minimum build.
 */
export const WIN_TOLERANCE = 0.1;

/** Possible daily FPS targets. */
export const FPS_TARGETS = [30, 60, 90, 120, 144, 165, 240] as const;

/** A game may not appear again within this many previous days. */
export const NO_REPEAT_DAYS = 30;

/**
 * Relative chance of picking a handheld game (Game Boy/GBA, DS, 3DS) for a
 * puzzle, compared with any other game. They're valid at almost every target,
 * so without this they'd show up far more than their share.
 */
export const HANDHELD_WEIGHT = 0.15;

/** Upper bound on deterministic rerolls before falling back to a scan. */
export const MAX_REROLLS = 1000;

// ---------------------------------------------------------------------------
// FPS model
// ---------------------------------------------------------------------------

export type Resolution = '1080p' | '1440p' | '4K';
export type Preset = 'Low' | 'Medium' | 'High' | 'Ultra';

/** Resolutions a puzzle can ask for (picked by the daily seed with the game and FPS). */
export const RESOLUTIONS: readonly Resolution[] = ['1080p', '1440p', '4K'];

/** Default resolution (used when none is given) and the fixed graphics preset. */
export const RESOLUTION: Resolution = '1080p';
export const PRESET: Preset = 'High';

/** GPU throughput multiplier relative to 1080p. */
export const RESOLUTION_GPU_SCALE: Record<Resolution, number> = {
  '1080p': 1,
  '1440p': 0.72,
  '4K': 0.38, // 0.42 before the 2026-11 accuracy study: reviews show 4K at ~47-55% of 1440p
};

/** VRAM requirement multiplier relative to 1080p. */
export const RESOLUTION_VRAM_SCALE: Record<Resolution, number> = {
  '1080p': 1,
  '1440p': 1.2,
  '4K': 1.5,
};

/** GPU / CPU throughput multipliers relative to the High preset. */
export const PRESET_GPU_SCALE: Record<Preset, number> = { Low: 1.6, Medium: 1.3, High: 1, Ultra: 0.8 };
export const PRESET_CPU_SCALE: Record<Preset, number> = { Low: 1.12, Medium: 1.06, High: 1, Ultra: 0.95 };

/** gpuFps is multiplied by this when the card has less VRAM than the game needs. */
export const VRAM_PENALTY = 0.6;

/** RAM multipliers: >= recommended, >= minimum, below minimum. */
export const RAM_MULT_REC = 1.0;
export const RAM_MULT_MIN = 0.85;
export const RAM_MULT_BELOW = 0.5;

/** Tolerance for floating point comparisons against the target. */
export const FPS_EPSILON = 1e-6;
