import { useEffect, useState } from 'react';
import type { Game } from '../lib/types';
import { PRESET, RESOLUTION } from '../lib/config';
import { BASIS_LABEL, platformInfo } from '../lib/platforms';

const imageSources = (id?: number) =>
  id
    ? [
        `https://cdn.akamai.steamstatic.com/steam/apps/${id}/header.jpg`,
        `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/header.jpg`,
      ]
    : [];

interface Props {
  game: Game;
  targetFps: number;
  label: string;
}

export function GameCard({ game, targetFps, label }: Props) {
  const [srcIdx, setSrcIdx] = useState(0);
  useEffect(() => setSrcIdx(0), [game.id]);
  const sources = imageSources(game.steamAppId);
  const failed = srcIdx >= sources.length;
  const platform = platformInfo(game.platform);
  const link = game.steamAppId
    ? { href: `https://store.steampowered.com/app/${game.steamAppId}/`, text: 'Steam page ↗' }
    : {
        href: `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(`${game.name} video game`)}`,
        text: 'About ↗',
      };

  return (
    <>
      <section className="game-card" aria-label="Game">
        <div className={`game-art platform-${game.platform}`}>
          {failed ? (
            <div className="game-art-fallback" role="img" aria-label={`${game.name} (no image)`}>
              <span className="fallback-platform">{platform.label}</span>
              <span className="fallback-name">{game.name}</span>
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
          <div className="game-meta-top">
            <span className="puzzle-label">{label}</span>
            <span className={`platform-chip platform-${game.platform}`}>{platform.short}</span>
          </div>
          <h2 className="game-title">{game.name}</h2>
          <p className="game-sub">
            {game.genre} · {game.releaseYear} ·{' '}
            <a href={link.href} target="_blank" rel="noreferrer noopener">
              {link.text}
            </a>
          </p>
          {platform.basis !== 'native' && <p className="game-basis">{BASIS_LABEL[platform.basis]}</p>}
        </div>
      </section>

      <section className="target-banner" aria-label={`Target: ${targetFps} FPS at ${RESOLUTION}, ${PRESET} settings`}>
        <span className="tb-label">TARGET</span>
        <span className="tb-fps">
          <span className="tb-value mono">{targetFps}</span>
          <span className="tb-unit">FPS</span>
        </span>
        <span className="tb-at" aria-hidden="true">
          @
        </span>
        <span className="tb-res">
          <span className="tb-res-main mono">{RESOLUTION}</span>
          <span className="tb-res-sub">{PRESET} settings</span>
        </span>
      </section>
    </>
  );
}
