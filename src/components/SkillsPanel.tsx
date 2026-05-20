import { SkillTrack } from '../types';

interface Props {
  tracks: SkillTrack[];
}

export default function SkillsPanel({ tracks }: Props) {
  const primary = tracks.find(t => t.name === 'AI Governance & Risk') ?? tracks[0];

  if (!primary) {
    return (
      <div className="panel p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-text-muted" style={{ fontSize: '9px' }}>◆</span>
          <span className="panel-label">Level Up</span>
        </div>
        <p className="text-text-muted text-[12px]">Loading...</p>
      </div>
    );
  }

  const pct = primary.total_lessons > 0
    ? Math.round((primary.completed_lessons / primary.total_lessons) * 100)
    : 0;

  return (
    <div className="panel p-4">
      {/* Header with decorative lines extending from it */}
      <div className="flex items-center gap-1.5 mb-3">
        <div
          className="h-px flex-1"
          style={{ background: 'linear-gradient(to right, transparent, rgba(212,160,23,0.25))' }}
        />
        <span className="text-text-muted" style={{ fontSize: '9px' }}>◆</span>
        <span className="panel-label">Level Up</span>
        <span className="text-text-muted" style={{ fontSize: '9px' }}>◆</span>
        <div
          className="h-px flex-1"
          style={{ background: 'linear-gradient(to left, transparent, rgba(212,160,23,0.25))' }}
        />
      </div>

      <div className="space-y-2.5">
        <p className="text-[13px] font-medium text-text-primary leading-snug">
          SOX IT Controls 101
        </p>
        <p className="text-[11px] text-text-secondary">
          {primary.name}
        </p>
        <p className="text-[10px] text-text-muted font-mono tabular-nums">
          {primary.completed_lessons}/{primary.total_lessons} lessons
        </p>

        {/* Gold gradient progress bar */}
        <div className="relative h-1 rounded-full overflow-hidden" style={{ background: 'rgba(147,51,234,0.1)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg, #8a5f0a, #d4a017, #f5d76e)',
              boxShadow: pct > 0 ? '0 0 8px rgba(212,160,23,0.45)' : 'none',
            }}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[10px] text-text-muted font-mono tabular-nums">{pct}%</span>
          {primary.salary_range && (
            <span
              className="text-[10px] text-gold px-2 py-0.5 rounded-full"
              style={{
                border: '1px solid rgba(212,160,23,0.28)',
                background: 'rgba(212,160,23,0.06)',
              }}
            >
              {primary.salary_range}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
