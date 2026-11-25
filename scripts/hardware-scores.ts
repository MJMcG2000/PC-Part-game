/**
 * Approximate relative gaming scores for CPUs and GPUs that show up in Steam
 * system requirements, on the same scales as src/data (CPU: Ryzen 5 1600 = 100;
 * GPU: RTX 4060 = 100 at 1080p). Parts in src/data are added automatically;
 * the tables below cover common requirement parts that aren't in the game's
 * picker. Values are rough and meant for estimates only.
 */
import cpusJson from '../src/data/cpus.json';
import gpusJson from '../src/data/gpus.json';

export interface GpuInfo {
  score: number;
  vramGB: number;
}

/** "GeForce GTX 1060 6GB" -> "gtx1060"; "Radeon RX 7900 XTX" -> "rx7900xtx"; "Core i5-4460" -> "i54460". */
export function normPart(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(r\)|\(tm\)|®|™/g, '')
    .replace(/\b(nvidia|geforce|amd|ati|radeon|intel|core|graphics|series|processor|cpu|gpu)\b/g, '')
    .replace(/\b\d+\s*gb\b/g, '')
    .replace(/\b\d(\.\d+)?\s*ghz\b/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

const EXTRA_GPUS: Record<string, [number, number]> = {
  // NVIDIA (older parts common in Steam requirements)
  '6600': [1.5, 0.125], '6800': [3, 0.25], '7300': [1, 0.125], '7800': [5, 0.25], '7900': [5.5, 0.25], '8600': [3, 0.25],
  '8800': [9, 0.5], '9600': [6, 0.5], '9800': [10, 0.5], 'x1300': [1.5, 0.125], 'x1900': [7, 0.5], 'fx 5200': [0.8, 0.125], '7600 gt': [2, 0.25], '7800 gt': [5, 0.25], '7900 gt': [5.5, 0.25], '8600 gt': [3, 0.25], '8800 gt': [10, 0.5],
  '8800 gts': [9, 0.5], '9600 gt': [6, 0.5], '9800 gt': [10, 0.5], '9800 gtx': [11, 0.5], 'gts 250': [11, 0.5], 'gts 450': [11, 1],
  'gtx 260': [13, 0.875], 'gtx 275': [15, 0.875], 'gtx 460': [15, 1], 'gtx 470': [18, 1.25], 'gtx 550 ti': [12, 1], 'gtx 560': [17, 1],
  'gtx 560 ti': [20, 1], 'gtx 570': [22, 1.25], 'gtx 590': [30, 1.5], 'gtx 690': [45, 2], 'gt 640': [6, 1], 'gt 710': [2, 1],
  'gt 730': [4, 2], 'gt 1030': [8, 2], 'gtx 650': [9, 1], 'gtx 650 ti': [12, 1], 'gtx 660': [18, 2], 'gtx 660 ti': [22, 2],
  'gtx 670': [27, 2], 'gtx 750': [12, 1], 'gtx 750 ti': [15, 2], 'gtx 760': [22, 2], 'gtx 780': [32, 3], 'gtx 780 ti': [37, 3],
  'gtx 950': [21, 2], 'gtx 980': [46, 4], 'gtx 1050': [22, 2], 'gtx 1060': [42, 6], 'gtx 1060 3gb': [40, 3],
  'gtx 1070': [58, 8], 'gtx 1070 ti': [64, 8], 'gtx 1080': [69, 8], 'gtx 1080 ti': [88, 11], 'gtx 1650 super': [47, 4],
  'gtx 1660': [55, 6], 'gtx 1660 ti': [60, 6], 'rtx 2060 super': [80, 8], 'rtx 2070': [86, 8], 'rtx 2070 super': [95, 8],
  'rtx 2080': [101, 8], 'rtx 2080 super': [106, 8], 'rtx 2080 ti': [125, 11], 'rtx 3050': [55, 8], 'rtx 3060': [86, 12],
  'rtx 3070 ti': [133, 8], 'rtx 3080': [150, 10], 'rtx 3080 ti': [168, 12], 'rtx 3090': [172, 24], 'rtx 3090 ti': [185, 24],
  'rtx 4060 ti': [118, 8], 'rtx 4070 ti': [185, 12], 'rtx 4080': [236, 16], 'titan x': [55, 12],
  // AMD (older parts common in Steam requirements)
  'x800': [4, 0.25], 'x1600': [3, 0.25], 'x1800': [6, 0.5], 'x1950': [8, 0.5], 'hd 2600': [2, 0.25], 'hd 2900': [7, 0.5],
  'hd 3850': [4, 0.25], 'hd 3870': [5, 0.5], 'hd 4670': [5, 0.5], 'hd 4850': [9, 0.5], 'hd 4890': [12, 1], 'hd 5670': [6, 0.5],
  'hd 5750': [8, 1], 'hd 5770': [9, 1], 'hd 5850': [15, 1], 'hd 6670': [7, 1], 'hd 6770': [9, 1], 'hd 6850': [13, 1],
  'hd 6870': [15, 1], 'hd 6950': [20, 2], 'hd 7750': [9, 1], 'hd 7790': [13, 1], 'r7 240': [4, 2], 'r7 250': [6, 1],
  'hd 7770': [11, 1], 'hd 7850': [17, 2], 'hd 7870': [21, 2], 'hd 7950': [27, 3], 'r7 260x': [14, 2], 'r7 370': [17, 2],
  'r9 270': [21, 2], 'r9 270x': [22, 2], 'r9 280': [28, 3], 'r9 280x': [31, 3], 'r9 285': [30, 2], 'r9 380': [30, 4],
  'r9 390': [42, 8], 'r9 390x': [45, 8], 'r9 fury': [50, 4], 'r9 fury x': [54, 4], 'rx 460': [17, 4], 'rx 470': [33, 4],
  'rx 480': [40, 8], 'rx 560': [18, 4], 'rx 570': [38, 4], 'rx 580': [47, 8], 'rx 590': [50, 8], 'rx vega 56': [56, 8],
  'rx vega 64': [62, 8], 'rx 5500 xt': [45, 8], 'rx 5600 xt': [64, 6], 'rx 5700': [75, 8], 'rx 5700 xt': [83, 8],
  'rx 6500 xt': [35, 4], 'rx 6600 xt': [95, 8], 'rx 6650 xt': [100, 8], 'rx 6700': [108, 10], 'rx 6750 xt': [120, 12],
  'rx 6800': [150, 16], 'rx 6800 xt': [175, 16], 'rx 6900 xt': [190, 16], 'rx 6950 xt': [200, 16], 'rx 7600 xt': [102, 16],
  'rx 7900 gre': [175, 16], 'rx 7900 xt': [205, 20], 'rx 9060 xt': [125, 8], 'rx 9070': [210, 16],
  // Intel
  'hd 3000': [1, 0.5], 'hd 4000': [2, 0.5], 'hd 4600': [3, 1], 'hd 520': [3, 1], 'hd 620': [3, 1], 'uhd 620': [3, 1], 'uhd 630': [3.5, 1],
  'iris xe': [7, 1], 'iris plus': [5, 1],
  'arc a380': [25, 6], 'arc a580': [75, 8], 'arc a750': [85, 8], 'arc a770': [92, 16], 'arc b570': [92, 10], 'arc b580': [105, 12],
};

const EXTRA_CPUS: Record<string, number> = {
  // Intel
  'i3-2100': 30, 'i3-3220': 35, 'i3-4130': 38, 'i3-4160': 39, 'i3-6100': 52, 'i3-7100': 55, 'i3-8100': 75, 'i3-9100': 80,
  'i3-10100': 100, 'i3-12100': 150, 'i3-13100': 160, 'i5-650': 26, 'i5-760': 37, 'i5-2300': 45, 'i5-2400': 48, 'i5-2500': 52,
  'i5-3330': 52, 'i5-3470': 55, 'i5-3570': 57, 'i5-3570k': 58, 'i5-4430': 58, 'i5-4440': 59, 'i5-4460': 60, 'i5-4590': 62,
  'i5-4690': 64, 'i5-4690k': 66, 'i5-6400': 66, 'i5-6500': 70, 'i5-6600': 76, 'i5-7400': 75, 'i5-7500': 80, 'i5-7600': 84,
  'i5-7600k': 86, 'i5-8500': 122, 'i5-8600k': 128, 'i5-9400': 112, 'i5-9400f': 113, 'i5-9600': 128, 'i5-10400f': 138,
  'i5-10600k': 150, 'i5-11600k': 170, 'i5-12400f': 184, 'i5-12600': 195, 'i5-13400': 195, 'i5-14400': 200, 'i5-14600k': 236,
  'i7-860': 36, 'i7-870': 37, 'i7-930': 38, 'i7-2600': 55, 'i7-2600k': 57, 'i7-3770': 59, 'i7-4770': 70, 'i7-4770k': 72,
  'i7-4790': 73, 'i7-5820k': 75, 'i7-6700': 85, 'i7-7700': 92, 'i7-7700k': 96, 'i7-8700': 130, 'i7-9700': 145, 'i7-9700k': 150,
  'i7-10700': 160, 'i7-10700k': 165, 'i7-11700k': 180, 'i7-12700': 215, 'i7-12700k': 225, 'i7-13700k': 245,
  'i9-10900k': 172, 'i9-11900k': 185, 'i9-12900k': 238, 'i9-13900k': 258,
  'core 2 duo e6750': 24, 'core 2 duo e7400': 26, 'core 2 duo e8200': 28, 'core 2 quad q6700': 28, 'core 2 quad q9400': 32,
  'core 2 quad q9550': 35, 'pentium g4560': 50, 'pentium g3258': 40,
  // AMD
  'athlon x4 860k': 30, 'athlon 64 x2 5000+': 18, 'phenom ii x4 965': 34, 'phenom ii x4 955': 33, 'phenom ii x6 1100t': 41,
  'fx-4100': 24, 'fx-4300': 28, 'fx-6100': 32, 'fx-6300': 36, 'fx-6350': 38, 'fx-8120': 40, 'fx-8150': 42, 'fx-8320': 45,
  'fx-9590': 52, 'ryzen 3 1200': 75, 'ryzen 3 1300x': 80, 'ryzen 3 2200g': 82, 'ryzen 3 3100': 110, 'ryzen 3 3200g': 95,
  'ryzen 3 3300x': 125, 'ryzen 5 1400': 85, 'ryzen 5 1500x': 92, 'ryzen 5 1600x': 104, 'ryzen 5 2400g': 95,
  'ryzen 5 2600x': 115, 'ryzen 5 3400g': 105, 'ryzen 5 3500': 128, 'ryzen 5 3600x': 145, 'ryzen 5 5500': 165,
  'ryzen 5 5600x': 182, 'ryzen 5 5600g': 160, 'ryzen 5 7600': 218, 'ryzen 7 1700': 105, 'ryzen 7 1700x': 108,
  'ryzen 7 1800x': 110, 'ryzen 7 2700': 118, 'ryzen 7 3800x': 150, 'ryzen 7 5700x': 186, 'ryzen 7 5700g': 170,
  'ryzen 7 7700': 232, 'ryzen 9 3900x': 150, 'ryzen 9 5900x': 195, 'ryzen 9 5950x': 197, 'ryzen 9 7900x': 240,
  'ryzen 9 7950x': 245, 'ryzen 9 7950x3d': 290,
};

const gpuTable = new Map<string, GpuInfo>();
for (const g of gpusJson.items as { name: string; rasterScore: number; vramGB: number }[]) {
  gpuTable.set(normPart(g.name), { score: g.rasterScore, vramGB: g.vramGB });
}
for (const [name, [score, vramGB]] of Object.entries(EXTRA_GPUS)) if (!gpuTable.has(normPart(name))) gpuTable.set(normPart(name), { score, vramGB });

const cpuTable = new Map<string, number>();
for (const c of cpusJson.items as { name: string; gamingScore: number }[]) cpuTable.set(normPart(c.name), c.gamingScore);
for (const [name, score] of Object.entries(EXTRA_CPUS)) if (!cpuTable.has(normPart(name))) cpuTable.set(normPart(name), score);

// Longest keys first so "rtx 2070 super" wins over "rtx 2070".
const gpuKeys = [...gpuTable.keys()].sort((a, b) => b.length - a.length);
const cpuKeys = [...cpuTable.keys()].sort((a, b) => b.length - a.length);

/** Model-like tokens in a requirement line, e.g. "GTX 1060", "RX 580", "i5-4460", "Ryzen 5 1600", "FX-6300". */
const GPU_RE = /\b(?:geforce\s*)?(?:(?:gtx|rtx|gts|gt)\s*-?\s*\d{3,4}(?:\s*(?:ti|super))*|titan\s*x|(?:radeon\s*)?(?:rx\s*(?:vega\s*)?\d{2,4}(?:\s*(?:xtx|xt|gre))?|r[79]\s*\d{3}x?|r9\s*fury\s*x?|hd\s*\d{4}|x\d{3,4})|arc\s*[ab]\d{3}|(?:u?hd|intel\s*hd)\s*(?:graphics\s*)?\d{3,4}|iris\s*(?:xe|plus)|(?:geforce|nvidia)\s*(?:fx\s*5200|[6-9][0-9]00(?:\s*gt[sx]?)?)|\b[6-9][68]00\s*gt[sx]?)\b/gi;
/** "ATI 1950" / "Radeon 1300" mean the X1950 / X1300. */
const ATI_X = /\b(?:ati|radeon)\s*(1[3-9]\d0)\b/gi;
const CPU_RE = /\b(?:i[3579]\s*-?\s*\d{3,5}[a-z]{0,2}|ryzen\s*[3579]\s*(?:pro\s*)?\d{4}x?(?:3d)?[a-z]?|fx\s*-?\s*\d{4}|phenom\s*ii\s*x[46]\s*\d{3,4}t?|athlon\s*(?:64\s*)?x[24]\s*\d{3,4}k?\+?|core\s*2\s*(?:duo|quad)\s*[eq]\d{4}|pentium\s*g\d{4}|core\s*ultra\s*[579]\s*\d{3}k?)\b/gi;

function lookup<T>(token: string, keys: string[], table: Map<string, T>): T | undefined {
  const n = normPart(token);
  if (table.has(n)) return table.get(n);
  // Allow suffix variants: "gtx1060" matches "gtx10603" only via exact; strip trailing letters for CPUs ("i54460k" -> "i54460").
  const trimmed = n.replace(/[a-z]+$/, '');
  if (trimmed !== n && table.has(trimmed)) return table.get(trimmed);
  return keys.find((k) => k === n) ? table.get(n) : undefined;
}

/** GPUs named in a requirement text (in order), with scores. */
export function findGpus(text: string): GpuInfo[] {
  text = text.replace(ATI_X, 'radeon x$1');
  return [...text.matchAll(GPU_RE)].map((m) => lookup(m[0], gpuKeys, gpuTable)).filter((g): g is GpuInfo => !!g);
}

/** CPU scores named in a requirement text (in order). */
export function findCpus(text: string): number[] {
  return [...text.matchAll(CPU_RE)].map((m) => lookup(m[0], cpuKeys, cpuTable)).filter((s): s is number => s !== undefined);
}

/**
 * Fallbacks when no known model is named.
 * CPU: "Dual core 2.4 GHz", "Quad-Core 3.0 GHz", "Intel Core i5", "Core 2 Duo", "Pentium 4 3.0 GHz".
 * GPU: a video memory size ("512 MB", "2 GB VRAM") is a decent proxy for the card's class.
 */
export function guessCpu(line: string): number | null {
  const t = line.toLowerCase();
  const mhz = Number(t.match(/(\d{3,4})\s*mhz/)?.[1] ?? 0);
  const ghz = Number(t.match(/(\d(?:\.\d+)?)\s*\+?\s*ghz/)?.[1] ?? 0) || mhz / 1000;
  // Athlon XP / Athlon 64 performance ratings ("AMD 3500+", "Athlon 2000+").
  const rating = Number(t.match(/\b(?:amd|athlon)[^0-9]{0,12}([1-4]\d{3})\s*\+/)?.[1] ?? 0);
  if (rating && !ghz) return Math.round((rating / 280) * 10) / 10;
  const generic: [RegExp, number][] = [
    [/ryzen\s*7/, 120], [/ryzen\s*5/, 100], [/ryzen\s*3/, 75], [/\bi7\b/, 65], [/\bi5\b/, 55], [/\bi3\b/, 35],
    [/core\s*2\s*quad|quad\s*-?\s*core|4\s*cores?/, 0], [/core\s*2\s*duo|dual\s*-?\s*core|2\s*cores?|athlon\s*(64\s*)?x2/, 0],
    [/pentium\s*(4|iv|iii|ii)|\bp4\b|\bpiii\b|athlon|celeron|duron|single\s*-?\s*core/, 0],
  ];
  for (const [re, score] of generic) {
    if (!re.test(t)) continue;
    if (score) return score;
    const quad = /quad|4\s*cores?/.test(t);
    const dual = /duo|dual|2\s*cores?|x2/.test(t);
    const g = ghz || (quad ? 2.5 : dual ? 2.2 : 2.8);
    return Math.round(g * (quad ? 14 : dual ? 9.5 : 3));
  }
  return ghz ? Math.round(ghz * 3) : null;
}

export function guessGpu(line: string): GpuInfo | null {
  const m = line.match(/(\d+(?:\.\d+)?)\s*(gb|mb)/i);
  if (!m) return null;
  const gb = m[2].toLowerCase() === 'mb' ? Number(m[1]) / 1024 : Number(m[1]);
  if (gb < 0.008 || gb > 24) return null;
  const score = gb <= 0.016 ? 0.3 : gb <= 0.032 ? 0.5 : gb <= 0.064 ? 0.9 : gb <= 0.125 ? 1.5 : gb <= 0.25 ? 3 : gb <= 0.5 ? 6 : gb <= 1 ? 12 : gb <= 2 ? 20 : gb <= 4 ? 35 : gb <= 6 ? 48 : 60;
  return { score, vramGB: gb };
}
