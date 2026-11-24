import { Modal } from './Modal';
import type { EndlessStats, Stats } from '../lib/storage';
import { Countdown } from './Countdown';

interface Props {
  open: boolean;
  onClose: () => void;
  stats: Stats;
  streak: number;
  highlight: number | null; // guess count of today's win
  finished: boolean;
  onShare: () => void;
  shareLabel: string;
  now: Date;
  endless: EndlessStats;
}

export function StatsModal({ open, onClose, stats, streak, highlight, finished, onShare, shareLabel, now, endless }: Props) {
  const winPct = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
  const max = Math.max(1, ...stats.distribution);
  return (
    <Modal open={open} title="Statistics" onClose={onClose}>
      <div className="stats">
        <h3>Daily</h3>
        <dl className="stat-row">
          <div>
            <dt>Played</dt>
            <dd>{stats.played}</dd>
          </div>
          <div>
            <dt>Win %</dt>
            <dd>{winPct}</dd>
          </div>
          <div>
            <dt>Current streak</dt>
            <dd>{streak}</dd>
          </div>
          <div>
            <dt>Max streak</dt>
            <dd>{stats.maxStreak}</dd>
          </div>
        </dl>
        <h3>Daily guess distribution</h3>
        <ol className="dist">
          {stats.distribution.map((n, i) => (
            <li key={i}>
              <span className="dist-n mono">{i + 1}</span>
              <span
                className={`dist-bar${highlight === i + 1 ? ' is-today' : ''}`}
                style={{ width: `${Math.max(8, (n / max) * 100)}%` }}
              >
                {n}
              </span>
            </li>
          ))}
        </ol>
        <h3>Endless</h3>
        <dl className="stat-row">
          <div>
            <dt>Played</dt>
            <dd>{endless.played}</dd>
          </div>
          <div>
            <dt>Win %</dt>
            <dd>{endless.played ? Math.round((endless.wins / endless.played) * 100) : 0}</dd>
          </div>
          <div>
            <dt>Streak</dt>
            <dd>{endless.streak}</dd>
          </div>
          <div>
            <dt>Best streak</dt>
            <dd>{endless.best}</dd>
          </div>
        </dl>
        {finished && (
          <div className="stats-foot">
            <Countdown now={now} />
            <button className="btn btn-primary" onClick={onShare}>
              {shareLabel}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
