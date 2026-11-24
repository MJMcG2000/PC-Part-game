import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { generateEndless, getPuzzle, puzzleFromSaved } from './lib/puzzle';
import { toDateKey } from './lib/date';
import { MAX_GUESSES } from './lib/config';
import { buildShareText } from './lib/share';
import { tileRowsFor } from './lib/board';
import { PLATFORMS, repeatKey, type PlatformFilter } from './lib/platforms';
import {
  effectiveStreak,
  loadDayState,
  loadEndless,
  loadEndlessStats,
  loadSettings,
  loadStats,
  recordEndless,
  recordResult,
  saveDayState,
  saveEndless,
  saveEndlessStats,
  saveSettings,
  saveStats,
  type DayState,
  type EndlessState,
  type Mode,
  type Settings,
  type StoredGuess,
} from './lib/storage';
import { Board } from './components/Board';
import { HelpModal } from './components/HelpModal';
import { StatsModal } from './components/StatsModal';
import { Countdown } from './components/Countdown';

const RECENT_KEEP = 60;
const freshSeed = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/** Start a new Endless puzzle with the given filter, keeping the recent-games history. */
function nextEndless(prev: EndlessState, filter: PlatformFilter): EndlessState {
  const p = generateEndless(freshSeed(), filter, prev.recent);
  return {
    gameId: p.game.id,
    targetFps: p.targetFps,
    filter,
    guesses: [],
    status: 'playing',
    recent: [...prev.recent, repeatKey(p.game)].slice(-RECENT_KEEP),
  };
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
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
    return ok;
  }
}

export default function App() {
  const [now, setNow] = useState(() => new Date());
  const todayKey = toDateKey(now);
  const daily = useMemo(() => getPuzzle(todayKey), [todayKey]);

  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [stats, setStats] = useState(loadStats);
  const [day, setDay] = useState<DayState>(() => loadDayState(todayKey));
  const [endless, setEndless] = useState<EndlessState>(() => {
    const s = loadEndless();
    return s.gameId && puzzleFromSaved(s.gameId, s.targetFps) ? s : nextEndless(s, s.filter);
  });
  const [endlessStats, setEndlessStats] = useState(loadEndlessStats);
  const [helpOpen, setHelpOpen] = useState(() => !loadSettings().seenHelp);
  const [statsOpen, setStatsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const mode: Mode = settings.mode;
  const endlessPuzzle = useMemo(
    () => puzzleFromSaved(endless.gameId ?? '', endless.targetFps) ?? generateEndless(freshSeed(), endless.filter, []),
    [endless.gameId, endless.targetFps, endless.filter],
  );

  // Tick every second for the countdown; roll over to the new daily puzzle at local midnight.
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    if (day.dateKey !== todayKey) setDay(loadDayState(todayKey));
  }, [todayKey, day.dateKey]);

  useEffect(() => saveDayState(day), [day]);
  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => saveStats(stats), [stats]);
  useEffect(() => saveEndless(endless), [endless]);
  useEffect(() => saveEndlessStats(endlessStats), [endlessStats]);
  useEffect(() => {
    document.documentElement.classList.toggle('colorblind', settings.colorblind);
  }, [settings.colorblind]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const share = async (text: string) => showToast((await copyText(text)) ? 'Copied results to clipboard' : 'Could not copy. Try again.');

  const shareDaily = () =>
    share(
      buildShareText({
        number: daily.number,
        targetFps: daily.targetFps,
        rows: tileRowsFor(daily, day.guesses),
        won: day.status === 'won',
        colorblind: settings.colorblind,
      }),
    );
  const shareEndless = () =>
    share(
      buildShareText({
        number: 0,
        label: 'Endless',
        targetFps: endlessPuzzle.targetFps,
        rows: tileRowsFor(endlessPuzzle, endless.guesses),
        won: endless.status === 'won',
        colorblind: settings.colorblind,
      }),
    );

  const onDailyGuess = (g: StoredGuess, won: boolean) => {
    const guesses = [...day.guesses, g];
    const status = won ? 'won' : guesses.length >= MAX_GUESSES ? 'lost' : 'playing';
    setDay({ ...day, guesses, status });
    if (status !== 'playing') {
      setStats((s) => recordResult(s, todayKey, won, guesses.length));
      window.setTimeout(() => setStatsOpen(true), 1400);
    }
  };

  const onEndlessGuess = (g: StoredGuess, won: boolean) => {
    const guesses = [...endless.guesses, g];
    const status = won ? 'won' : guesses.length >= MAX_GUESSES ? 'lost' : 'playing';
    setEndless({ ...endless, guesses, status });
    if (status !== 'playing') setEndlessStats((s) => recordEndless(s, won, guesses.length));
  };

  const changeFilter = (filter: PlatformFilter) => {
    if (filter === endless.filter) return;
    if (endless.guesses.length === 0 || endless.status !== 'playing') {
      setEndless((s) => nextEndless(s, filter));
    } else {
      // Don't throw away a puzzle in progress: the filter applies to the next rig.
      setEndless((s) => ({ ...s, filter }));
      showToast('Platform applies to your next rig');
    }
  };

  const setMode = (m: Mode) => setSettings((s) => ({ ...s, mode: m }));

  const closeHelp = () => {
    setHelpOpen(false);
    if (!settings.seenHelp) setSettings((s) => ({ ...s, seenHelp: true }));
  };

  const dailyLabel =
    daily.number > 0 ? `Rigdle #${daily.number}` : `Preview · launches in ${1 - daily.number} day${daily.number === 0 ? '' : 's'}`;

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

      <nav className="mode-tabs" aria-label="Game mode">
        {(['daily', 'endless'] as const).map((m) => (
          <button key={m} className={`mode-tab${mode === m ? ' is-on' : ''}`} aria-pressed={mode === m} onClick={() => setMode(m)}>
            {m === 'daily' ? 'Daily' : 'Endless ∞'}
          </button>
        ))}
      </nav>

      <main className="main">
        {mode === 'daily' ? (
          <>
            <Board
              key={`daily-${todayKey}`}
              puzzle={daily}
              label={dailyLabel}
              guesses={day.guesses}
              status={day.status}
              onGuess={onDailyGuess}
              onShare={shareDaily}
              toast={showToast}
            />
            <Countdown now={now} />
          </>
        ) : (
          <>
            <div className="platform-filter" role="group" aria-label="Platform">
              {(['all', ...PLATFORMS.map((p) => p.id)] as PlatformFilter[]).map((id) => (
                <button
                  key={id}
                  className={`filter-chip${endless.filter === id ? ' is-on' : ''}`}
                  aria-pressed={endless.filter === id}
                  onClick={() => changeFilter(id)}
                >
                  {id === 'all' ? 'All' : PLATFORMS.find((p) => p.id === id)!.short}
                </button>
              ))}
            </div>
            <p className="endless-stats">
              Solved <strong>{endlessStats.wins}</strong> · Streak <strong>{endlessStats.streak}</strong> · Best{' '}
              <strong>{endlessStats.best}</strong>
            </p>
            <Board
              key={`endless-${endless.gameId}-${endless.targetFps}-${endless.recent.length}`}
              puzzle={endlessPuzzle}
              label="Endless"
              guesses={endless.guesses}
              status={endless.status}
              onGuess={onEndlessGuess}
              onShare={shareEndless}
              toast={showToast}
              resultActions={
                <button className="btn btn-primary next-btn" onClick={() => setEndless((s) => nextEndless(s, s.filter))}>
                  Next rig →
                </button>
              }
            />
          </>
        )}
      </main>

      <footer className="footer">
        <p>
          FPS is a simplified, approximate model ({'min(CPU, GPU) × RAM'}), not a benchmark. Console games are estimated as played on a
          PC (via emulation or a PC port). Not affiliated with Valve, Steam, Sony, Microsoft or Nintendo.
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
        highlight={day.status === 'won' ? day.guesses.length : null}
        finished={day.status !== 'playing'}
        onShare={shareDaily}
        shareLabel="Share daily result 📋"
        now={now}
        endless={endlessStats}
      />
    </div>
  );
}
