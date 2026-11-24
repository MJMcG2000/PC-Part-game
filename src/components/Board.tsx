import { useMemo, useState, type ReactNode } from 'react';
import { catalog } from '../lib/data';
import { MAX_GUESSES, WIN_TOLERANCE } from '../lib/config';
import { evaluateGuess, isWin } from '../lib/feedback';
import { buildFps, displayFps, isCloseEnough } from '../lib/fps';
import { guessIndices } from '../lib/board';
import type { Puzzle } from '../lib/puzzle';
import type { GameStatus, StoredGuess } from '../lib/storage';
import { PART_KEYS, type BuildIdx, type PartKey } from '../lib/types';
import { GameCard } from './GameCard';
import { PartPicker, type PickerOption } from './PartPicker';
import { ResultPanel } from './ResultPanel';
import { PcDiagram, type SlotState } from './PcDiagram';

type Selection = { cpu: number | null; gpu: number | null; ram: number | null };

// Picker options. `index` is the performance tier (used for feedback); the pickers list CPUs/GPUs by release year.
const cpuOptions: PickerOption[] = catalog.cpus.map((c, i) => ({ index: i, label: c.name, detail: `${c.brand} · ${c.year}`, year: c.year }));
const gpuOptions: PickerOption[] = catalog.gpus.map((g, i) => ({
  index: i,
  label: g.name,
  detail: `${g.brand} · ${g.vramGB} GB · ${g.year}`,
  year: g.year,
}));
const ramOptions: PickerOption[] = catalog.ram.map((r, i) => ({ index: i, label: `${r.sizeGB} GB` }));

const partName = (k: PartKey, i: number) =>
  k === 'cpu' ? catalog.cpus[i].name : k === 'gpu' ? catalog.gpus[i].name : `${catalog.ram[i].sizeGB} GB`;

interface Props {
  puzzle: Puzzle;
  label: string;
  guesses: StoredGuess[];
  status: GameStatus;
  onGuess: (guess: StoredGuess, won: boolean) => void;
  onShare: () => void;
  toast: (msg: string) => void;
  /** Extra controls under the result (e.g. "Next rig"). */
  resultActions?: ReactNode;
  /** Hard mode: only the exact minimum build wins. */
  hard: boolean;
  /** End the puzzle as a loss and reveal the answer. */
  onGiveUp: () => void;
}

/** One puzzle: game card, PC diagram, guess grid, and the part pickers or result. */
export function Board({ puzzle, label, guesses: stored, status, onGuess, onShare, toast, resultActions, hard, onGiveUp }: Props) {
  const [selection, setSelection] = useState<Selection>({ cpu: null, gpu: null, ram: null });
  const guesses = useMemo(() => guessIndices(stored), [stored]);
  const tileRows = useMemo(() => guesses.map((g) => evaluateGuess(g, puzzle.answer)), [guesses, puzzle.answer]);
  const finished = status !== 'playing';

  // Estimated FPS of the latest guess (the hint that used to live in the guess grid).
  const last = guesses[guesses.length - 1];
  const lastFps = last
    ? buildFps(catalog.cpus[last.cpu], catalog.gpus[last.gpu], catalog.ram[last.ram].sizeGB, puzzle.game, puzzle.resolution)
    : null;

  // Parts already tried are crossed out in the pickers (still selectable).
  const tried = {
    cpu: new Set(guesses.map((g) => g.cpu)),
    gpu: new Set(guesses.map((g) => g.gpu)),
    ram: new Set(guesses.map((g) => g.ram)),
  };
  const mark = (opts: PickerOption[], k: PartKey) => opts.map((o) => ({ ...o, crossed: tried[k].has(o.index) }));

  // Diagram: a part locks in green once found; otherwise it shows the latest guess.
  const slots = Object.fromEntries(
    PART_KEYS.map((k, j) => {
      let state: SlotState = { name: null, tile: null };
      guesses.forEach((g, i) => {
        if (state.tile?.color !== 'green') state = { name: partName(k, g[k]), tile: tileRows[i][j] };
      });
      if (status === 'lost' && state.tile?.color !== 'green') {
        // Reveal the answer in the diagram only once the game is lost
        // (a ±5% win keeps showing the player's own build).
        state = { name: partName(k, puzzle.answer[k]), tile: { part: k, color: 'green', direction: null } };
      }
      return [k, state];
    }),
  ) as Record<PartKey, SlotState>;

  const submit = () => {
    if (finished) return;
    const { cpu, gpu, ram } = selection;
    if (cpu === null || gpu === null || ram === null) return toast('Pick a CPU, GPU and RAM first');
    if (guesses.some((g) => g.cpu === cpu && g.gpu === gpu && g.ram === ram)) return toast('You already tried that build');
    const guess: BuildIdx = { cpu, gpu, ram };
    onGuess(
      { cpu: catalog.cpus[cpu].name, gpu: catalog.gpus[gpu].name, ramGB: catalog.ram[ram].sizeGB },
      isWin(evaluateGuess(guess, puzzle.answer)) ||
        (!hard &&
          isCloseEnough(buildFps(catalog.cpus[cpu], catalog.gpus[gpu], catalog.ram[ram].sizeGB, puzzle.game, puzzle.resolution).fps, puzzle.targetFps)),
    );
  };

  return (
    <>
      <GameCard game={puzzle.game} targetFps={puzzle.targetFps} resolution={puzzle.resolution} label={label} />
      <PcDiagram slots={slots} />
      <p className="pc-readout" aria-live="polite">
        {hard && <span className="hard-badge">HARD</span>}
        <span>
          Guess <strong className="mono">{Math.min(guesses.length, MAX_GUESSES)}</strong>/{MAX_GUESSES}
        </span>
        {lastFps && (
          <span
            className={
              (!hard && isCloseEnough(lastFps.fps, puzzle.targetFps)) || lastFps.fps + 1e-6 >= puzzle.targetFps
                ? 'is-hit'
                : 'is-miss'
            }
          >
            Last build: <strong className="mono">{displayFps(lastFps.fps)} FPS</strong>
            {lastFps.vramPenalty && <span className="vram-flag" title="GPU has less VRAM than this game needs (×0.6)">VRAM</span>}
          </span>
        )}
      </p>
      {finished ? (
        <ResultPanel
          resolution={puzzle.resolution}
          won={status === 'won'}
          gaveUp={status === 'lost' && guesses.length < MAX_GUESSES}
          winningFps={status === 'won' && lastFps ? lastFps.fps : null}
          exact={tileRows.length > 0 && isWin(tileRows[tileRows.length - 1])}
          tolerancePct={Math.round(WIN_TOLERANCE * 100)}
          guessCount={guesses.length}
          game={puzzle.game}
          targetFps={puzzle.targetFps}
          cpu={catalog.cpus[puzzle.answer.cpu]}
          gpu={catalog.gpus[puzzle.answer.gpu]}
          ramGB={catalog.ram[puzzle.answer.ram].sizeGB}
          onShare={onShare}
          shareLabel="Share result 📋"
        >
          {resultActions}
        </ResultPanel>
      ) : (
        <form
          className="builder"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          aria-label="Build your rig"
        >
          <PartPicker label="CPU" icon="🧠" options={mark(cpuOptions, 'cpu')} value={selection.cpu} onChange={(v) => setSelection((s) => ({ ...s, cpu: v }))} />
          <PartPicker label="GPU" icon="🎮" options={mark(gpuOptions, 'gpu')} value={selection.gpu} onChange={(v) => setSelection((s) => ({ ...s, gpu: v }))} />
          <PartPicker label="RAM" icon="💾" options={mark(ramOptions, 'ram')} value={selection.ram} onChange={(v) => setSelection((s) => ({ ...s, ram: v }))} />
          <button type="submit" className="btn btn-primary submit-btn">
            Submit build <span className="muted">({guesses.length + 1}/{MAX_GUESSES})</span>
          </button>
          <button
            type="button"
            className="btn giveup-btn"
            onClick={() => {
              if (window.confirm('Give up? The answer will be revealed and this counts as a loss.')) onGiveUp();
            }}
          >
            🏳 Give up
          </button>
        </form>
      )}
    </>
  );
}
