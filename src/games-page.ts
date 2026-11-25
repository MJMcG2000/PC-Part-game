/**
 * Fills games.html from the same game data the puzzles use, so the library
 * always matches what can come up. Shows no FPS loads or answers.
 */
import { catalog } from './lib/data';
import { PLATFORMS, matchesPlatform, platformInfo, type PlatformFilter } from './lib/platforms';
import { findCover } from './lib/coverArt';
import type { Game } from './lib/types';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const games = [...catalog.games].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
const fold = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
const haystack = new Map(
  games.map((g) => [
    g.id,
    fold(`${g.name} ${platformInfo(g.platform).label} ${platformInfo(g.platform).short} ${g.genre} ${g.releaseYear}`),
  ]),
);

// ---- Box art ----------------------------------------------------------------
// Same sources as the game card: a fixed cover if set, Steam's portrait library
// art then its header, then a Wikipedia cover lookup (cached in localStorage).
// Images load lazily as rows scroll into view.
const byId = new Map(games.map((g) => [g.id, g]));
const fixedSources = (g: Game) => [
  ...(g.coverUrl ? [g.coverUrl] : []),
  ...(g.steamAppId
    ? [
        `https://cdn.akamai.steamstatic.com/steam/apps/${g.steamAppId}/library_600x900.jpg`,
        `https://cdn.akamai.steamstatic.com/steam/apps/${g.steamAppId}/header.jpg`,
      ]
    : []),
];
/** Per game: index into fixedSources, then 'wiki', 'none' or a resolved Wikipedia URL. */
const artState = new Map<string, number | 'wiki' | 'none' | { url: string }>();

function artSrc(g: Game): string | null {
  const st = artState.get(g.id) ?? 0;
  if (typeof st === 'number') return fixedSources(g)[st] ?? null;
  return typeof st === 'object' ? st.url : null;
}

function advance(img: HTMLImageElement, g: Game) {
  const st = artState.get(g.id) ?? 0;
  const next: number | 'wiki' | 'none' =
    typeof st === 'number' && st + 1 < fixedSources(g).length ? st + 1 : st === 'wiki' || typeof st === 'object' ? 'none' : 'wiki';
  artState.set(g.id, next);
  showArt(img, g);
}

function showArt(img: HTMLImageElement, g: Game) {
  let st = artState.get(g.id) ?? 0;
  if (typeof st === 'number' && st >= fixedSources(g).length) {
    st = 'wiki';
    artState.set(g.id, st);
  }
  if (st === 'none') {
    img.removeAttribute('src');
    img.closest('.lib-art')?.classList.add('is-empty');
    return;
  }
  if (st === 'wiki') {
    findCover(g.wikiTitle ?? g.name, g.name.replace(/\s*\(.*?\)\s*/g, ' ').trim()).then((url) => {
      artState.set(g.id, url ? { url } : 'none');
      if (img.isConnected && img.dataset.id === g.id) showArt(img, g);
    });
    return;
  }
  const src = artSrc(g);
  if (src && img.getAttribute('src') !== src) img.src = src;
}

const observer = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const img = e.target as HTMLImageElement;
      observer.unobserve(img);
      const g = byId.get(img.dataset.id!);
      if (g) showArt(img, g);
    }
  },
  { rootMargin: '300px 0px' },
);

let filter: PlatformFilter = 'all';
let query = '';

const rowsEl = document.getElementById('lib-rows')!;
const countEl = document.getElementById('lib-count')!;
const filtersEl = document.getElementById('lib-filters')!;
const searchEl = document.getElementById('lib-search') as HTMLInputElement;

document.getElementById('lib-total')!.textContent = `${games.length} games across ${PLATFORMS.length} platforms.`;

function render() {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  const shown = games.filter((g) => matchesPlatform(g, filter) && terms.every((t) => haystack.get(g.id)!.includes(t)));
  countEl.textContent = `Showing ${shown.length} of ${games.length} games`;
  rowsEl.innerHTML = shown.length
    ? shown
        .map((g) => {
          const p = platformInfo(g.platform);
          const also = (g.alsoOn ?? []).map((a) => platformInfo(a).short).join(', ');
          return `<tr>
            <td class="lib-art-cell"><span class="lib-art platform-${g.platform}"><img data-id="${esc(g.id)}" alt="" referrerpolicy="no-referrer" /></span></td>
            <td>${esc(g.name)}</td>
            <td><span class="platform-chip platform-${g.platform}">${esc(p.short)}</span>${also ? ` <small class="lib-also">also ${esc(also)}</small>` : ''}</td>
            <td class="mono">${g.releaseYear}</td>
            <td>${esc(g.genre)}</td>
          </tr>`;
        })
        .join('')
    : '<tr><td colspan="5">No games match.</td></tr>';
  observer.disconnect();
  rowsEl.querySelectorAll<HTMLImageElement>('img[data-id]').forEach((img) => observer.observe(img));
}

// Image errors don't bubble, so listen in the capture phase.
rowsEl.addEventListener(
  'error',
  (e) => {
    const img = e.target as HTMLImageElement;
    const g = img.dataset?.id ? byId.get(img.dataset.id) : undefined;
    if (img.tagName === 'IMG' && g) advance(img, g);
  },
  true,
);

const chips: { id: PlatformFilter; label: string }[] = [{ id: 'all', label: 'All' }, ...PLATFORMS.map((p) => ({ id: p.id, label: p.short }))];
filtersEl.innerHTML = chips
  .map((c) => {
    const n = games.filter((g) => matchesPlatform(g, c.id)).length;
    return `<button type="button" role="radio" class="filter-chip${c.id === filter ? ' is-on' : ''}" aria-checked="${c.id === filter}" data-id="${c.id}">${esc(c.label)} <small>${n}</small></button>`;
  })
  .join('');
filtersEl.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-id]');
  if (!btn) return;
  filter = btn.dataset.id as PlatformFilter;
  filtersEl.querySelectorAll('button').forEach((b) => {
    const on = b === btn;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-checked', String(on));
  });
  render();
});
searchEl.addEventListener('input', () => {
  query = searchEl.value;
  render();
});

render();
