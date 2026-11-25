import { describe, expect, it } from 'vitest';
import { parseRequirements, REC_FPS, MIN_FPS } from './steam-requirements';
import { findCpus, findGpus, normPart } from './hardware-scores';

// Typical shape of Steam's pc_requirements HTML (made-up example).
const rec =
  '<strong>Recommended:</strong><br><ul class="bb_ul"><li><strong>OS:</strong> Windows 10 64-bit<br></li>' +
  '<li><strong>Processor:</strong> Intel Core i7-6700 or AMD Ryzen 5 1600<br></li><li><strong>Memory:</strong> 12 GB RAM<br></li>' +
  '<li><strong>Graphics:</strong> NVIDIA GeForce GTX 1060 6GB or AMD Radeon RX 580 8GB<br></li></ul>';
const min =
  '<strong>Minimum:</strong><br><ul class="bb_ul"><li><strong>Processor:</strong> Intel Core i5-3570K / AMD FX-8310<br></li>' +
  '<li><strong>Memory:</strong> 8 GB RAM<br></li><li><strong>Graphics:</strong> GTX 970 / RX 470<br></li></ul>';

describe('Steam requirement parsing', () => {
  it('normalizes part names', () => {
    expect(normPart('NVIDIA GeForce GTX 1060 6GB')).toBe('gtx1060');
    expect(normPart('Intel Core i5-4460')).toBe('i54460');
  });
  it('finds CPUs and GPUs in requirement lines', () => {
    expect(findCpus('Intel Core i7-6700 or AMD Ryzen 5 1600')).toEqual([85, 100]);
    expect(findGpus('NVIDIA GeForce GTX 1060 6GB or AMD Radeon RX 580 8GB').map((g) => g.score)).toEqual([44, 47]);
    expect(findGpus('RTX 2070 Super').map((g) => g.score)).toEqual([95]);
  });
  it('turns recommended specs into loads (rec parts ≈ REC_FPS at 1080p High)', () => {
    const r = parseRequirements({ minimum: min, recommended: rec })!;
    expect(r.cpuLoad).toBeCloseTo(REC_FPS / 92.5, 2);
    expect(r.gpuLoad).toBeCloseTo(REC_FPS / 45.5, 2);
    expect(r).toMatchObject({ ramMinGB: 8, ramRecGB: 16, vramGB: 6 });
  });
  it('falls back to minimum specs, and gives up when nothing is readable', () => {
    const r = parseRequirements({ minimum: min })!;
    expect(r.gpuLoad).toBeCloseTo(MIN_FPS / 37, 2);
    expect(parseRequirements({ minimum: '<li>Processor: 2 GHz</li><li>Graphics: DirectX 11</li>' })).toBeNull();
  });
});
