import type { CSSProperties } from 'react';
import { DailyFocusItem, Streak, SkillTrack, Countdown } from '../types';
import TodaysFocus from './TodaysFocus';
import CountdownPanel from './CountdownPanel';
import SkillsPanel from './SkillsPanel';
import { formatDayHeader } from '../lib/formatters';
import { usePreppedTasks } from '../hooks/useDB';

interface Props {
  focus: DailyFocusItem[];
  streaks: Streak[];
  tracks: SkillTrack[];
  countdowns: Countdown[];
  refreshKey: number;
  onCompleteTask: (taskId: string) => void;
  onOpenSettings: () => void;
}

function AlchemyCircle({ style }: { style?: CSSProperties }) {
  const r = 140;
  const cx = 200;
  const cy = 200;

  // Hexagon vertices at r=140
  const hex: [number, number][] = Array.from({ length: 6 }, (_, i) => {
    const a = (i * 60 - 90) * (Math.PI / 180);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
  const hexStr = hex.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  // Triangle 1: vertices 0, 2, 4  (pointing up)
  const tri1 = [0, 2, 4].map(i => `${hex[i][0].toFixed(1)},${hex[i][1].toFixed(1)}`).join(' ');
  // Triangle 2: vertices 1, 3, 5  (pointing down)
  const tri2 = [1, 3, 5].map(i => `${hex[i][0].toFixed(1)},${hex[i][1].toFixed(1)}`).join(' ');

  // Inner hexagon at r=80
  const innerHex: [number, number][] = Array.from({ length: 6 }, (_, i) => {
    const a = (i * 60 - 90) * (Math.PI / 180);
    return [cx + 80 * Math.cos(a), cy + 80 * Math.sin(a)];
  });
  const innerHexStr = innerHex.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  return (
    <svg
      viewBox="0 0 400 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
    >
      {/* Outer double ring */}
      <circle cx={cx} cy={cy} r="190" stroke="currentColor" strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r="176" stroke="currentColor" strokeWidth="0.4" />
      <circle cx={cx} cy={cy} r="162" stroke="currentColor" strokeWidth="0.9" />

      {/* Tick marks — 24 at 15° intervals */}
      {Array.from({ length: 24 }, (_, i) => {
        const angle = (i * 15 - 90) * (Math.PI / 180);
        const isMajor = i % 6 === 0;
        const r1 = isMajor ? 163 : 168;
        return (
          <line
            key={i}
            x1={(cx + r1 * Math.cos(angle)).toFixed(2)}
            y1={(cy + r1 * Math.sin(angle)).toFixed(2)}
            x2={(cx + 176 * Math.cos(angle)).toFixed(2)}
            y2={(cy + 176 * Math.sin(angle)).toFixed(2)}
            stroke="currentColor"
            strokeWidth={isMajor ? '1.2' : '0.4'}
          />
        );
      })}

      {/* Hexagon */}
      <polygon points={hexStr} stroke="currentColor" strokeWidth="0.7" fill="none" />

      {/* Star of David */}
      <polygon points={tri1} stroke="currentColor" strokeWidth="0.45" fill="none" />
      <polygon points={tri2} stroke="currentColor" strokeWidth="0.45" fill="none" />

      {/* Inner rings */}
      <circle cx={cx} cy={cy} r="80" stroke="currentColor" strokeWidth="0.7" />
      <circle cx={cx} cy={cy} r="50" stroke="currentColor" strokeWidth="0.6" />
      <circle cx={cx} cy={cy} r="20" stroke="currentColor" strokeWidth="0.9" />

      {/* Inner hexagon */}
      <polygon points={innerHexStr} stroke="currentColor" strokeWidth="0.35" fill="none" />

      {/* Spokes from inner hex to center */}
      {innerHex.map(([x, y], i) => (
        <line
          key={i}
          x1={x.toFixed(2)} y1={y.toFixed(2)}
          x2={cx} y2={cy}
          stroke="currentColor" strokeWidth="0.25"
        />
      ))}

      {/* Dots at outer hex vertices */}
      {hex.map(([x, y], i) => (
        <circle key={i} cx={x.toFixed(2)} cy={y.toFixed(2)} r="2.5" fill="currentColor" />
      ))}

      {/* Small diamonds at inner hex vertices */}
      {innerHex.map(([x, y], i) => (
        <circle key={i} cx={x.toFixed(2)} cy={y.toFixed(2)} r="1.5" fill="currentColor" opacity="0.6" />
      ))}
    </svg>
  );
}

export default function CommandCenter({ focus, streaks, tracks, countdowns, refreshKey, onCompleteTask, onOpenSettings }: Props) {
  const streak = streaks.find(s => s.type === 'daily_tasks')?.current_streak ?? 0;
  const preppedTasks = usePreppedTasks(refreshKey);

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Background alchemy circle watermark */}
      <div
        className="absolute pointer-events-none select-none"
        style={{
          top: '50%',
          left: '50%',
          width: '680px',
          height: '680px',
          transform: 'translate(-50%, -50%)',
          color: '#9333ea',
          opacity: 0.038,
          animation: 'alchemyRotate 60s linear infinite',
          transformOrigin: 'center',
        }}
      >
        <AlchemyCircle style={{ width: '100%', height: '100%' }} />
      </div>

      {/* Header */}
      <div
        className="drag-region flex items-center justify-between px-5 py-4 flex-shrink-0 relative"
        style={{ borderBottom: '1px solid rgba(147, 51, 234, 0.06)' }}
      >
        {/* Small counter-rotating circle behind logo text */}
        <div
          className="absolute left-1/2 top-1/2 pointer-events-none select-none"
          style={{
            width: '110px',
            height: '110px',
            transform: 'translate(-50%, -50%)',
            color: '#9333ea',
            opacity: 0.055,
            animation: 'alchemyRotate 28s linear infinite reverse',
            transformOrigin: 'center',
          }}
        >
          <AlchemyCircle style={{ width: '100%', height: '100%' }} />
        </div>

        <div className="flex items-center gap-3">
          {/* Traffic light spacer */}
          <div className="w-16" />
          <span className="text-[15px] font-semibold tracking-tight">
            <span className="logo-initial">P</span>
            <span className="text-text-primary">ath</span>
            <span className="logo-initial">K</span>
            <span className="text-text-primary">eeper</span>
          </span>
        </div>

        <div className="no-drag flex items-center gap-3.5">
          <span className="text-[12px] text-text-muted">{formatDayHeader()}</span>
          {streak > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[15px]">🔥</span>
              <span className="font-mono text-[13px] font-bold text-gold tabular-nums">{streak}</span>
              <span className="text-[10px] text-text-muted uppercase tracking-wide">streak</span>
            </div>
          )}
          <button
            onClick={onOpenSettings}
            className="flex items-center justify-center w-7 h-7 rounded-md border border-white/5 bg-white/5 text-text-muted hover:text-purple-400 hover:border-purple-500/20 hover:bg-purple-500/5 transition-all duration-200 cursor-pointer"
            title="Configure API Keys"
            style={{ fontSize: '13px' }}
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Panels */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3 space-y-3 relative">
        <TodaysFocus focus={focus} onComplete={onCompleteTask} />

        <div className="grid grid-cols-2 gap-3">
          <CountdownPanel countdowns={countdowns} />
          <SkillsPanel tracks={tracks} />
        </div>

        {/* AI Pre-Working */}
        <div className="panel p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-accent spin-slow" style={{ fontSize: '14px', lineHeight: 1 }}>◎</span>
            <span className="panel-label">AI Pre-Working</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {preppedTasks.length === 0 ? (
              <span className="text-[11px] text-text-muted italic">No pre-work ready</span>
            ) : (
              preppedTasks.map(task => (
                <span
                  key={task.id}
                  className="text-[11px] text-text-muted px-2.5 py-1 rounded-full cursor-default transition-all duration-200 hover:text-accent-light"
                  style={{
                    background: 'linear-gradient(135deg, rgba(147,51,234,0.07), rgba(147,51,234,0.02))',
                    border: '1px solid rgba(147,51,234,0.18)',
                  }}
                  title={task.title}
                >
                  {task.title.length > 24 ? task.title.slice(0, 24) + '…' : task.title}
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
