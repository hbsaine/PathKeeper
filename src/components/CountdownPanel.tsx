import { Countdown } from '../types';
import { daysUntil } from '../lib/formatters';

function ArcProgress({ days }: { days: number }) {
  const radius = 17;
  const circ   = 2 * Math.PI * radius;
  // Fuller arc = closer to deadline (0 days = full circle, 365 = empty)
  const pct    = Math.max(0, Math.min(1, 1 - Math.max(0, days) / 365));
  const dash   = pct * circ;
  const urgent = days >= 0 && days < 30;
  const color  = urgent ? '#d4a017' : '#9333ea';

  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="flex-shrink-0" aria-hidden>
      {/* Track */}
      <circle
        cx="22" cy="22" r={radius}
        stroke="rgba(147,51,234,0.1)"
        strokeWidth="2"
        fill="none"
      />
      {/* Progress arc */}
      {pct > 0 && (
        <circle
          cx="22" cy="22" r={radius}
          stroke={color}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash.toFixed(2)} ${circ.toFixed(2)}`}
          transform="rotate(-90 22 22)"
          style={{ transition: 'stroke-dasharray 0.5s ease', opacity: urgent ? 1 : 0.7 }}
        />
      )}
    </svg>
  );
}

interface Props {
  countdowns: Countdown[];
}

export default function CountdownPanel({ countdowns }: Props) {
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-text-muted" style={{ fontSize: '9px' }}>◆</span>
        <span className="panel-label">Countdowns</span>
      </div>

      {countdowns.length === 0 ? (
        <p className="text-[12px] text-text-muted">No countdowns set.</p>
      ) : (
        <div className="space-y-3">
          {countdowns.map((cd, i) => {
            const days   = daysUntil(cd.event_date);
            const urgent = days >= 0 && days < 30;

            return (
              <div
                key={cd.id}
                className={i > 0 ? 'border-t pt-3' : ''}
                style={i > 0 ? { borderColor: 'rgba(147,51,234,0.07)' } : undefined}
              >
                <div className="flex items-center gap-3">
                  <ArcProgress days={days} />
                  <div className="min-w-0">
                    <span
                      className="font-mono font-bold tabular-nums block leading-none"
                      style={{
                        fontSize: urgent ? '32px' : '24px',
                        color: urgent ? '#d4a017' : '#6b6580',
                      }}
                    >
                      {Math.abs(days)}
                    </span>
                    <p className="text-[11px] text-text-secondary truncate mt-0.5">{cd.title}</p>
                    <p className="text-[10px] text-text-muted">
                      {days === 0
                        ? 'today'
                        : days < 0
                        ? `${Math.abs(days)}d ago`
                        : 'days away'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
