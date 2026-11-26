/**
 * Build planner: pick a game, a target FPS and a resolution, and get the
 * minimum CPU (per brand), GPU (per brand) and RAM that reach it, using the
 * same FPS model and data as the puzzles.
 */
import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { catalog } from './lib/data';
import { RESOLUTIONS, type Resolution } from './lib/config';
import { solveByBrand } from './lib/solver';
import { buildFps, displayFps } from './lib/fps';
import { platformInfo, repeatKey } from './lib/platforms';
import { getPuzzle } from './lib/puzzle';
import { toDateKey } from './lib/date';
import { loadDayState, voidDaily } from './lib/storage';
import { formatLaunch, formatMemory, type Cpu, type Game, type Gpu } from './lib/types';
import { PartPicker, type PickerOption } from './components/PartPicker';
import { GameCard } from './components/GameCard';
import './styles.css';

// The curated puzzle games, plus (when public/data/steam-library.json exists) thousands of
// Steam games whose numbers are estimated from their published system requirements.
// Sorted Z→A because the picker lists the highest index first, so it shows A→Z.
type LibraryRow = [number, string, number, string, number, number, number, number, number];
const byName = (a: Game, b: Game) => b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' });
const fromSteam = new Set<string>();

function toGame([appid, name, year, genre, cpuLoad, gpuLoad, vramGB, ramMinGB, ramRecGB]: LibraryRow): Game {
  const id = `steamlib-${appid}`;
  fromSteam.add(id);
  return { id, platform: 'pc', steamAppId: appid, name, releaseYear: year, genre, cpuLoad, gpuLoad, vramGB, ramMinGB, ramRecGB };
}

function useGames(): { games: Game[]; libraryCount: number } {
  const [library, setLibrary] = useState<Game[]>([]);
  useEffect(() => {
    let live = true;
    fetch('./data/steam-library.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { items?: LibraryRow[] } | null) => {
        if (!live || !data?.items) return;
        const curated = new Set(catalog.games.map((g) => g.steamAppId).filter(Boolean));
        setLibrary(data.items.filter((row) => !curated.has(row[0])).map(toGame));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const games = useMemo(() => [...catalog.games, ...library].sort(byName), [library]);
  return { games, libraryCount: library.length };
}

const FPS_PRESETS = [30, 60, 90, 120, 144, 165, 240];

function Planner() {
  const { games, libraryCount } = useGames();
  const gameOptions: PickerOption[] = useMemo(
    () =>
      games.map((g, i) => ({
        index: i,
        label: g.name,
        detail: `${fromSteam.has(g.id) ? 'Steam requirements' : platformInfo(g.platform).short} · ${g.releaseYear || '—'}`,
      })),
    [games],
  );
  // Selection is kept by id so it survives the library loading in.
  const [gameId, setGameId] = useState<string | null>(null);
  const gameIdx = gameId === null ? null : games.findIndex((g) => g.id === gameId);
  const setGameIdx = (i: number | null) => setGameId(i === null ? null : games[i].id);
  const [fps, setFps] = useState(60);
  const [res, setRes] = useState<Resolution>('1080p');
  const game = gameIdx === null || gameIdx < 0 ? null : games[gameIdx];

  // Today's Daily game is blocked until that Daily is finished, so the planner can't spoil it.
  const todayKey = toDateKey();
  const dailyKey = useMemo(() => repeatKey(getPuzzle(todayKey).game), [todayKey]);
  const [dailyOpen, setDailyOpen] = useState(() => loadDayState(todayKey).status === 'playing');
  const blocked = !!game && dailyOpen && repeatKey(game) === dailyKey;
  const voidToday = () => {
    if (!window.confirm("Void today's Daily? It counts as a loss and resets your win streak, and you'll see this game's specs.")) return;
    voidDaily(todayKey);
    setDailyOpen(false);
  };
  const target = Math.max(1, Math.min(500, Math.round(fps) || 0));

  const result = useMemo(() => {
    if (!game) return null;
    const a = solveByBrand(game, target, catalog, res);
    const cpus = Object.entries(a.cpu).map(([brand, i]) => ({ brand, part: i === null ? null : catalog.cpus[i] }));
    const gpus = Object.entries(a.gpu).map(([brand, i]) => ({ brand, part: i === null ? null : catalog.gpus[i] }));
    const ram = a.ram < 0 ? null : catalog.ram[a.ram].sizeGB;
    return { cpus, gpus, ram };
  }, [game, target, res]);

  // Estimated FPS of the cheapest pairing (first available CPU + GPU of each list).
  const estimate = useMemo(() => {
    if (!game || !result) return null;
    const cpu = result.cpus.find((c) => c.part)?.part;
    const gpu = result.gpus.find((g) => g.part)?.part;
    if (!cpu || !gpu || result.ram === null) return null;
    return buildFps(cpu, gpu, result.ram, game, res);
  }, [game, result, res]);

  const cpuLine = (c: Cpu) => `${c.memory} · ${formatLaunch(c.year, c.month)}`;
  const gpuLine = (g: Gpu) => `${formatMemory(g.vramGB)} VRAM · ${formatLaunch(g.year, g.month)}`;

  return (
    <div className="planner">
      <div className="planner-form">
        <PartPicker
          label="Game"
          icon="🎮"
          options={gameOptions}
          value={gameIdx}
          onChange={setGameIdx}
          sort="tier"
          maxShown={80}
          placeholder={`Search ${games.length.toLocaleString()} games…`}
        />
        {libraryCount > 0 && (
          <p className="planner-note">
            {catalog.games.length} hand-tuned games plus {libraryCount.toLocaleString()} Steam games estimated from their system
            requirements.
          </p>
        )}
        <div className="planner-row">
          <label className="planner-field">
            <span className="picker-label">🎯 Target FPS</span>
            <input
              type="number"
              min={1}
              max={500}
              value={fps}
              onChange={(e) => setFps(Number(e.target.value))}
              className="planner-input"
            />
          </label>
          <div className="planner-field">
            <span className="picker-label">🖥 Resolution</span>
            <div className="brand-switch" role="radiogroup" aria-label="Resolution">
              {RESOLUTIONS.map((r) => (
                <button key={r} type="button" role="radio" aria-checked={res === r} className={`brand-opt${res === r ? ' is-on' : ''}`} onClick={() => setRes(r)}>
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="planner-presets" aria-label="FPS presets">
          {FPS_PRESETS.map((f) => (
            <button key={f} type="button" className={`filter-chip${target === f ? ' is-on' : ''}`} onClick={() => setFps(f)}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {!game && <p className="planner-empty">Pick a game to see the minimum parts.</p>}
      {blocked && (
        <section className="planner-blocked" aria-live="polite">
          <p className="planner-blocked-icon" aria-hidden="true">🔒</p>
          <h2>{game!.name} is today's Daily game</h2>
          <p>To avoid spoiling the puzzle, its specs are hidden until you finish today's Daily.</p>
          <div className="planner-blocked-actions">
            <a className="btn btn-primary" href="./#daily">
              Play today's Daily
            </a>
            <button type="button" className="btn" onClick={voidToday}>
              Void today's Daily and show specs
            </button>
          </div>
          <p className="planner-note">Voiding counts as a loss and resets your win streak.</p>
        </section>
      )}
      {game && result && !blocked && (
        <section className="planner-result" aria-live="polite">
          <h2 className="sr-only">
            {game.name} at {target} FPS, {res}, High settings
          </h2>
          <div className="planner-game">
            <GameCard
              game={game}
              targetFps={target}
              resolution={res}
              label={fromSteam.has(game.id) ? 'Steam requirements' : 'Rigdle game'}
            />
          </div>
          <div className="planner-grid">
            <div className="planner-card">
              <h3>🧠 CPU</h3>
              {result.cpus.map(({ brand, part }) => (
                <p key={brand}>
                  <span className="planner-brand">{brand}</span>
                  {part ? (
                    <>
                      <strong>{part.name}</strong>
                      <small>{cpuLine(part)}</small>
                    </>
                  ) : (
                    <em>None fast enough</em>
                  )}
                </p>
              ))}
            </div>
            <div className="planner-card">
              <h3>🎮 GPU</h3>
              {result.gpus.map(({ brand, part }) => (
                <p key={brand}>
                  <span className="planner-brand">{brand}</span>
                  {part ? (
                    <>
                      <strong>{part.name}</strong>
                      <small>{gpuLine(part)}</small>
                    </>
                  ) : (
                    <em>None fast enough</em>
                  )}
                </p>
              ))}
            </div>
            <div className="planner-card">
              <h3>💾 RAM</h3>
              <p>
                <strong>{result.ram === null ? 'More than 64 GB' : formatMemory(result.ram)}</strong>
                <small>Recommended for {game.name}</small>
              </p>
            </div>
          </div>
          {estimate && (
            <p className="planner-estimate">
              Estimated with the cheapest pairing: <strong className="mono">{displayFps(estimate.fps)} FPS</strong> (CPU{' '}
              {displayFps(estimate.cpuFps)} · GPU {displayFps(estimate.gpuFps)}).
            </p>
          )}
          {fromSteam.has(game.id) && (
            <p className="planner-note">
              Estimated from this game's Steam system requirements, assuming its recommended parts run it at about 55 FPS at
              1080p High. Less precise than Rigdle's hand-tuned games.
            </p>
          )}
          <p className="planner-note">
            These are the weakest parts in Rigdle's list that reach the target, from its simplified FPS model. Real results
            depend on drivers, patches and settings, so treat them as a starting point. See <a href="./accuracy.html">how accurate the model is</a>.
          </p>
        </section>
      )}
    </div>
  );
}

createRoot(document.getElementById('planner-root')!).render(
  <StrictMode>
    <Planner />
  </StrictMode>,
);
