/**
 * Fills tiers.html from the same part data the game uses, so the published
 * ladders can never drift from what the tiles compare against.
 */
import { catalog } from './lib/data';
import { formatLaunch, formatMemory, launchKey } from './lib/types';

interface Rung {
  name: string;
  score: number;
  released: number;
  launch: string;
  extra: string;
}

interface Ladder {
  title: string;
  kind: 'CPU' | 'GPU';
  extraLabel: string;
  rungs: Rung[];
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function ladders(): Ladder[] {
  const cpu = (brand: string, title: string): Ladder => ({
    title,
    kind: 'CPU',
    extraLabel: 'RAM type',
    rungs: catalog.cpus
      .filter((c) => c.brand === brand)
      .map((c) => ({ name: c.name, score: c.gamingScore, released: launchKey(c.year, c.month), launch: formatLaunch(c.year, c.month), extra: c.memory })),
  });
  const gpu = (brand: string, title: string): Ladder => ({
    title,
    kind: 'GPU',
    extraLabel: 'VRAM',
    rungs: catalog.gpus
      .filter((g) => g.brand === brand)
      .map((g) => ({ name: g.name, score: g.rasterScore, released: launchKey(g.year, g.month), launch: formatLaunch(g.year, g.month), extra: formatMemory(g.vramGB) })),
  });
  // catalog.cpus / catalog.gpus are already sorted weakest -> strongest (the tile order).
  return [cpu('AMD', 'AMD CPUs'), cpu('Intel', 'Intel CPUs'), gpu('NVIDIA', 'NVIDIA graphics cards'), gpu('AMD', 'AMD graphics cards')];
}

function table(l: Ladder): string {
  const max = Math.max(...l.rungs.map((r) => r.score));
  const rows = [...l.rungs]
    .map((r, i) => ({ r, tier: i + 1, step: i ? r.score / l.rungs[i - 1].score - 1 : null }))
    .reverse()
    .map(
      ({ r, tier, step }) => `<tr>
        <td class="mono">${tier}</td>
        <td>${esc(r.name)}</td>
        <td>${esc(r.launch)}</td>
        <td>${esc(r.extra)}</td>
        <td class="tier-score"><span class="tier-track" aria-hidden="true"><span class="tier-bar" style="width:${Math.max(2, (r.score / max) * 100).toFixed(1)}%"></span></span><span class="mono">${r.score}</span></td>
        <td class="mono">${step === null ? '–' : `+${Math.round(step * 100)}%`}</td>
      </tr>`,
    )
    .join('');
  return `<h3>${esc(l.title)} <small>${l.rungs.length} tiers, strongest first</small></h3>
    <div class="table-wrap"><table class="study-table tier-table">
      <thead><tr><th>Tier</th><th>Part</th><th>Launched</th><th>${l.extraLabel}</th><th>Score</th><th title="Faster than the tier below">Step</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

/** Notable out-of-date-order pairs: a newer part ranked below an older one, close on the ladder. */
function surprises(all: Ladder[]): string[] {
  const found: { gap: number; text: string }[] = [];
  for (const l of all) {
    l.rungs.forEach((newer, i) => {
      for (let j = i + 1; j < Math.min(l.rungs.length, i + 3); j++) {
        const older = l.rungs[j];
        const years = Math.floor(newer.released / 100) - Math.floor(older.released / 100);
        if (years >= 2) {
          found.push({
            gap: years,
            text: `The <strong>${esc(newer.name)}</strong> (${esc(newer.launch)}, tier ${i + 1}) is below the <strong>${esc(older.name)}</strong> (${esc(older.launch)}, tier ${j + 1}).`,
          });
        }
      }
    });
  }
  return found.sort((a, b) => b.gap - a.gap).slice(0, 6).map((f) => f.text);
}

function gaps(all: Ladder[]) {
  const steps = all
    .filter((l) => l.kind === 'GPU' || l.kind === 'CPU')
    .flatMap((l) => l.rungs.slice(1).map((r, i) => ({ from: l.rungs[i], to: r, ratio: r.score / l.rungs[i].score })))
    .filter((s) => s.from.score >= 20); // skip the tiny early-2000s scores, where ratios exaggerate
  steps.sort((a, b) => a.ratio - b.ratio);
  const pct = (r: number) => `${Math.round((r - 1) * 100)}%`;
  const small = steps[0];
  const big = steps[steps.length - 1];
  return {
    small: `${esc(small.from.name)} to the ${esc(small.to.name)} is only ${pct(small.ratio)} faster`,
    big: `${esc(big.from.name)} the next rung (${esc(big.to.name)}) is ${pct(big.ratio)} faster`,
  };
}

const all = ladders();
document.getElementById('tier-tables')!.innerHTML = all.map(table).join('');
document.getElementById('tier-surprises')!.innerHTML = surprises(all)
  .map((t) => `<li>${t}</li>`)
  .join('');
document.getElementById('ram-ladder')!.textContent = catalog.ram.map((r) => formatMemory(r.sizeGB)).join(' → ');
const g = gaps(all);
document.querySelector('[data-gap="small"]')!.innerHTML = g.small;
document.querySelector('[data-gap="big"]')!.innerHTML = g.big;
