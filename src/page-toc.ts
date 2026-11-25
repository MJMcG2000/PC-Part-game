/**
 * "On this page" sidebar for the content pages (desktop only, via CSS): links
 * to each h2 and highlights the section being read.
 */
const main = document.querySelector<HTMLElement>('main.page');
const heads = main ? [...main.querySelectorAll<HTMLHeadingElement>(':scope > h2')] : [];
if (main && heads.length >= 3) {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  heads.forEach((h) => (h.id ||= slug(h.textContent ?? '')));
  const aside = document.createElement('nav');
  aside.className = 'page-toc';
  aside.setAttribute('aria-label', 'On this page');
  // The nav fills its grid area (rows before any full-width block); the inner box
  // is sticky inside it, so it scrolls away before the tier tables instead of covering them.
  aside.innerHTML =
    '<div class="page-toc-inner"><p class="page-toc-title">On this page</p><ul>' +
    heads.map((h) => `<li><a href="#${h.id}">${h.textContent?.replace(/[<>&]/g, '') ?? ''}</a></li>`).join('') +
    '</ul></div>';
  main.classList.add('has-toc');
  main.prepend(aside);
  // The sidebar's grid rows end where a full-width block (the tier tables) starts, so they never overlap.
  const kids = [...main.children];
  const wide = kids.findIndex((el) => el.id === 'tier-tables');
  aside.style.gridRow = wide > 0 ? `1 / ${wide + 1}` : '1 / span 400';
  const links = new Map(heads.map((h) => [h, aside.querySelector<HTMLAnchorElement>(`a[href="#${h.id}"]`)!]));
  const onScroll = () => {
    let current = heads[0];
    for (const h of heads) if (h.getBoundingClientRect().top < 140) current = h;
    links.forEach((a, h) => a.classList.toggle('is-current', h === current));
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}
