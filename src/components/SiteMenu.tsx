import { useEffect, useId, useRef, useState } from 'react';
import { SITE_PAGES, TIP_LABEL } from '../lib/site';
import type { Mode } from '../lib/storage';

interface Props {
  mode: Mode;
  onMode: (m: Mode) => void;
  onHelp: () => void;
  onStats: () => void;
  onTip: () => void;
}

/** ☰ menu in the top right: every page and section the site offers, plus the tip button. */
export function SiteMenu({ mode, onMode, onHelp, onStats, onTip }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    // Move focus into the menu for keyboard users.
    wrap.current?.querySelector<HTMLElement>('.menu-item')?.focus();
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const act = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div className="site-menu" ref={wrap}>
      <button
        ref={button}
        className={`icon-btn menu-btn${open ? ' is-on' : ''}`}
        aria-label="Menu"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="burger" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>
      {open && (
        <nav className="menu-panel" id={`${id}-panel`} aria-label="Site menu">
          <p className="menu-heading">Play</p>
          <button className={`menu-item${mode === 'daily' ? ' is-current' : ''}`} onClick={act(() => onMode('daily'))}>
            <span>Daily puzzle</span>
            <small>One rig a day, same for everyone</small>
          </button>
          <button className={`menu-item${mode === 'endless' ? ' is-current' : ''}`} onClick={act(() => onMode('endless'))}>
            <span>Endless mode</span>
            <small>Keep building rigs, filter by platform</small>
          </button>
          <button className="menu-item" onClick={act(onHelp)}>
            <span>How to play</span>
          </button>
          <button className="menu-item" onClick={act(onStats)}>
            <span>Statistics</span>
          </button>

          <p className="menu-heading">Pages</p>
          {SITE_PAGES.map((p) => (
            <a key={p.href} className="menu-item" href={p.href}>
              <span>{p.label}</span>
              <small>{p.description}</small>
            </a>
          ))}

          <div className="menu-divider" role="separator" />
          <button className="menu-item tip-item" onClick={act(onTip)}>
            <span>🍺 {TIP_LABEL}</span>
          </button>
        </nav>
      )}
    </div>
  );
}
