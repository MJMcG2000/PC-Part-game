import { MAX_GUESSES } from '../lib/config';
import { arrowFor, type Tile } from '../lib/feedback';
import { displayFps } from '../lib/fps';

export interface GuessRow {
  names: [cpu: string, gpu: string, ram: string];
  tiles: Tile[];
  fps: number;
  vramPenalty: boolean;
}

const PART_LABEL = { cpu: 'CPU', gpu: 'GPU', ram: 'RAM' } as const;

function describe(t: Tile, name: string) {
  const status =
    t.color === 'green'
      ? 'correct'
      : `${t.color === 'yellow' ? 'one tier away' : 'two or more tiers away'}, ${t.direction === 'up' ? 'too weak, go stronger' : 'overkill, go weaker'}`;
  return `${PART_LABEL[t.part]} ${name}: ${status}`;
}

export function GuessGrid({ rows, targetFps }: { rows: GuessRow[]; targetFps: number }) {
  const empties = Math.max(0, MAX_GUESSES - rows.length);
  return (
    <section className="grid" aria-label="Your guesses">
      <div className="grid-head" aria-hidden="true">
        <span>CPU</span>
        <span>GPU</span>
        <span>RAM</span>
        <span>FPS</span>
      </div>
      <ol className="grid-rows">
        {rows.map((r, i) => {
          const hit = r.fps + 1e-6 >= targetFps;
          return (
            <li key={i} className="grid-row" aria-label={`Guess ${i + 1}`}>
              {r.tiles.map((t, j) => (
                <div
                  key={t.part}
                  className={`tile tile-${t.color}`}
                  style={{ animationDelay: `${j * 90}ms` }}
                  aria-label={describe(t, r.names[j])}
                  role="img"
                >
                  <span className="tile-name">{r.names[j]}</span>
                  <span className="tile-arrow" aria-hidden="true">
                    {t.color === 'green' ? '✓' : arrowFor(t.direction)}
                  </span>
                </div>
              ))}
              <div
                className={`fps-chip ${hit ? 'is-hit' : 'is-miss'}`}
                aria-label={`Estimated ${displayFps(r.fps)} FPS, ${hit ? 'meets' : 'below'} target${r.vramPenalty ? ', GPU short on VRAM' : ''}`}
                role="img"
              >
                <span className="mono">{displayFps(r.fps)}</span>
                {r.vramPenalty && (
                  <span className="vram-flag" title="GPU has less VRAM than this game needs (×0.6)">
                    VRAM
                  </span>
                )}
              </div>
            </li>
          );
        })}
        {Array.from({ length: empties }, (_, i) => (
          <li key={`e${i}`} className="grid-row is-empty" aria-hidden="true">
            <div className="tile" />
            <div className="tile" />
            <div className="tile" />
            <div className="fps-chip" />
          </li>
        ))}
      </ol>
    </section>
  );
}
