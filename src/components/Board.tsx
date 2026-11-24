import { useMemo, useState, type ReactNode } from 'react';
import { catalog } from '../lib/data';
import { MAX_GUESSES } from '../lib/config';
import { evaluateGuess, isWin } from '../lib/feedback';
import { buildFps } from '../lib/fps';
import { guessIndices } from '../lib/board';
import type { Puzzle } from '../lib/puzzle';
import type { GameStatus, StoredGuess } from '../lib/storage';
import { PART_KEYS, type BuildIdx, type PartKey } from '../lib/types';
import { GameCard } from './GameCard';
import { PartPicker, type PickerOption } from './PartPicker';
import { GuessGrid, type GuessRow } from './GuessGrid';
import { ResultPanel } from './ResultPanel';
import { PcDiagram, type SlotState } from './PcDiagram';

type Selection = { cpu: number | null; gpu: number | null; ram: number | null };

// Picker options are static: no hints about which parts are ruled out.
const cpuOptions: PickerOption[] = catalog.cpus.map((c, i) => ({ index: i, label: c.name, detail: `${c.brand} · ${c.year}` }));
const gpuOptions: PickerOption[] = catalog.gpus.map((g, i) => ({
  index: i,
  label: g.name,
  detail: `${g.brand} · ${g.vramGB} GB · ${g.year}`,
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
}

/** One puzzle: game card, PC diagram, guess grid, and the part pickers or result. */
export function Board({ puzzle, label, guesses: stored, status, onGuess, onShare, toast, resultActions }: Props) {
  const [selection, setSelection] = useState<Selection>({ cpu: null, gpu: null, ram: null });
  const guesses = useMemo(() => guessIndices(stored), [stored]);
  const tileRows = useMemo(() => guesses.map((g) => evaluateGuess(g, puzzle.answer)), [guesses, puzzle.answer]);
  const finished = status !== 'playing';

  const rows: GuessRow[] = guesses.map((g, i) => {
    const b = buildFps(catalog.cpus[g.cpu], catalog.gpus[g.gpu], catalog.ram[g.ram].sizeGB, puzzle.game);
    return {
      names: [partName('cpu', g.cpu), partName('gpu', g.gpu), partName('ram', g.ram)],
      tiles: tileRows[i],
      fps: b.fps,
      vramPenalty: b.vramPenalty,
    };
  });

  // Diagram: a part locks in green once found; otherwise it shows the latest guess.
  const slots = Object.fromEntries(
    PART_KEYS.map((k, j) => {
      let state: SlotState = { name: null, tile: null };
      guesses.forEach((g, i) => {
        if (state.tile?.color !== 'green') state = { name: partName(k, g[k]), tile: tileRows[i][j] };
      });
      if (finished && state.tile?.color !== 'green') {
        // Reveal the answer in the diagram only once the game is over.
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
      isWin(evaluateGuess(guess, puzzle.answer)),
    );
  };

  return (
    <>
      <GameCard game={puzzle.game} targetFps={puzzle.targetFps} label={label} />
      <PcDiagram slots={slots} />
      <GuessGrid rows={rows} targetFps={puzzle.targetFps} />
      {finished ? (
        <ResultPanel
          won={status === 'won'}
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
          <PartPicker label="CPU" icon="🧠" options={cpuOptions} value={selection.cpu} onChange={(v) => setSelection((s) => ({ ...s, cpu: v }))} />
          <PartPicker label="GPU" icon="🎮" options={gpuOptions} value={selection.gpu} onChange={(v) => setSelection((s) => ({ ...s, gpu: v }))} />
          <PartPicker label="RAM" icon="💾" options={ramOptions} value={selection.ram} onChange={(v) => setSelection((s) => ({ ...s, ram: v }))} />
          <button type="submit" className="btn btn-primary submit-btn">
            Submit build <span className="muted">({guesses.length + 1}/{MAX_GUESSES})</span>
          </button>
        </form>
      )}
    </>
  );
}
