import { useEffect, useId, useMemo, useRef, useState } from 'react';

export interface PickerOption {
  index: number; // position in the weakest -> strongest list
  label: string;
  detail?: string;
  /** Launch date as a sortable number (e.g. 202411): newest first, then A-Z. */
  released?: number;
  /** Already used in a previous guess (still selectable). */
  crossed?: boolean;
}

export interface BrandChoice {
  /** Value matched against each option's `brand`. */
  id: string;
  /** Button text, e.g. "Ryzen". */
  label: string;
}

interface Props {
  label: string;
  icon: string;
  /** Optional two-way brand switch shown above the field. */
  brands?: BrandChoice[];
  brand?: string;
  onBrandChange?: (brand: string) => void;
  /** Small note under the field (e.g. the RAM type). */
  note?: string;
  options: PickerOption[];
  value: number | null;
  onChange: (index: number | null) => void;
  disabled?: boolean;
  /** 'tier': strongest first (the order tiles count in). Default: newest first. */
  sort?: 'newest' | 'tier';
  /** Render at most this many matches (for very long lists); the rest appear as the player types. */
  maxShown?: number;
  /** Placeholder text for the search box. */
  placeholder?: string;
}

/** Searchable select following the WAI-ARIA combobox pattern. Lists newest first, or strongest first with sort="tier" (largest first when there's no launch date). */
export function PartPicker({ label, icon, brands, brand, onBrandChange, note, options, value, onChange, disabled, sort = 'newest', maxShown, placeholder }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.index === value) ?? null;
  const ordered = useMemo(
    () =>
      [...options].sort((a, b) =>
        sort === 'newest' && a.released !== undefined && b.released !== undefined
          ? b.released - a.released || a.label.localeCompare(b.label, undefined, { numeric: true })
          : b.index - a.index,
      ),
    [options, sort],
  );
  const filtered = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return ordered;
    return ordered.filter((o) => {
      const hay = `${o.label} ${o.detail ?? ''}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [ordered, query]);
  const shown = maxShown ? filtered.slice(0, maxShown) : filtered;
  const hidden = filtered.length - shown.length;

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const openList = () => {
    if (disabled) return;
    setOpen(true);
    setQuery('');
    const i = shown.findIndex((o) => o.index === value);
    setActive(Math.max(0, i));
  };

  const choose = (o: PickerOption) => {
    onChange(o.index);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter')) {
      e.preventDefault();
      openList();
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(shown.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Home') {
      setActive(0);
    } else if (e.key === 'End') {
      setActive(shown.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (shown[active]) choose(shown[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setQuery('');
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  const listId = `${id}-list`;
  return (
    <div className={`picker${disabled ? ' is-disabled' : ''}`} ref={wrapRef}>
      <div className="picker-head">
        <label htmlFor={`${id}-input`} className="picker-label">
          <span aria-hidden="true">{icon}</span> {label}
        </label>
        {brands && (
          <div className="brand-switch" role="radiogroup" aria-label={`${label} brand`}>
            {brands.map((b) => (
              <button
                key={b.id}
                type="button"
                role="radio"
                aria-checked={brand === b.id}
                className={`brand-opt${brand === b.id ? ' is-on' : ''}`}
                onClick={() => onBrandChange?.(b.id)}
              >
                {b.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className={`picker-field${open ? ' is-open' : ''}`}>
        <input
          ref={inputRef}
          id={`${id}-input`}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && shown[active] ? `${id}-opt-${shown[active].index}` : undefined}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          placeholder={selected ? selected.label : placeholder ?? `Search ${label}…`}
          value={open ? query : selected?.label ?? ''}
          onFocus={openList}
          onClick={() => !open && openList()}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        <span className="picker-caret" aria-hidden="true">
          ▾
        </span>
      </div>
      {open && (
        <ul className="picker-list" id={listId} role="listbox" ref={listRef} aria-label={`${label} options, ${sort === 'tier' ? 'strongest' : 'newest'} first`}>
          {shown.length === 0 && <li className="picker-empty">No matches</li>}
          {shown.map((o, i) => (
            <li
              key={o.index}
              id={`${id}-opt-${o.index}`}
              data-i={i}
              role="option"
              aria-selected={o.index === value}
              className={`picker-opt${i === active ? ' is-active' : ''}${o.crossed ? ' is-crossed' : ''}`}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => choose(o)}
              onMouseMove={() => setActive(i)}
            >
              <span className="opt-label">{o.label}</span>
              {o.detail && <span className="opt-detail">{o.detail}</span>}
              {o.crossed && <span className="sr-only"> (already guessed)</span>}
            </li>
          ))}
          {hidden > 0 && <li className="picker-empty">{hidden.toLocaleString()} more. Keep typing to narrow it down.</li>}
        </ul>
      )}
      {note && <p className="picker-note">{note}</p>}
    </div>
  );
}
