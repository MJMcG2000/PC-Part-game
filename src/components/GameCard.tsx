import { useEffect, useState } from 'react';
import type { Game } from '../lib/types';
import { PRESET, RESOLUTION } from '../lib/config';

const imageSources = (id: number) => [
  `https://cdn.akamai.steamstatic.com/steam/apps/${id}/header.jpg`,
  `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/header.jpg`,
];

interface Props {
  game: Game;
  targetFps: number;
  label: string;
}

export function GameCard({ game, targetFps, label }: Props) {
  const [srcIdx, setSrcIdx] = useState(0);
  useEffect(() => setSrcIdx(0), [game.steamAppId]);
  const sources = imageSources(game.steamAppId);
  const failed = srcIdx >= sources.length;

  return (
    <>
    <section className="game-card" aria-label="Today's game">
      <div className="game-art">
        {failed ? (
          <div className="game-art-fallback" role="img" aria-label={`${game.name} (image unavailable)`}>
            <span>{game.name}</span>
          </div>
        ) : (
          <img
            src={sources[srcIdx]}
            alt={`${game.name} header art`}
            width={460}
            height={215}
            onError={() => setSrcIdx((i) => i + 1)}
          />
        )}
      </div>
      <div className="game-meta">
        <span className="puzzle-label">{label}</span>
        <h2 className="game-title">{game.name}</h2>
        <p className="game-sub">
          {game.genre} · {game.releaseYear} ·{' '}
          <a href={`https://store.steampowered.com/app/${game.steamAppId}/`} target="_blank" rel="noreferrer noopener">
            Steam page ↗
          </a>
        </p>
      </div>
    </section>

    <section className="target-banner" aria-label={`Target: ${targetFps} FPS at ${RESOLUTION}, ${PRESET} settings`}>
      <span className="tb-label">TARGET</span>
      <span className="tb-fps">
        <span className="tb-value mono">{targetFps}</span>
        <span className="tb-unit">FPS</span>
      </span>
      <span className="tb-at" aria-hidden="true">@</span>
      <span className="tb-res">
        <span className="tb-res-main mono">{RESOLUTION}</span>
        <span className="tb-res-sub">{PRESET} settings</span>
      </span>
    </section>
    </>
  );
}
