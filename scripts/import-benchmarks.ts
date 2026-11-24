/**
 * npm run import-benchmarks -- results.csv [--dry-run]
 *
 * Merges benchmark results from a CSV file into src/data/benchmarks.json.
 * CSV columns (header row required, any order):
 *   game, kind, part, resolution, fps, source, url, tested
 * - kind: "gpu" (GPU-limited result at a resolution) or "cpu" (CPU-limited result)
 * - resolution: 1080p, 1440p or 4K (required for gpu rows; leave empty for cpu rows)
 * - game / part names must match the data files; close matches are suggested.
 * Rows replace existing entries with the same game + kind + part (+ resolution).
 * See scripts/benchmarks-template.csv.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { catalog } from '../src/lib/data';
import { validateBenchmarks, type BenchmarkEntry } from '../src/lib/benchmarks';
import type { Resolution } from '../src/lib/config';

const file = process.argv.slice(2).find((a) => !a.startsWith('--'));
const dryRun = process.argv.includes('--dry-run');
if (!file) {
  console.error('Usage: npm run import-benchmarks -- <results.csv> [--dry-run]');
  process.exit(1);
}

/** Minimal CSV parser: commas, quoted fields with "" escapes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') row.push(field), (field = '');
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field), rows.push(row), (row = []), (field = '');
    } else field += ch;
  }
  if (field || row.length) row.push(field), rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim()));
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
function resolveName(input: string, names: string[]): { name?: string; hint?: string } {
  const exact = names.find((n) => n === input) ?? names.find((n) => norm(n) === norm(input));
  if (exact) return { name: exact };
  const close = names.filter((n) => norm(n).includes(norm(input)) || norm(input).includes(norm(n))).slice(0, 3);
  return { hint: close.length ? `did you mean ${close.map((c) => `"${c}"`).join(' or ')}?` : 'no close match' };
}

const [header, ...lines] = parseCsv(readFileSync(file, 'utf8'));
const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name);
const idx = Object.fromEntries(['game', 'kind', 'part', 'resolution', 'fps', 'source', 'url', 'tested'].map((c) => [c, col(c)]));
for (const required of ['game', 'kind', 'part', 'fps', 'source']) {
  if (idx[required] < 0) {
    console.error(`Missing required column "${required}".`);
    process.exit(1);
  }
}

const errors: string[] = [];
const incoming: BenchmarkEntry[] = [];
lines.forEach((r, n) => {
  const get = (c: string) => (idx[c] >= 0 ? (r[idx[c]] ?? '').trim() : '');
  const line = n + 2;
  const kind = get('kind').toLowerCase();
  const game = resolveName(get('game'), catalog.games.map((g) => g.name));
  const part = resolveName(get('part'), (kind === 'cpu' ? catalog.cpus : catalog.gpus).map((p) => p.name));
  if (!game.name) return errors.push(`line ${line}: game "${get('game')}" not found (${game.hint})`);
  if (kind !== 'cpu' && kind !== 'gpu') return errors.push(`line ${line}: kind must be cpu or gpu`);
  if (!part.name) return errors.push(`line ${line}: ${kind.toUpperCase()} "${get('part')}" not found (${part.hint})`);
  const res = get('resolution').toUpperCase() === '4K' ? '4K' : get('resolution').toLowerCase();
  const entry: BenchmarkEntry = {
    game: game.name,
    kind,
    part: part.name,
    ...(kind === 'gpu' ? { resolution: res as Resolution } : {}),
    fps: Number(get('fps')),
    source: get('source'),
    ...(get('url') ? { url: get('url') } : {}),
    ...(get('tested') ? { tested: get('tested') } : {}),
  };
  incoming.push(entry);
});

const path = fileURLToPath(new URL('../src/data/benchmarks.json', import.meta.url));
const doc = JSON.parse(readFileSync(path, 'utf8')) as { _comment: string; items: BenchmarkEntry[] };
const key = (e: BenchmarkEntry) => `${e.game}|${e.kind}|${e.part}|${e.kind === 'gpu' ? e.resolution : ''}`;
const merged = new Map(doc.items.map((e) => [key(e), e]));
let replaced = 0;
for (const e of incoming) {
  if (merged.has(key(e))) replaced++;
  merged.set(key(e), e);
}
const items = [...merged.values()].sort((a, b) => key(a).localeCompare(key(b)));
errors.push(...validateBenchmarks(items, catalog.games, catalog.cpus, catalog.gpus));

if (errors.length) {
  console.error(`✖ ${errors.length} problem(s); nothing written:`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`✔ ${incoming.length} row(s) read: ${incoming.length - replaced} new, ${replaced} replaced. Total: ${items.length}.`);
if (dryRun) {
  console.log('(dry run: benchmarks.json not changed)');
} else {
  const body = items.map((i) => '    ' + JSON.stringify(i)).join(',\n');
  writeFileSync(path, `{\n  "_comment": ${JSON.stringify(doc._comment)},\n  "items": [${items.length ? `\n${body}\n  ` : ''}]\n}\n`);
  console.log('Wrote src/data/benchmarks.json. Run npm test and npm run validate-puzzles next.');
}
