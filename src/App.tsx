import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { catalog } from './lib/data';
import { getPuzzle } from './lib/puzzle';
import { toDateKey } from './lib/date';
import { MAX_GUESSES } from './lib/config';
import { evaluateGuess, isWin, possibleRange, type Tile } from './lib/feedback';
import { buildFps } from './lib/fps';
import { buildShareText } from './lib/share';
import {
  effectiveStreak,
  loadDayState,
  loadSettings,
  loadStats,
  recordResult,
  saveDayState,
  saveSettings,
  saveStats,
  type DayState,
  type Settings,
  type StoredGuess,
} from './lib/storage';
import { PART_KEYS, type BuildIdx, type PartKey } from './lib/types';
import { GameCard } from './components/GameCard';
import { PartPicker, type PickerOption } from './components/PartPicker';
import { GuessGrid, type GuessRow } from './components/GuessGrid';
import { ResultPanel } from './components/ResultPanel';
import { HelpModal } from './components/HelpModal';
import { StatsModal } from './components/StatsModal';
import { Countdown } from './components/Countdown';

type Selection = { cpu: number | null; gpu: number | null; ram: number | null };
const EMPTY_SELECTION: Selection = { cpu: null, gpu: null, ram: null };

/** Map stored (name-based) guesses back to tier indices; drop any that no longer resolve. */
function toIdx(g: StoredGuess): BuildIdx | null {
  const cpu = catalog.cpus.findIndex((c) => c.name === g.cpu);
  const gpu = catalog.gpus.findIndex((c) => c.name === g.gpu);
  const ram = catalog.ram.findIndex((r) => r.sizeGB === g.ramGB);
  return cpu < 0 || gpu < 0 || ram < 0 ? null : { cpu, gpu, ram };
}

export default function App() {
  const [now, setNow] = useState(() => new Date());
  const todayKey = toDateKey(now);
  const puzzle = useMemo(() => getPuzzle(todayKey), [todayKey]);

  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [stats, setStats] = useState(loadStats);
  const [day, setDay] = useState<DayState>(() => loadDayState(todayKey));
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION);
  const [helpOpen, setHelpOpen] = useState(() => !loadSettings().seenHelp);
  const [statsOpen, setStatsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  // Tick every second for the countdown; roll over to the new puzzle at local midnight.
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    if (day.dateKey !== todayKey) {
      setDay(loadDayState(todayKey));
      setSelection(EMPTY_SELECTION);
    }
  }, [todayKey, day.dateKey]);

  useEffect(() => saveDayState(day), [day]);
  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => saveStats(stats), [stats]);

  useEffect(() => {
    document.documentElement.classList.toggle('colorblind', settings.colorblind);
  }, [settings.colorblind]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const guesses = useMemo(() => day.guesses.map(toIdx).filter((g): g is BuildIdx => g !== null), [day.guesses]);
  const tileRows: Tile[][] = useMemo(() => guesses.map((g) => evaluateGuess(g, puzzle.answer)), [guesses, puzzle.answer]);
  const rows: GuessRow[] = useMemo(
    () =>
      guesses.map((g, i) => {
        const cpu = catalog.cpus[g.cpu];
        const gpu = catalog.gpus[g.gpu];
        const ramGB = catalog.ram[g.ram].sizeGB;
        const b = buildFps(cpu, gpu, ramGB, puzzle.game);
        return { names: [cpu.name, gpu.name, `${ramGB} GB`], tiles: tileRows[i], fps: b.fps, vramPenalty: b.vramPenalty };
      }),
    [guesses, tileRows, puzzle.game],
  );

  const finished = day.status !== 'playing';
  const won = day.status === 'won';

  // Options for the pickers, with parts ruled out by feedback dimmed.
  const ranges = useMemo(() => {
    const counts = { cpu: catalog.cpus.length, gpu: catalog.gpus.length, ram: catalog.ram.length };
    return Object.fromEntries(
      PART_KEYS.map((k, j) => [
        k,
        possibleRange(
          guesses.map((g, i) => ({ guess: g[k], tile: tileRows[i][j] })),
          counts[k],
        ),
      ]),
    ) as Record<PartKey, [number, number]>;
  }, [guesses, tileRows]);
  const { cpuOptions, gpuOptions, ramOptions } = useMemo(() => {
    const out = (k: PartKey, i: number) => i < ranges[k][0] || i > ranges[k][1];
    return {
      cpuOptions: catalog.cpus.map<PickerOption>((c, i) => ({
        index: i,
        label: c.name,
        detail: `${c.brand} · ${c.year}`,
        ruledOut: out('cpu', i),
      })),
      gpuOptions: catalog.gpus.map<PickerOption>((g, i) => ({
        index: i,
        label: g.name,
        detail: `${g.brand} · ${g.vramGB} GB · ${g.year}`,
        ruledOut: out('gpu', i),
      })),
      ramOptions: catalog.ram.map<PickerOption>((r, i) => ({ index: i, label: `${r.sizeGB} GB`, ruledOut: out('ram', i) })),
    };
  }, [ranges]);

  const shareText = () =>
    buildShareText({
      number: puzzle.number,
      targetFps: puzzle.targetFps,
      rows: tileRows,
      won,
      colorblind: settings.colorblind,
    });

  const onShare = async () => {
    const text = shareText();
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied results to clipboard');
    } catch {
      // Fallback for browsers/contexts without the async clipboard API.
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      showToast(ok ? 'Copied results to clipboard' : 'Could not copy. Try again.');
    }
  };

  const submit = () => {
    if (finished) return;
    const { cpu, gpu, ram } = selection;
    if (cpu === null || gpu === null || ram === null) {
      showToast('Pick a CPU, GPU and RAM first');
      return;
    }
    if (guesses.some((g) => g.cpu === cpu && g.gpu === gpu && g.ram === ram)) {
      showToast('You already tried that build');
      return;
    }
    const guess: BuildIdx = { cpu, gpu, ram };
    const stored: StoredGuess = { cpu: catalog.cpus[cpu].name, gpu: catalog.gpus[gpu].name, ramGB: catalog.ram[ram].sizeGB };
    const nextGuesses = [...day.guesses, stored];
    const winNow = isWin(evaluateGuess(guess, puzzle.answer));
    const status = winNow ? 'won' : nextGuesses.length >= MAX_GUESSES ? 'lost' : 'playing';
    setDay({ ...day, guesses: nextGuesses, status });
    if (status !== 'playing') {
      setStats((s) => recordResult(s, todayKey, winNow, nextGuesses.length));
      window.setTimeout(() => setStatsOpen(true), 1400);
    }
  };

  const closeHelp = () => {
    setHelpOpen(false);
    if (!settings.seenHelp) setSettings((s) => ({ ...s, seenHelp: true }));
  };

  const label = puzzle.number > 0 ? `Rigdle #${puzzle.number}` : `Preview · launches in ${1 - puzzle.number} day${puzzle.number === 0 ? '' : 's'}`;
  const shareLabel = 'Share result 📋';

  return (
    <div className="app">
      <header className="topbar">
        <button className="icon-btn" onClick={() => setHelpOpen(true)} aria-label="How to play">
          ?
        </button>
        <h1 className="logo">
          <span className="logo-text">RIGDLE</span>
        </h1>
        <div className="topbar-right">
          <button
            className={`icon-btn cb-toggle${settings.colorblind ? ' is-on' : ''}`}
            onClick={() => setSettings((s) => ({ ...s, colorblind: !s.colorblind }))}
            aria-pressed={settings.colorblind}
            aria-label="Colorblind mode"
            title="Colorblind mode (orange/blue tiles)"
          >
            <span aria-hidden="true">👁</span>
          </button>
          <button className="icon-btn" onClick={() => setStatsOpen(true)} aria-label="Statistics">
            <span aria-hidden="true">▮▮▯</span>
          </button>
        </div>
      </header>

      <main className="main">
        <GameCard game={puzzle.game} targetFps={puzzle.targetFps} label={label} />

        <GuessGrid rows={rows} targetFps={puzzle.targetFps} />

        {finished ? (
          <ResultPanel
            won={won}
            guessCount={guesses.length}
            game={puzzle.game}
            targetFps={puzzle.targetFps}
            cpu={catalog.cpus[puzzle.answer.cpu]}
            gpu={catalog.gpus[puzzle.answer.gpu]}
            ramGB={catalog.ram[puzzle.answer.ram].sizeGB}
            onShare={onShare}
            shareLabel={shareLabel}
          />
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

        <Countdown now={now} />
      </main>

      <footer className="footer">
        <p>
          FPS is a simplified, approximate model ({'min(CPU, GPU) × RAM'}), not a benchmark. Not affiliated with Valve or Steam.
        </p>
      </footer>

      <div className="toast" role="status" aria-live="polite">
        {toast && <span>{toast}</span>}
      </div>

      <HelpModal open={helpOpen} onClose={closeHelp} />
      <StatsModal
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
        stats={stats}
        streak={effectiveStreak(stats, todayKey)}
        highlight={won ? guesses.length : null}
        finished={finished}
        onShare={onShare}
        shareLabel={shareLabel}
        now={now}
      />
    </div>
  );
}
