import { arrowFor, type Tile } from '../lib/feedback';
import type { PartKey } from '../lib/types';

export interface SlotState {
  /** Name of the part shown in the slot (null = nothing guessed yet). */
  name: string | null;
  tile: Tile | null;
}

const LABEL: Record<PartKey, string> = { cpu: 'CPU', gpu: 'GPU', ram: 'RAM' };

function Slot({ part, state }: { part: PartKey; state: SlotState }) {
  const color = state.tile?.color ?? 'empty';
  const status = !state.tile
    ? 'not guessed yet'
    : state.tile.color === 'green'
      ? 'correct'
      : state.tile.vramShort && state.tile.color === 'gray' && state.tile.direction === 'up'
        ? 'not enough video memory for this game, pick a card with more VRAM'
        : `${state.tile.color === 'yellow' ? 'one tier away' : 'two or more tiers away'}, ${
            state.tile.direction === 'up' ? 'go stronger' : 'go weaker'
          }${state.tile.vramShort ? ', and short on video memory' : ''}`;
  return (
    <div className={`pc-slot pc-${part} slot-${color}`} role="img" aria-label={`${LABEL[part]}: ${state.name ?? ''} ${status}`}>
      <span className="pc-slot-label">{LABEL[part]}</span>
      <span className="pc-slot-name">{state.name ?? '?'}</span>
      {state.tile?.vramShort && (
        <span className="pc-slot-vram" title="Not enough video memory (VRAM) for this game at this resolution">
          VRAM
        </span>
      )}
      {state.tile && (
        <span className="pc-slot-arrow" aria-hidden="true">
          {state.tile.color === 'green' ? '✓' : arrowFor(state.tile.direction)}
        </span>
      )}
    </div>
  );
}

/**
 * Side view of an ATX tower through the glass panel: rear I/O and exhaust
 * on the left, front intake fans on the right, PSU shroud at the bottom.
 * CPU socket upper-middle, RAM slots right of the CPU, GPU in the top
 * PCIe slot running horizontally below the CPU.
 */
export function PcDiagram({ slots }: { slots: Record<PartKey, SlotState> }) {
  return (
    <section className="pc" aria-label="Your build so far">
      <div className="pc-case">
        <div className="pc-board" aria-hidden="true">
          <div className="pc-io" />
          <div className="pc-pcie pc-pcie-2" />
          <div className="pc-pcie pc-pcie-3" />
        </div>
        <div className="pc-fan pc-fan-front pc-fan-f1" aria-hidden="true" />
        <div className="pc-fan pc-fan-front pc-fan-f2" aria-hidden="true" />
        <div className="pc-fan pc-fan-front pc-fan-f3" aria-hidden="true" />
        <Slot part="cpu" state={slots.cpu} />
        <Slot part="ram" state={slots.ram} />
        <Slot part="gpu" state={slots.gpu} />
        <div className="pc-psu" aria-hidden="true" />
      </div>
    </section>
  );
}
