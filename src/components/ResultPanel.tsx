import type { Cpu, Game, Gpu } from '../lib/types';
import { buildFps, displayFps } from '../lib/fps';
import { MAX_GUESSES, VRAM_PENALTY } from '../lib/config';

interface Props {
  won: boolean;
  guessCount: number;
  game: Game;
  targetFps: number;
  cpu: Cpu;
  gpu: Gpu;
  ramGB: number;
  onShare: () => void;
  shareLabel: string;
}

export function ResultPanel({ won, guessCount, game, targetFps, cpu, gpu, ramGB, onShare, shareLabel }: Props) {
  const b = buildFps(cpu, gpu, ramGB, game);
  const max = Math.max(b.cpuFps, b.gpuFps, targetFps) * 1.08;
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  return (
    <section className="result" aria-live="polite">
      <h2 className="result-title">
        {won ? `Rig complete in ${guessCount}/${MAX_GUESSES}!` : 'Out of guesses'}
      </h2>
      <p className="result-sub">The minimum build for {targetFps} FPS was:</p>
      <ul className="answer-build">
        <li>
          <span className="ab-part">CPU</span>
          <span className="ab-name">{cpu.name}</span>
        </li>
        <li>
          <span className="ab-part">GPU</span>
          <span className="ab-name">
            {gpu.name} <small>({gpu.vramGB} GB)</small>
          </span>
        </li>
        <li>
          <span className="ab-part">RAM</span>
          <span className="ab-name">{ramGB} GB</span>
        </li>
      </ul>

      <div className="breakdown" aria-label="FPS breakdown">
        <div className="bd-row">
          <span className="bd-label">CPU limit</span>
          <div className="bd-track">
            <div className="bd-bar bd-cpu" style={{ width: pct(b.cpuFps) }} />
            <div className="bd-target" style={{ left: pct(targetFps) }} />
          </div>
          <span className="bd-val mono">{displayFps(b.cpuFps)}</span>
        </div>
        <div className="bd-row">
          <span className="bd-label">GPU limit</span>
          <div className="bd-track">
            <div className="bd-bar bd-gpu" style={{ width: pct(b.gpuFps) }} />
            <div className="bd-target" style={{ left: pct(targetFps) }} />
          </div>
          <span className="bd-val mono">{displayFps(b.gpuFps)}</span>
        </div>
        <p className="bd-note">
          {b.limitedBy === 'cpu' ? 'CPU-limited' : 'GPU-limited'}: {displayFps(b.fps)} FPS (target {targetFps}).{' '}
          {b.vramPenalty && `GPU VRAM is below the ${game.vramGB} GB this game wants (×${VRAM_PENALTY}). `}
          This game recommends {game.ramRecGB} GB RAM and wants {game.vramGB} GB VRAM.
        </p>
      </div>

      <button className="btn btn-primary share-btn" onClick={onShare}>
        {shareLabel}
      </button>
    </section>
  );
}
