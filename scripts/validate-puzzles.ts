/**
 * npm run validate-puzzles [-- --days 365 --start YYYY-MM-DD]
 * Generates upcoming puzzles, checks validity/variety, prints distributions.
 */
import { catalog } from '../src/lib/data';
import { toDateKey } from '../src/lib/date';
import { FPS_TARGETS } from '../src/lib/config';
import { analyzeSequence } from '../src/lib/validate';

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const days = Number(arg('days') ?? 365);
const start = arg('start') ?? toDateKey(new Date());

const r = analyzeSequence(start, days, catalog);

const bar = (n: number, max: number) => '█'.repeat(Math.round((n / max) * 30));
function table<K>(title: string, m: Map<K, number>, sort: (a: [K, number], b: [K, number]) => number) {
  const rows = [...m.entries()].sort(sort);
  const max = Math.max(...m.values());
  const w = Math.max(...rows.map(([k]) => String(k).length));
  console.log(`\n${title} (${rows.length} distinct)`);
  for (const [k, n] of rows) console.log(`  ${String(k).padEnd(w)}  ${String(n).padStart(4)}  ${bar(n, max)}`);
}

console.log(`Rigdle puzzle validation: ${days} days from ${start}`);
console.log(`Pool: ${catalog.games.length} games, ${catalog.cpus.length} CPUs, ${catalog.gpus.length} GPUs, ${catalog.ram.length} RAM options`);

table('FPS targets', r.targetCounts, (a, b) => FPS_TARGETS.indexOf(a[0] as never) - FPS_TARGETS.indexOf(b[0] as never));
table('Resolutions', r.resolutionCounts, () => 0);
table('Daily puzzles by platform', r.platformCounts, (a, b) => b[1] - a[1]);
table('Playable games per platform (Endless pool)', r.playableByPlatform, () => 0);
table('Games', r.gameCounts, (a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
const tierSort = <T extends { name: string }>(list: T[]) => (a: [string, number], b: [string, number]) =>
  list.findIndex((x) => x.name === a[0]) - list.findIndex((x) => x.name === b[0]);
table('CPU answers', r.answerCounts.cpu, tierSort(catalog.cpus));
table('GPU answers', r.answerCounts.gpu, tierSort(catalog.gpus));
table('RAM answers (GB)', r.answerCounts.ram, (a, b) => a[0] - b[0]);

const avgRerolls = r.puzzles.reduce((s, p) => s + p.rerolls, 0) / r.puzzles.length;
console.log(`\nAverage rerolls per day: ${avgRerolls.toFixed(2)}`);

if (r.deadGames.length) {
  console.log(`\n⚠ ${r.deadGames.length} game(s) can never produce a valid puzzle (check their coefficients):`);
  for (const g of r.deadGames) console.log(`  - ${g}`);
}

if (r.problems.length) {
  console.error(`\n✖ ${r.problems.length} problem(s):`);
  for (const p of r.problems.slice(0, 50)) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`\n✔ All ${days} puzzles are valid, deterministic, and varied.`);
