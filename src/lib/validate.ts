import { FPS_TARGETS, NO_REPEAT_DAYS, RESOLUTIONS } from './config';
import { addDays } from './date';
import { checkPuzzle, getPuzzle, type Puzzle } from './puzzle';
import type { Catalog } from './types';
import { PLATFORMS, matchesPlatform, repeatKey } from './platforms';

export interface SequenceReport {
  puzzles: Puzzle[];
  problems: string[];
  gameCounts: Map<string, number>;
  targetCounts: Map<number, number>;
  resolutionCounts: Map<string, number>;
  answerCounts: { cpu: Map<string, number>; gpu: Map<string, number>; ram: Map<number, number> };
  /** Games that can never produce a valid puzzle with the current data. */
  deadGames: string[];
  /** Per platform: games that can produce at least one valid puzzle. */
  playableByPlatform: Map<string, number>;
  platformCounts: Map<string, number>;
}

const bump = <K>(m: Map<K, number>, k: K) => m.set(k, (m.get(k) ?? 0) + 1);

/** Generate `days` puzzles from `start` and check validity + variety. */
export function analyzeSequence(start: string, days: number, catalog: Catalog): SequenceReport {
  const puzzles: Puzzle[] = [];
  const problems: string[] = [];
  const gameCounts = new Map<string, number>();
  const targetCounts = new Map<number, number>();
  const platformCounts = new Map<string, number>();
  const resolutionCounts = new Map<string, number>();
  const answerCounts = { cpu: new Map<string, number>(), gpu: new Map<string, number>(), ram: new Map<number, number>() };

  for (let i = 0; i < days; i++) {
    const key = addDays(start, i);
    const p = getPuzzle(key, catalog);
    puzzles.push(p);

    const v = checkPuzzle(p.game, p.targetFps, catalog, p.resolution);
    if (!v.valid) problems.push(`${key}: invalid puzzle (${v.reason})`);
    else if (v.answer.cpu !== p.answer.cpu || v.answer.gpu !== p.answer.gpu || v.answer.ram !== p.answer.ram)
      problems.push(`${key}: stored answer does not match solver`);

    // Determinism: regenerating with a fresh catalog object must match.
    const fresh = getPuzzle(key, { ...catalog });
    if (fresh.game.id !== p.game.id || fresh.targetFps !== p.targetFps || fresh.resolution !== p.resolution)
      problems.push(`${key}: non-deterministic result`);

    bump(gameCounts, `${p.game.name} [${PLATFORMS.find((x) => x.id === p.game.platform)!.short}]`);
    bump(targetCounts, p.targetFps);
    bump(resolutionCounts, p.resolution);
    bump(platformCounts, PLATFORMS.find((x) => x.id === p.game.platform)!.label);
    bump(answerCounts.cpu, catalog.cpus[p.answer.cpu].name);
    bump(answerCounts.gpu, catalog.gpus[p.answer.gpu].name);
    bump(answerCounts.ram, catalog.ram[p.answer.ram].sizeGB);
  }

  // No repeats within the window.
  for (let i = 0; i < puzzles.length; i++) {
    for (let j = Math.max(0, i - NO_REPEAT_DAYS); j < i; j++) {
      if (repeatKey(puzzles[i].game) === repeatKey(puzzles[j].game))
        problems.push(`${puzzles[i].dateKey}: ${puzzles[i].game.name} repeats from ${puzzles[j].dateKey}`);
    }
  }

  // Variety checks.
  const maxTargetShare = Math.max(...targetCounts.values()) / days;
  if (targetCounts.size < Math.min(5, FPS_TARGETS.length))
    problems.push(`Only ${targetCounts.size} distinct FPS targets used`);
  for (const r of RESOLUTIONS) {
    const share = (resolutionCounts.get(r) ?? 0) / days;
    if (share < 0.1) problems.push(`Resolution ${r} only used on ${(share * 100).toFixed(0)}% of days`);
  }
  const handheldDays = puzzles.filter((p) => PLATFORMS.find((x) => x.id === p.game.platform)?.handheld).length;
  if (handheldDays / days > 0.12) problems.push(`Handheld games on ${handheldDays}/${days} days (want at most 12%)`);
  if (maxTargetShare > 0.35) problems.push(`One FPS target covers ${(maxTargetShare * 100).toFixed(0)}% of days`);
  const minGames = Math.min(catalog.games.length, Math.floor(days / 4));
  if (gameCounts.size < minGames) problems.push(`Only ${gameCounts.size} distinct games used (want >= ${minGames})`);
  if (answerCounts.cpu.size < 8) problems.push(`Only ${answerCounts.cpu.size} distinct CPU answers`);
  if (answerCounts.gpu.size < 8) problems.push(`Only ${answerCounts.gpu.size} distinct GPU answers`);
  if (answerCounts.ram.size < 3) problems.push(`Only ${answerCounts.ram.size} distinct RAM answers`);

  const deadGames = catalog.games
    .filter((g) => !FPS_TARGETS.some((t) => RESOLUTIONS.some((r) => checkPuzzle(g, t, catalog, r).valid)))
    .map((g) => g.name);

  const playable = (g: Catalog['games'][number]) =>
    FPS_TARGETS.some((t) => RESOLUTIONS.some((r) => checkPuzzle(g, t, catalog, r).valid));
  const playableByPlatform = new Map<string, number>();
  for (const pl of PLATFORMS) {
    const n = catalog.games.filter((g) => matchesPlatform(g, pl.id) && playable(g)).length;
    playableByPlatform.set(pl.label, n);
    if (n < 10) problems.push(`${pl.label}: only ${n} playable games for Endless mode`);
  }

  return { puzzles, problems, gameCounts, targetCounts, resolutionCounts, answerCounts, deadGames, playableByPlatform, platformCounts };
}
