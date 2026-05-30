export interface DailySnapshot {
  date: string; // UTC YYYY-MM-DD
  mentions: number;
  rank: number | null;
}

export function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function isSnapshotDue(lastDate: string | undefined, today: string): boolean {
  return lastDate !== today;
}

export function appendDay(
  history: DailySnapshot[],
  record: DailySnapshot,
  max: number = 7,
): DailySnapshot[] {
  const withoutSameDate = history.filter((d) => d.date !== record.date);
  const next = [...withoutSameDate, record].sort((a, b) => a.date.localeCompare(b.date));
  return next.slice(-max);
}
