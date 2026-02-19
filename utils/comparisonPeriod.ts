import type { DateRange } from '@/types';

export interface ComparisonDateRange {
  current: DateRange;
  previous: DateRange;
  previousLabel: string;
}

/**
 * Calculates the comparison period for a given date range.
 * Returns the same-duration period immediately preceding the current one.
 * Returns null for 'all' preset (no meaningful comparison).
 */
export function calculateComparisonPeriod(
  dateRange: DateRange
): ComparisonDateRange | null {
  if (dateRange.preset === 'all') return null;

  const { start, end } = dateRange;
  if (!start || !end) return null;

  const durationMs = end.getTime() - start.getTime();
  const previousEnd = new Date(start.getTime() - 1); // 1ms before current start
  previousEnd.setHours(23, 59, 59, 999);
  const previousStart = new Date(previousEnd.getTime() - durationMs);
  previousStart.setHours(0, 0, 0, 0);

  const days = Math.round(durationMs / (1000 * 60 * 60 * 24));
  let previousLabel: string;
  if (days <= 7) previousLabel = 'Previous 7 days';
  else if (days <= 30) previousLabel = 'Previous 30 days';
  else if (days <= 90) previousLabel = 'Previous 90 days';
  else if (days <= 183) previousLabel = 'Previous 6 months';
  else previousLabel = `Previous ${days} days`;

  return {
    current: dateRange,
    previous: {
      start: previousStart,
      end: previousEnd,
      preset: 'custom',
    },
    previousLabel,
  };
}
