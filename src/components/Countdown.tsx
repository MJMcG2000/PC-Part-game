import { formatCountdown, msUntilNextMidnight } from '../lib/date';

export function Countdown({ now }: { now: Date }) {
  return (
    <div className="countdown" aria-live="off">
      <span className="countdown-label">Next rig in</span>
      <span className="countdown-time mono">{formatCountdown(msUntilNextMidnight(now))}</span>
    </div>
  );
}
