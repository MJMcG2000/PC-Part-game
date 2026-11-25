/**
 * Fills games.html from the same game data the puzzles use, so the library
 * always matches what can come up. Shows no FPS loads or answers.
 */
import { catalog } from './lib/data';
import { PLATFORMS, matchesPlatform, platformInfo, type PlatformFilter } from './lib/platforms';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const games = [...catalog.games].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
const fold = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
const haystack = new Map(
  games.map((g) => [
    g.id,
    fold(`${g.name} ${platformInfo(g.platform).label} ${platformInfo(g.platform).short} ${g.genre} ${g.releaseYear}`),
  ]),
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
            <td>${esc(g.name)}</td>
            <td><span class="platform-chip platform-${g.platform}">${esc(p.short)}</span>${also ? ` <small class="lib-also">also ${esc(also)}</small>` : ''}</td>
            <td class="mono">${g.releaseYear}</td>
            <td>${esc(g.genre)}</td>
          </tr>`;
        })
        .join('')
    : '<tr><td colspan="4">No games match.</td></tr>';
}

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
