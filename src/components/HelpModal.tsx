import { Modal } from './Modal';
import { MAX_GUESSES, PRESET, RESOLUTION } from '../lib/config';

export function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} title="How to play" onClose={onClose}>
      <div className="help">
        <p>
          Each day you get one Steam game and a <strong>target FPS</strong>. Spec the <strong>cheapest rig</strong> that hits it at{' '}
          {RESOLUTION} {PRESET}: the weakest CPU, GPU and RAM that get there. You have {MAX_GUESSES} tries.
        </p>
        <p>
          <strong>Overkill counts as wrong.</strong> A RTX 5090 will hit any target, but it isn't the answer.
        </p>
        <h3>Tiles</h3>
        <ul className="help-tiles">
          <li>
            <span className="tile tile-green mini">✓</span> Exact part.
          </li>
          <li>
            <span className="tile tile-yellow mini">⬆</span> One tier away. ⬆ go stronger, ⬇ go weaker.
          </li>
          <li>
            <span className="tile tile-gray mini">⬇</span> Two or more tiers away. ⬆ too weak, ⬇ overkill.
          </li>
        </ul>
        <h3>Hints</h3>
        <ul>
          <li>Each guess shows the build's estimated FPS. A VRAM tag means the GPU is short on video memory (big penalty).</li>
          <li>Parts are listed strongest first.</li>
          <li>The PC diagram shows your latest guess for each part, and locks a part in green once you find it.</li>
          <li>FPS = the lower of the CPU and GPU limits, cut if RAM is below what the game recommends.</li>
        </ul>
        <h3>Modes</h3>
        <ul>
          <li>
            <strong>Daily:</strong> one rig per day, the same for everyone. Resets at local midnight.
          </li>
          <li>
            <strong>Endless:</strong> keep building rigs back to back. Filter by platform: PC, PS2/Xbox, PS3/360, PS4/One,
            PS5/Series, Switch or Wii.
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
