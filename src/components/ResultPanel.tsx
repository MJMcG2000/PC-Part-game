import type { ReactNode } from 'react';
import type { BenchmarkEntry } from '../lib/benchmarks';
import type { Cpu, Game, Gpu } from '../lib/types';
import { buildFps, displayFps, requiredVramGB } from '../lib/fps';
import { VRAM_PENALTY, type Resolution } from '../lib/config';

interface Props {
  resolution: Resolution;
  won: boolean;
  gaveUp: boolean;
  /** Guess limit for this puzzle (6, or 8 in Hard mode). */
  maxGuesses: number;
  /** FPS of the winning build, and whether it was the exact minimum build. */
  winningFps: number | null;
  exact: boolean;
  tolerancePct: number;
  guessCount: number;
  game: Game;
  targetFps: number;
  cpu: Cpu;
  gpu: Gpu;
  /** The minimum part of each brand; any of them counts as correct. */
  cpuAlts: Cpu[];
  gpuAlts: Gpu[];
  ramGB: number;
  onShare: () => void;
  shareLabel: string;
  children?: ReactNode;
}

/** "Benchmark" (linked to its source) or "Estimate" next to an FPS bar. */
function SourceTag({ entry }: { entry: BenchmarkEntry | null }) {
  if (!entry) return <span className="src-tag is-est">Estimate</span>;
  const label = `Benchmark · ${entry.source}${entry.tested ? `, ${entry.tested}` : ''}`;
  return entry.url ? (
    <a className="src-tag is-bench" href={entry.url} target="_blank" rel="noreferrer noopener" title={label}>
      📊 {entry.source}
    </a>
  ) : (
    <span className="src-tag is-bench" title={label}>
      📊 {entry.source}
    </span>
  );
}

export function ResultPanel({ resolution, won, gaveUp, maxGuesses, winningFps, exact, tolerancePct, guessCount, game, targetFps, cpu, gpu, cpuAlts, gpuAlts, ramGB, onShare, shareLabel, children }: Props) {
  const b = buildFps(cpu, gpu, ramGB, game, resolution);
  const vram = Math.round(requiredVramGB(game, resolution) * 10) / 10;
  const max = Math.max(b.cpuFps, b.gpuFps, targetFps) * 1.08;
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  return (
    <section className="result" aria-live="polite">
      <h2 className="result-title">
        {won ? `Rig complete in ${guessCount}/${maxGuesses}!` : gaveUp ? 'You gave up' : 'Out of guesses'}
      </h2>
      {won && !exact && winningFps !== null && (
        <p className="result-sub">
          Close enough: your build hit about <strong>{displayFps(winningFps)} FPS</strong>, within {tolerancePct}% of the target.
        </p>
      )}
      <p className="result-sub">
        The minimum parts for {targetFps} FPS at {resolution} (either brand counts):
      </p>
      <ul className="answer-build">
        <li>
          <span className="ab-part">CPU</span>
          <span className="ab-name">{cpuAlts.map((c) => c.name).join(' or ')}</span>
        </li>
        <li>
          <span className="ab-part">GPU</span>
          <span className="ab-name">
            {gpuAlts.map((g, i) => (
              <span key={g.name}>
                {i > 0 && ' or '}
                {g.name} <small>({g.vramGB} GB)</small>
              </span>
            ))}
          </span>
        </li>
        <li>
          <span className="ab-part">RAM</span>
          <span className="ab-name">
            {ramGB} GB {[...new Set(cpuAlts.map((c) => c.memory))].join(' or ')}
          </span>
        </li>
      </ul>

      <p className="bd-caption">
        FPS breakdown for the overall minimum: {cpu.name} + {gpu.name}
      </p>
      <div className="breakdown" aria-label="FPS breakdown">
        <div className="bd-row">
          <span className="bd-label">
            CPU limit <SourceTag entry={b.cpuSource} />
          </span>
          <div className="bd-track">
            <div className="bd-bar bd-cpu" style={{ width: pct(b.cpuFps) }} />
            <div className="bd-target" style={{ left: pct(targetFps) }} />
          </div>
          <span className="bd-val mono">{displayFps(b.cpuFps)}</span>
        </div>
        <div className="bd-row">
          <span className="bd-label">
            GPU limit <SourceTag entry={b.gpuSource} />
          </span>
          <div className="bd-track">
            <div className="bd-bar bd-gpu" style={{ width: pct(b.gpuFps) }} />
            <div className="bd-target" style={{ left: pct(targetFps) }} />
          </div>
          <span className="bd-val mono">{displayFps(b.gpuFps)}</span>
        </div>
        <p className="bd-note">
          {b.limitedBy === 'cpu' ? 'CPU-limited' : 'GPU-limited'}: {displayFps(b.fps)} FPS (target {targetFps}).{' '}
          {b.vramPenalty && `GPU VRAM is below the ${vram} GB this game wants at ${resolution} (×${VRAM_PENALTY}). `}
          This game recommends {game.ramRecGB} GB RAM and wants {vram} GB VRAM at {resolution}.
        </p>
      </div>

      <div className="result-actions">
        {children}
        <button className={`btn ${children ? '' : 'btn-primary '}share-btn`} onClick={onShare}>
          {shareLabel}
        </button>
      </div>
    </section>
  );
}
