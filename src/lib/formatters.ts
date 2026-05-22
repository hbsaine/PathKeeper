export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

export function formatRelativeDate(dateStr: string): string {
  const days = daysUntil(dateStr);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  if (days < 0) return `${Math.abs(days)}d ago`;
  if (days < 7) return `in ${days}d`;
  if (days < 30) return `in ${Math.ceil(days / 7)}w`;
  return `in ${Math.ceil(days / 30)}mo`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function formatDayHeader(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function daysSinceContact(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  return Math.abs(daysUntil(dateStr));
}

// Converts "HH:MM" (24h) → "H:MM AM/PM"
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// Returns a human-readable countdown label for the bottom line of a countdown card.
// - event_time set + under 24h away  → "in Xh Ym" / "in Xm"
// - same calendar day but no time   → "today"
// - past                             → "Xd ago"
// - future                          → "X days away"
export function formatCountdownDisplay(event_date: string, event_time?: string): string {
  if (event_time) {
    const target = new Date(`${event_date}T${event_time}:00`);
    const diffMs = target.getTime() - Date.now();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours > 0 && diffHours < 24) {
      const h = Math.floor(diffHours);
      const m = Math.floor((diffHours - h) * 60);
      if (h === 0) return `in ${m}m`;
      return m > 0 ? `in ${h}h ${m}m` : `in ${h}h`;
    }
  }
  const days = daysUntil(event_date);
  if (days === 0) return 'today';
  if (days < 0) return `${Math.abs(days)}d ago`;
  return `${days} days away`;
}
