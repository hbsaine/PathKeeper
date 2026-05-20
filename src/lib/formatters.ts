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
