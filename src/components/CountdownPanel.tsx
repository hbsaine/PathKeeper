import { useEffect, useState } from 'react';
import { Countdown } from '../types';
import { daysUntil, formatCountdownDisplay, formatTime } from '../lib/formatters';

const isElectron = typeof window !== 'undefined' && !!window.pathkeeper;

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

export default function CountdownPanel({ countdowns: propCountdowns }: Props) {
  const [countdowns, setCountdowns] = useState<Countdown[]>(propCountdowns);

  // Sync when App.tsx refreshKey mechanism delivers new data via prop
  useEffect(() => {
    setCountdowns(propCountdowns);
  }, [propCountdowns]);

  // Independent listener: AI tool calls for countdowns emit this event directly
  useEffect(() => {
    if (!isElectron) return;
    const refresh = async () => {
      const data = await window.pathkeeper.db.getCountdowns();
      setCountdowns(data);
    };
    window.pathkeeper.ai.onCountdownsUpdated(refresh);
    return () => window.pathkeeper.ai.removeCountdownsUpdatedListeners();
  }, []);

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
            const days    = daysUntil(cd.event_date);
            const urgent  = days >= 0 && days < 30;
            const label   = formatCountdownDisplay(cd.event_date, cd.event_time);
            const isHours = label.startsWith('in ') && (label.includes('h') || label.includes('m'));

            // For sub-24h events, show the hours remaining as the big number
            let bigNum: string;
            if (isHours && cd.event_time) {
              const target = new Date(`${cd.event_date}T${cd.event_time}:00`);
              const diffH = (target.getTime() - Date.now()) / (1000 * 60 * 60);
              bigNum = String(Math.max(0, Math.floor(diffH)));
            } else {
              bigNum = String(Math.abs(days));
            }

            return (
              <div
                key={cd.id}
                className={`group relative ${i > 0 ? 'border-t pt-3' : ''}`}
                style={i > 0 ? { borderColor: 'rgba(147,51,234,0.07)' } : undefined}
              >
                <div className="flex items-center gap-3">
                  <ArcProgress days={days} />
                  <div className="min-w-0 flex-1">
                    <span
                      className="font-mono font-bold tabular-nums block leading-none"
                      style={{
                        fontSize: urgent ? '32px' : '24px',
                        color: urgent ? '#d4a017' : '#6b6580',
                      }}
                    >
                      {bigNum}
                    </span>
                    <p className="text-[11px] text-text-secondary truncate mt-0.5">{cd.title}</p>
                    {cd.event_time && (
                      <p className="text-[10px] text-text-muted">{formatTime(cd.event_time)}</p>
                    )}
                    <p className="text-[10px] text-text-muted">{label}</p>
                  </div>
                  <button
                    onClick={async () => {
                      if (!isElectron) return;
                      await window.pathkeeper.db.deleteCountdown(cd.id);
                      setCountdowns(prev => prev.filter(c => c.id !== cd.id));
                    }}
                    className="opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity duration-150 text-[11px] text-text-muted hover:text-red-400 px-1 py-0.5 rounded cursor-pointer select-none"
                    title="Remove countdown"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
