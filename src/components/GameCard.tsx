import { useEffect, useState } from 'react';
import type { Game } from '../lib/types';
import { PRESET, type Resolution } from '../lib/config';
import { BASIS_LABEL, platformInfo } from '../lib/platforms';
import { findCover } from '../lib/coverArt';
import { benchmarkCount } from '../lib/benchmarks';

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
  resolution: Resolution;
  label: string;
}

export function GameCard({ game, targetFps, resolution, label }: Props) {
  const [srcIdx, setSrcIdx] = useState(0);
  const [cover, setCover] = useState<string | null>(null);
  useEffect(() => {
    setSrcIdx(0);
    setCover(null);
  }, [game.id]);
  const sources = imageSources(game.steamAppId);
  const steamFailed = srcIdx >= sources.length;

  // No Steam art (or it failed): look up cover art on Wikipedia.
  useEffect(() => {
    if (!steamFailed) return;
    let live = true;
    findCover(game.wikiTitle ?? game.name, game.name.replace(/\s*\(.*?\)\s*/g, ' ').trim()).then((src) => {
      if (live) setCover(src);
    });
    return () => {
      live = false;
    };
  }, [steamFailed, game.id, game.wikiTitle, game.name]);
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
          {steamFailed && cover ? (
            <div className="game-art-cover">
              <img className="cover-bg" src={cover} alt="" aria-hidden="true" />
              <img className="cover-fg" src={cover} alt={`${game.name} cover art`} onError={() => setCover(null)} />
            </div>
          ) : steamFailed ? (
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
          {benchmarkCount(game) > 0 && (
            <p className="game-basis">
              📊 Uses {benchmarkCount(game)} benchmark result{benchmarkCount(game) === 1 ? '' : 's'}
            </p>
          )}
        </div>
      </section>

      <section className="target-banner" aria-label={`Target: ${targetFps} FPS at ${resolution}, ${PRESET} settings`}>
        <span className="tb-label">TARGET</span>
        <span className="tb-fps">
          <span className="tb-value mono">{targetFps}</span>
          <span className="tb-unit">FPS</span>
        </span>
        <span className="tb-at" aria-hidden="true">
          @
        </span>
        <span className="tb-res">
          <span className="tb-res-main mono">{resolution}</span>
          <span className="tb-res-sub">{PRESET} settings</span>
        </span>
      </section>
    </>
  );
}
