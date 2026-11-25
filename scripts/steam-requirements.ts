/**
 * Turns a Steam store "PC requirements" block into Rigdle FPS-model numbers.
 *
 * Assumption: a game's RECOMMENDED parts run it at about REC_FPS at 1080p
 * High, and its MINIMUM parts at about MIN_FPS. So cpuLoad = fps / cpuScore
 * and gpuLoad = fps / gpuScore. When a line names an Intel and an AMD option,
 * their scores are averaged. Rough by design: it's a planner estimate, not a
 * benchmark.
 */
import { findCpus, findGpus, guessCpu, guessGpu } from './hardware-scores';

export const REC_FPS = 55;
export const MIN_FPS = 25;

export interface Requirements {
  cpuLoad: number;
  gpuLoad: number;
  vramGB: number;
  ramMinGB: number;
  ramRecGB: number;
}

export const stripHtml = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(li|p|ul)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ');

/** The text after a label such as "Processor:" or "Graphics:", up to the next line. */
function field(text: string, labels: string[]): string {
  for (const l of labels) {
    const m = text.match(new RegExp(`${l}\\s*:?\\s*([^\\n]+)`, 'i'));
    if (m) return m[1];
  }
  return '';
}

function ramGB(text: string): number | null {
  const m = field(text, ['Memory', 'RAM']).match(/(\d+(?:\.\d+)?)\s*(GB|MB)/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return m[2].toUpperCase() === 'MB' ? n / 1024 : n;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const round2 = (n: number) => Math.round(n * 100) / 100;
/** Snap to the RAM options the game uses (0.5 … 64 GB). */
const snapRam = (gb: number) => [0.5, 1, 2, 4, 8, 16, 32, 64].find((o) => o >= gb - 1e-6) ?? 64;

interface Tier {
  cpu: number | null;
  gpu: number | null;
  vram: number | null;
  ram: number | null;
}

function tier(html: string | undefined): Tier | null {
  if (!html) return null;
  const text = stripHtml(html);
  const cpuLine = field(text, ['Processor', 'CPU']);
  const gpuLine = field(text, ['Graphics', 'Video Card', 'Video', 'GPU']);
  let cpus = findCpus(cpuLine);
  let gpus = findGpus(gpuLine);
  if (!cpus.length) {
    const g = guessCpu(cpuLine);
    if (g) cpus = [g];
  }
  if (!gpus.length) {
    const g = guessGpu(gpuLine);
    if (g) gpus = [g];
  }
  const vramText = field(text, ['Graphics', 'Video Card', 'Video', 'GPU']).match(/(\d+)\s*GB\s*(?:of\s*)?(?:VRAM|video|dedicated)/i);
  return {
    cpu: cpus.length ? mean(cpus.slice(0, 2)) : null,
    gpu: gpus.length ? mean(gpus.slice(0, 2).map((g) => g.score)) : null,
    vram: vramText ? Number(vramText[1]) : gpus.length ? Math.min(...gpus.slice(0, 2).map((g) => g.vramGB)) : null,
    ram: ramGB(text),
  };
}

/** Model numbers from Steam's pc_requirements { minimum, recommended } HTML, or null if no CPU/GPU could be read. */
export function parseRequirements(req: { minimum?: string; recommended?: string } | undefined): Requirements | null {
  const rec = tier(req?.recommended);
  const min = tier(req?.minimum);
  const cpuLoad = rec?.cpu ? REC_FPS / rec.cpu : min?.cpu ? MIN_FPS / min.cpu : null;
  const gpuLoad = rec?.gpu ? REC_FPS / rec.gpu : min?.gpu ? MIN_FPS / min.gpu : null;
  if (cpuLoad === null || gpuLoad === null) return null;
  const ramMin = min?.ram ?? rec?.ram ?? 4;
  const ramRec = Math.max(ramMin, rec?.ram ?? ramMin);
  return {
    cpuLoad: round2(cpuLoad),
    gpuLoad: round2(gpuLoad),
    vramGB: rec?.vram ?? min?.vram ?? 2,
    ramMinGB: snapRam(ramMin),
    ramRecGB: snapRam(ramRec),
  };
}
