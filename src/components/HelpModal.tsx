import { Modal } from './Modal';
import { HARD_MAX_GUESSES, MAX_GUESSES, PRESET, WIN_TOLERANCE } from '../lib/config';

export function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} title="How to play" onClose={onClose}>
      <div className="help">
        <p>
          Each day you get one game (PC or console) and a <strong>target FPS</strong>. Spec the <strong>cheapest rig</strong> that hits it at{' '}
          the shown resolution (1080p, 1440p or 4K) and {PRESET} settings: the weakest CPU, GPU and RAM that get there. You
          have {MAX_GUESSES} tries ({HARD_MAX_GUESSES} in Hard mode).
        </p>
        <p>
          Higher resolutions are much harder on the GPU and need more video memory (VRAM). The CPU's job doesn't change.
        </p>
        <p>
          <strong>Overkill counts as wrong.</strong> A RTX 5090 will hit any target, but it isn't the answer.
        </p>
        <p>
          <strong>Close enough wins too:</strong> if your build's estimated FPS is within {Math.round(WIN_TOLERANCE * 100)}% of the
          target (above or below), you win.
        </p>
        <p>
          <strong>Hard mode:</strong> only the true minimum build wins, and you get {HARD_MAX_GUESSES} guesses instead of {MAX_GUESSES}. Turn it on before your first guess; shared hard-mode
          scores get a *.
        </p>
        <h3>Tiles</h3>
        <ul className="help-tiles">
          <li>
            <span className="tile tile-green mini">✓</span> Exact part.
          </li>
          <li>
            <span className="tile tile-green mini">≈</span> Close enough: this part alone lands within {Math.round(WIN_TOLERANCE * 100)}% of the target FPS. Counts as found (not in Hard mode).
          </li>
          <li>
            <span className="tile tile-yellow mini">⬆</span> One tier away. ⬆ go stronger, ⬇ go weaker.
          </li>
          <li>
            <span className="tile tile-gray mini">⬇</span> Two or more tiers away. ⬆ too weak, ⬇ overkill.
          </li>
        </ul>
        <p className="muted">
          A tier is a part's rank by gaming performance within its brand, not its release date: a newer budget card can be a
          lower tier than an older flagship. A <strong>VRAM</strong> tag on the GPU means the card has too little video memory
          for this game. See the full <a href="./tiers.html">tier lists</a>.
        </p>
        <h3>Hints</h3>
        <ul>
          <li>Under the PC you'll see your latest build's estimated FPS, plus what the CPU and the GPU could each do on their own. The slower one (highlighted) is holding you back. A VRAM tag means the GPU is short on video memory (big penalty).</li>
          <li>Pick a brand first: AMD or Intel for the CPU, NVIDIA or AMD for the GPU. Parts go back to the year 2000. Either brand can be right: each brand has its own minimum part, and tiles compare your part with the minimum of the same brand. Lists are sorted by tier, strongest first. Switch Sort parts to Newest to list them by launch date instead, which is not the same as tier order. RAM type (SDR through DDR5) follows the CPU. Parts you've already tried are crossed out.</li>
          <li>The PC diagram shows your latest guess for each part with its tile color, and locks a part in green once you find it.</li>
          <li>FPS = the lower of the CPU and GPU limits, cut if RAM is below what the game recommends. Real benchmark results are used where available; everything else is an estimate (labeled in the results).</li>
        </ul>
        <p className="muted">Stuck? Tap 🏳 Give up to see the answer (counts as a loss).</p>
        <h3>Modes</h3>
        <ul>
          <li>
            <strong>Daily:</strong> one rig per day, the same for everyone. Resets at local midnight.
          </li>
          <li>
            <strong>Endless:</strong> keep building rigs back to back. Filter by platform: PC, PS2/Xbox, PS3/360, PS4/One,
            PS5/Series, Switch, Wii, or handheld Pokémon (GB/GBA, DS, 3DS). Tap ↻ New rig to skip a puzzle (free before your first guess, a loss after).
          </li>
        </ul>
        <p className="muted">
          Console games are estimated as played on a PC: older consoles through emulation (hard on the CPU), PS4/PS5-era games
          through their PC port.
        </p>
        <button className="btn btn-primary" onClick={onClose}>
          Let's build
        </button>
      </div>
    </Modal>
  );
}
