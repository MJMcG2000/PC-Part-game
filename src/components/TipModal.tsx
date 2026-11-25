import { Modal } from './Modal';
import { TIP_LABEL, TIP_URL } from '../lib/site';

/** "Buy me a beer". A placeholder until VITE_TIP_URL is set; no payment links today. */
export function TipModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} title={`🍺 ${TIP_LABEL}`} onClose={onClose}>
      <div className="tip">
        <p>Enjoying Rigdle? Thanks for wanting to chip in for a beer. It keeps the rigs coming.</p>
        {TIP_URL ? (
          <a className="btn btn-primary tip-cta" href={TIP_URL} target="_blank" rel="noopener noreferrer">
            Leave a tip ↗
          </a>
        ) : (
          <p className="tip-soon">
            <strong>Tips aren't set up yet.</strong> Check back soon. In the meantime, sharing your result with a friend is
            the best way to help.
          </p>
        )}
        <button className="btn" onClick={onClose}>
          Back to the game
        </button>
      </div>
    </Modal>
  );
}
