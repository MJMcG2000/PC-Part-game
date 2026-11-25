import { HINT_AFTER_GUESSES } from './config';
import type { BrandAnswers } from './solver';
import type { Catalog, Game, PartKey } from './types';
import { formatMemory } from './types';

export interface HintLine {
  part: PartKey;
  text: string;
}

/**
 * The hint shown once a puzzle has had HINT_AFTER_GUESSES guesses without a
 * win. For each part not found yet: the launch year of the answer of the
 * brand the player has selected (or a nudge to switch brands when that brand
 * can't reach the target), and the game's recommended RAM.
 */
export function hintLines(
  game: Game,
  answers: BrandAnswers,
  catalog: Catalog,
  brands: { cpu: string; gpu: string },
  found: Record<PartKey, boolean>,
): HintLine[] {
  const lines: HintLine[] = [];
  if (!found.cpu) {
    const i = answers.cpu[brands.cpu];
    lines.push({
      part: 'cpu',
      text:
        i === null || i === undefined
          ? `No ${brands.cpu} CPU is fast enough. Switch brands.`
          : `The ${brands.cpu} CPU answer launched in ${catalog.cpus[i].year}.`,
    });
  }
  if (!found.gpu) {
    const i = answers.gpu[brands.gpu];
    lines.push({
      part: 'gpu',
      text:
        i === null || i === undefined
          ? `No ${brands.gpu} GPU is fast enough. Switch brands.`
          : `The ${brands.gpu} GPU answer launched in ${catalog.gpus[i].year}.`,
    });
  }
  if (!found.ram) lines.push({ part: 'ram', text: `${game.name} recommends ${formatMemory(game.ramRecGB)} of RAM.` });
  return lines;
}

export const hintUnlocked = (guessCount: number, finished: boolean) => !finished && guessCount >= HINT_AFTER_GUESSES;
