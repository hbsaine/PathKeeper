import { useState } from 'react';
import { DailyFocusItem } from '../types';

const domainBorderColor: Record<string, string> = {
  rsm:      '#d4a017',
  akpsi:    '#06b6d4',
  school:   '#06b6d4',
  finance:  '#16a34a',
  network:  '#06b6d4',
  skills:   '#9333ea',
  personal: '#6b6580',
};

const domainTextClass: Record<string, string> = {
  rsm:      'text-gold',
  akpsi:    'text-cyan-400',
  school:   'text-cyan-400',
  finance:  'text-success',
  network:  'text-cyan-400',
  skills:   'text-accent',
  personal: 'text-text-secondary',
};

interface Props {
  focus: DailyFocusItem[];
  onComplete: (taskId: string) => void;
}

export default function TodaysFocus({ focus, onComplete }: Props) {
  const [pulsing, setPulsing] = useState<Set<string>>(new Set());

  const doneCount  = focus.filter(f => f.completed === 1 || f.status === 'done').length;
  const totalCount = focus.length;
  const allDone    = totalCount > 0 && doneCount === totalCount;

  const handleComplete = (taskId: string) => {
    setPulsing(prev => new Set([...prev, taskId]));
    onComplete(taskId);
    setTimeout(() => {
      setPulsing(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }, 600);
  };

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <span className="text-text-muted" style={{ fontSize: '9px' }}>◆</span>
          <span className="panel-label">Today's Focus</span>
        </div>
        <span
          className="font-mono text-[12px] font-semibold tabular-nums transition-colors duration-500"
          style={{ color: allDone ? '#d4a017' : '#3d3650' }}
        >
          {doneCount}/{totalCount}
        </span>
      </div>

      <div className="space-y-2.5">
        {totalCount === 0 && (
          <p className="text-text-muted text-[12px]">
            No tasks set. Ask PathKeeper to set your focus.
          </p>
        )}

        {focus.map((item) => {
          const done      = item.completed === 1 || item.status === 'done';
          const isPulsing = pulsing.has(item.task_id);
          const border    = domainBorderColor[item.domain] ?? '#3d3650';

          return (
            <button
              key={item.id}
              onClick={() => !done && handleComplete(item.task_id)}
              disabled={done}
              className={`w-full flex items-start gap-2.5 text-left group transition-opacity duration-200 ${
                done ? 'opacity-50 cursor-default' : 'hover:opacity-90 cursor-pointer'
              }`}
            >
              {/* Domain left border */}
              <div
                className="flex-shrink-0 rounded-full"
                style={{
                  width: '2px',
                  minHeight: '18px',
                  alignSelf: 'stretch',
                  background: border,
                  opacity: done ? 0.5 : 1,
                }}
              />

              {/* Checkbox */}
              <div
                className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all duration-300 ${
                  isPulsing ? 'check-pulse' : ''
                } ${
                  done
                    ? 'border-gold/50 bg-gold/10'
                    : 'border-text-muted group-hover:border-accent/50'
                }`}
              >
                {done && (
                  <svg className="w-2.5 h-2.5 text-gold" viewBox="0 0 10 10" fill="none">
                    <path
                      d="M2 5l2.5 2.5L8 3"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>

              {/* Text content */}
              <div className="flex-1 min-w-0">
                <p
                  className="text-[13px] leading-snug font-medium transition-all duration-300"
                  style={
                    done
                      ? { textDecoration: 'line-through', color: '#d4a017', opacity: 0.55, textDecorationColor: 'rgba(212,160,23,0.4)' }
                      : { color: '#e8e4f0' }
                  }
                >
                  {item.title}
                </p>
                {item.domain && (
                  <span className={`text-[10px] font-medium uppercase tracking-wide ${domainTextClass[item.domain] ?? 'text-text-muted'}`}>
                    {item.domain}
                  </span>
                )}
              </div>

              {/* Pre-work badge */}
              {item.ai_prep_content && !done && (
                <span
                  className="flex-shrink-0 text-[10px] font-medium mt-0.5 transition-colors duration-200 group-hover:text-accent-light"
                  style={{ color: '#c084fc' }}
                >
                  draft ready →
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
