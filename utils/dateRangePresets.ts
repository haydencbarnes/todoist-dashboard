import type { DateRangePreset } from '@/types';

/** Midnight start of a calendar day in local time */
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Last millisecond of a calendar day in local time */
function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Normalizes an arbitrary start/end pair so filtering always covers
 * the full calendar day(s). Used for both preset and custom ranges.
 */
export function normalizeDateRange(
  start: Date | null,
  end: Date | null
): { start: Date | null; end: Date | null } {
  if (!start && !end) return { start: null, end: null };
  return {
    start: start ? startOfDay(start) : null,
    end: end ? endOfDay(end) : null,
  };
}

/**
 * Calculates the date range for a given preset.
 * All presets return full-day-boundary dates.
 */
export function getDateRangeFromPreset(
  preset: DateRangePreset
): { start: Date | null; end: Date | null } {
  const now = new Date();
  const todayEnd = endOfDay(now);

  switch (preset) {
    case 'all':
      return { start: null, end: null };

    case 'today':
      return { start: startOfDay(now), end: todayEnd };

    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { start: startOfDay(y), end: endOfDay(y) };
    }

    case '7d': {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      return { start: startOfDay(start), end: todayEnd };
    }

    case '30d': {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      return { start: startOfDay(start), end: todayEnd };
    }

    case '90d': {
      const start = new Date(now);
      start.setDate(start.getDate() - 90);
      return { start: startOfDay(start), end: todayEnd };
    }

    case '6m': {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 6);
      return { start: startOfDay(start), end: todayEnd };
    }

    case '1y': {
      const start = new Date(now);
      start.setFullYear(start.getFullYear() - 1);
      return { start: startOfDay(start), end: todayEnd };
    }

    case 'custom':
      return { start: null, end: null };

    default:
      return { start: null, end: null };
  }
}

const PRESET_LABELS: Record<DateRangePreset, string> = {
  all: 'All Time',
  today: 'Today',
  yesterday: 'Yesterday',
  '7d': '7 Days',
  '30d': '30 Days',
  '90d': '90 Days',
  '6m': '6 Months',
  '1y': '1 Year',
  custom: 'Custom',
};

export function getPresetLabel(preset: DateRangePreset): string {
  return PRESET_LABELS[preset] ?? 'All Time';
}

/**
 * Checks if a normalized start/end pair matches any built-in preset.
 * Returns the matching preset key, or 'custom' if none match.
 */
const MATCHABLE_PRESETS: readonly DateRangePreset[] = [
  'today', 'yesterday', '7d', '30d', '90d', '6m', '1y',
];

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function matchPreset(start: Date, end: Date): DateRangePreset {
  for (const preset of MATCHABLE_PRESETS) {
    const range = getDateRangeFromPreset(preset);
    if (range.start && range.end && sameDay(start, range.start) && sameDay(end, range.end)) {
      return preset;
    }
  }
  return 'custom';
}
