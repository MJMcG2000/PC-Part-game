import { useMemo, useState, type ReactNode } from 'react';
import { catalog } from '../lib/data';
import { WIN_TOLERANCE, maxGuesses } from '../lib/config';
import { evaluateBuild, isWin } from '../lib/feedback';
import { buildFps, displayFps, isCloseEnough } from '../lib/fps';
import { gpuChecker, guessIndices } from '../lib/board';
import { acceptedAnswers, type Puzzle } from '../lib/puzzle';
import type { GameStatus, PartSort, StoredGuess } from '../lib/storage';
import { PART_KEYS, formatLaunch, formatMemory, launchKey, type BuildIdx, type PartKey } from '../lib/types';
import { GameCard } from './GameCard';
import { PartPicker, type PickerOption } from './PartPicker';
import { ResultPanel } from './ResultPanel';
import { PcDiagram, type SlotState } from './PcDiagram';

type Selection = { cpu: number | null; gpu: number | null; ram: number | null };

// Picker options. `index` is the performance tier (used for feedback); the pickers list CPUs/GPUs by launch date.
const cpuOptions = catalog.cpus.map((c, i) => ({
  index: i,
  brand: c.brand,
  label: c.name,
  detail: `${c.memory} · ${formatLaunch(c.year, c.month)}`,
  released: launchKey(c.year, c.month),
}));
const gpuOptions = catalog.gpus.map((g, i) => ({
  index: i,
  brand: g.brand,
  label: g.name,
  detail: `${formatMemory(g.vramGB)} · ${formatLaunch(g.year, g.month)}`,
  released: launchKey(g.year, g.month),
}));

// Brand switches: CPU "AMD" (Ryzen, FX, Phenom, Athlon) or "Intel"; GPU "NVIDIA" or "AMD" (incl. ATI Radeon).
const CPU_BRANDS = [
  { id: 'AMD', label: 'AMD' },
  { id: 'Intel', label: 'Intel' },
];
const GPU_BRANDS = [
  { id: 'NVIDIA', label: 'NVIDIA' },
  { id: 'AMD', label: 'AMD' },
];

/** RAM label with the type set by a CPU, e.g. "16 GB DDR5". */
const ramName = (ramIdx: number, cpuIdx: number) => `${formatMemory(catalog.ram[ramIdx].sizeGB)} ${catalog.cpus[cpuIdx].memory}`;

const partName = (k: PartKey, g: BuildIdx) =>
  k === 'cpu' ? catalog.cpus[g.cpu].name : k === 'gpu' ? catalog.gpus[g.gpu].name : ramName(g.ram, g.cpu);

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
  /** Desktop layout: three columns (game + target | PC diagram | guessing) so nothing needs scrolling. */
  desktop?: boolean;
  /** Extra content for the game column on desktop (shown at the bottom on mobile), e.g. the countdown. */
  aside?: ReactNode;
  /** Picker order (saved in settings). */
  partSort?: PartSort;
  onPartSort?: (s: PartSort) => void;
}

const SORTS: { id: PartSort; label: string }[] = [
  { id: 'tier', label: 'By tier' },
  { id: 'newest', label: 'Newest' },
];

/** One puzzle: game card, PC diagram, guess grid, and the part pickers or result. */
export function Board({ puzzle, label, guesses: stored, status, onGuess, onShare, toast, resultActions, hard, onGiveUp, desktop = false, aside, partSort = 'tier', onPartSort }: Props) {
  const [selection, setSelection] = useState<Selection>({ cpu: null, gpu: null, ram: null });
  const [cpuBrand, setCpuBrand] = useState(CPU_BRANDS[0].id);
  const [gpuBrand, setGpuBrand] = useState(GPU_BRANDS[0].id);

  // Switching brand clears a selected part of the other brand.
  const changeCpuBrand = (b: string) => {
    setCpuBrand(b);
    setSelection((s) => (s.cpu !== null && catalog.cpus[s.cpu].brand !== b ? { ...s, cpu: null } : s));
  };
  const changeGpuBrand = (b: string) => {
    setGpuBrand(b);
    setSelection((s) => (s.gpu !== null && catalog.gpus[s.gpu].brand !== b ? { ...s, gpu: null } : s));
  };

  // RAM type follows the selected CPU's platform.
  const ramType = selection.cpu !== null ? catalog.cpus[selection.cpu].memory : null;
  const ramOptions: PickerOption[] = catalog.ram.map((r, i) => ({ index: i, label: `${formatMemory(r.sizeGB)}${ramType ? ` ${ramType}` : ''}` }));
  const ramNote = ramType
    ? `${ramType}: the RAM type the ${catalog.cpus[selection.cpu!].name} uses.`
    : 'RAM type (SDR through DDR5) follows the CPU you pick.';
  const guesses = useMemo(() => guessIndices(stored), [stored]);
  // Either brand's minimum CPU/GPU counts as correct.
  const accepted = acceptedAnswers(puzzle);
  const checkGpu = useMemo(() => gpuChecker(puzzle), [puzzle]);
  const tileRows = useMemo(() => guesses.map((g) => evaluateBuild(g, accepted, catalog, checkGpu)), [guesses, accepted, checkGpu]);
  const cpuAlts = Object.values(accepted.cpu).filter((i): i is number => i !== null).map((i) => catalog.cpus[i]);
  const gpuAlts = Object.values(accepted.gpu).filter((i): i is number => i !== null).map((i) => catalog.gpus[i]);
  const finished = status !== 'playing';
  const limit = maxGuesses(hard);

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
        if (state.tile?.color !== 'green') state = { name: partName(k, g), tile: tileRows[i][j] };
      });
      if (status === 'lost' && state.tile?.color !== 'green') {
        // Reveal the answer in the diagram only once the game is lost
        // (a ±10% win keeps showing the player's own build).
        const name =
          k === 'cpu' ? cpuAlts.map((c) => c.name).join(' / ') : k === 'gpu' ? gpuAlts.map((g) => g.name).join(' / ') : partName(k, puzzle.answer);
        state = { name, tile: { part: k, color: 'green', direction: null } };
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
      isWin(evaluateBuild(guess, accepted, catalog, checkGpu)) ||
        (!hard &&
          isCloseEnough(buildFps(catalog.cpus[cpu], catalog.gpus[gpu], catalog.ram[ram].sizeGB, puzzle.game, puzzle.resolution).fps, puzzle.targetFps)),
    );
  };

  return (
    <div className={`board${desktop ? ' board-desktop' : ''}`}>
      <div className="board-game">
        <GameCard game={puzzle.game} targetFps={puzzle.targetFps} resolution={puzzle.resolution} label={label} />
        {desktop && aside}
      </div>
      <div className="board-pc">
      <PcDiagram slots={slots} />
      <p className="pc-readout" aria-live="polite">
        {hard && <span className="hard-badge">HARD</span>}
        <span>
          Guess <strong className="mono">{Math.min(guesses.length, limit)}</strong>/{limit}
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
            <span className="readout-src">
              {(lastFps.limitedBy === 'cpu' ? lastFps.cpuSource : lastFps.gpuSource) ? ' · benchmark' : ' · estimate'}
            </span>
            {lastFps.vramPenalty && <span className="vram-flag" title="GPU has less VRAM than this game needs (×0.6)">VRAM</span>}
          </span>
        )}
      </p>
      </div>
      <div className="board-guess">
      {finished ? (
        <ResultPanel
          resolution={puzzle.resolution}
          won={status === 'won'}
          gaveUp={status === 'lost' && guesses.length < limit}
          maxGuesses={limit}
          winningFps={status === 'won' && lastFps ? lastFps.fps : null}
          exact={tileRows.length > 0 && isWin(tileRows[tileRows.length - 1])}
          tolerancePct={Math.round(WIN_TOLERANCE * 100)}
          guessCount={guesses.length}
          game={puzzle.game}
          targetFps={puzzle.targetFps}
          cpu={catalog.cpus[puzzle.answer.cpu]}
          gpu={catalog.gpus[puzzle.answer.gpu]}
          cpuAlts={cpuAlts}
          gpuAlts={gpuAlts}
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
          <div className="sort-row">
            <span className="sort-label" id="part-sort-label">
              Sort parts
            </span>
            <div className="brand-switch" role="radiogroup" aria-labelledby="part-sort-label">
              {SORTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={partSort === s.id}
                  className={`brand-opt${partSort === s.id ? ' is-on' : ''}`}
                  onClick={() => onPartSort?.(s.id)}
                  title={s.id === 'tier' ? 'Strongest first: the order tiles count tiers in' : 'Newest launch first'}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <a className="sort-help" href="./tiers.html">
              What's a tier?
            </a>
          </div>
          <PartPicker
            label="CPU"
            icon="🧠"
            brands={CPU_BRANDS}
            brand={cpuBrand}
            onBrandChange={changeCpuBrand}
            options={mark(cpuOptions.filter((o) => o.brand === cpuBrand), 'cpu')}
            value={selection.cpu}
            onChange={(v) => setSelection((s) => ({ ...s, cpu: v }))}
            sort={partSort}
          />
          <PartPicker
            label="GPU"
            icon="🎮"
            brands={GPU_BRANDS}
            brand={gpuBrand}
            onBrandChange={changeGpuBrand}
            options={mark(gpuOptions.filter((o) => o.brand === gpuBrand), 'gpu')}
            value={selection.gpu}
            onChange={(v) => setSelection((s) => ({ ...s, gpu: v }))}
            sort={partSort}
          />
          <PartPicker
            label="RAM"
            icon="💾"
            note={ramNote}
            options={mark(ramOptions, 'ram')}
            value={selection.ram}
            onChange={(v) => setSelection((s) => ({ ...s, ram: v }))}
          />
          <button type="submit" className="btn btn-primary submit-btn">
            Submit build <span className="muted">({guesses.length + 1}/{limit})</span>
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
      </div>
      {!desktop && aside}
    </div>
  );
}
