import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { HiCalendar, HiX, HiCheck, HiChevronDown } from 'react-icons/hi';
import { motion, AnimatePresence } from 'framer-motion';
import { DayPicker } from 'react-day-picker';
import type { DateRange as RDPDateRange } from 'react-day-picker';
import 'react-day-picker/style.css';
import type { DateRange, DateRangePreset } from '@/types';
import { getDateRangeFromPreset, getPresetLabel, normalizeDateRange, matchPreset } from '@/utils/dateRangePresets';
import { trackDateFilter } from '@/utils/analytics';
import styles from './DateRangePicker.module.css';

interface DateRangePickerProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  fullWidth?: boolean;
}

const PRESET_CHIPS: readonly DateRangePreset[] = [
  'all', 'today', 'yesterday', '7d', '30d', '90d', '6m', '1y',
];

function formatDay(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  dateRange,
  onDateRangeChange,
  fullWidth = false,
}) => {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pendingRange, setPendingRange] = useState<RDPDateRange | undefined>(undefined);
  const calendarRef = useRef<HTMLDivElement>(null);

  const [prefersReducedMotion] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  // Close calendar on outside click
  useEffect(() => {
    if (!calendarOpen) return;
    const handler = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setCalendarOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [calendarOpen]);

  const openCalendar = useCallback(() => {
    if (dateRange.start && dateRange.end) {
      setPendingRange({ from: dateRange.start, to: dateRange.end });
    } else {
      setPendingRange(undefined);
    }
    setCalendarOpen(true);
  }, [dateRange]);

  const handlePresetClick = useCallback((preset: DateRangePreset) => {
    if (preset === 'custom') {
      if (calendarOpen) {
        setCalendarOpen(false);
      } else {
        openCalendar();
      }
      return;
    }

    setCalendarOpen(false);
    const { start, end } = getDateRangeFromPreset(preset);
    onDateRangeChange({ start, end, preset });

    if (preset === 'all') {
      trackDateFilter('clear');
    } else {
      trackDateFilter('preset', { preset });
    }
  }, [onDateRangeChange, calendarOpen, openCalendar]);

  const handleRangeSelect = useCallback((range: RDPDateRange | undefined) => {
    setPendingRange(range ?? undefined);
  }, []);

  const handleApply = useCallback(() => {
    if (!pendingRange?.from) return;

    const from = pendingRange.from;
    const to = pendingRange.to ?? pendingRange.from;
    const { start, end } = normalizeDateRange(from, to);

    if (start && end) {
      const preset = matchPreset(start, end);
      onDateRangeChange({ start, end, preset });
      setCalendarOpen(false);

      if (preset === 'custom') {
        const daysRange = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        trackDateFilter('custom', { daysRange });
      } else {
        trackDateFilter('preset', { preset });
      }
    }
  }, [pendingRange, onDateRangeChange]);

  const customLabel = useMemo(() => {
    if (dateRange.preset === 'custom' && dateRange.start && dateRange.end) {
      const startStr = formatDay(dateRange.start);
      const endStr = formatDay(dateRange.end);
      if (startStr === endStr) return startStr;
      return `${startStr} – ${endStr}`;
    }
    return null;
  }, [dateRange]);

  const pendingLabel = useMemo(() => {
    if (!pendingRange?.from) return null;
    const startStr = formatDay(pendingRange.from);
    if (!pendingRange.to) return startStr;
    const endStr = formatDay(pendingRange.to);
    if (startStr === endStr) return startStr;
    return `${startStr} – ${endStr}`;
  }, [pendingRange]);

  const canApply = !!pendingRange?.from;
  const animationDuration = prefersReducedMotion ? 0 : 0.15;

  const MONTHS_TO_SHOW = 12;
  const START_MONTH = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - (MONTHS_TO_SHOW - 1));
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }, []);

  const [visibleMonth, setVisibleMonth] = useState(START_MONTH);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom (current month) when the calendar opens
  useEffect(() => {
    if (calendarOpen && scrollRef.current) {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    }
  }, [calendarOpen]);

  // Jump-to controls
  const jumpMonth = useCallback((monthIndex: number) => {
    setVisibleMonth(prev => new Date(prev.getFullYear(), monthIndex, 1));
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }
    });
  }, []);

  const jumpYear = useCallback((year: number) => {
    setVisibleMonth(prev => new Date(year, prev.getMonth(), 1));
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }
    });
  }, []);

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const years: number[] = [];
    for (let y = current; y >= 2015; y--) years.push(y);
    return years;
  }, []);

  return (
    <div
      className={`${styles.dateRangePicker} relative z-10 ${fullWidth ? 'w-full' : ''}`}
      ref={calendarRef}
    >
      {/* Chip row */}
      <div
        className={`flex flex-wrap gap-1.5 ${fullWidth ? 'w-full' : ''}`}
        role="group"
        aria-label="Date range filter"
      >
        {PRESET_CHIPS.map((preset) => {
          const active = dateRange.preset === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => handlePresetClick(preset)}
              aria-pressed={active}
              className={`
                px-3 py-1.5 text-xs font-medium rounded-lg transition-colors duration-150
                whitespace-nowrap select-none
                ${active
                  ? 'bg-warm-peach text-white'
                  : 'bg-warm-hover text-warm-gray hover:text-white hover:bg-warm-card border border-warm-border'
                }
              `}
            >
              {getPresetLabel(preset)}
            </button>
          );
        })}

        {/* Custom chip */}
        <button
          type="button"
          onClick={() => handlePresetClick('custom')}
          aria-pressed={dateRange.preset === 'custom'}
          aria-expanded={calendarOpen}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
            transition-colors duration-150 whitespace-nowrap select-none
            ${dateRange.preset === 'custom'
              ? 'bg-warm-peach text-white'
              : 'bg-warm-hover text-warm-gray hover:text-white hover:bg-warm-card border border-warm-border'
            }
          `}
        >
          <HiCalendar className="w-3.5 h-3.5" />
          {customLabel ?? 'Custom'}
        </button>
      </div>

      {/* Calendar popover */}
      <AnimatePresence>
        {calendarOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: animationDuration }}
            className={`
              absolute left-0 top-full mt-2
              bg-warm-card rounded-xl shadow-lg border border-warm-border
              ${fullWidth ? 'right-0' : 'sm:right-auto'}
            `}
            style={{ zIndex: 50, width: 308 }}
          >
            {/* Sticky header: status + jump controls + close */}
            <div className="sticky top-0 z-10 bg-warm-card rounded-t-xl border-b border-warm-border px-3 pt-3 pb-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-warm-gray font-medium">
                  {!pendingRange?.from
                    ? 'Pick a start date'
                    : !pendingRange.to
                      ? 'Pick an end date (or apply for single day)'
                      : 'Range selected'}
                </span>
                <button
                  type="button"
                  onClick={() => setCalendarOpen(false)}
                  className="p-1 rounded-md hover:bg-warm-hover text-warm-gray hover:text-white transition-colors"
                  aria-label="Close calendar"
                >
                  <HiX className="w-3.5 h-3.5" />
                </button>
              </div>
              {/* Jump-to dropdowns */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <select
                    value={visibleMonth.getMonth()}
                    onChange={(e) => jumpMonth(Number(e.target.value))}
                    className={styles.jumpSelect}
                    aria-label="Jump to month"
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i} value={i}>
                        {new Date(2000, i).toLocaleString('en-US', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                  <HiChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-warm-gray" />
                </div>
                <div className="relative">
                  <select
                    value={visibleMonth.getFullYear()}
                    onChange={(e) => jumpYear(Number(e.target.value))}
                    className={styles.jumpSelect}
                    aria-label="Jump to year"
                  >
                    {yearOptions.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <HiChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-warm-gray" />
                </div>
              </div>
            </div>

            {/* Scrollable month grid */}
            <div
              ref={scrollRef}
              className={styles.calendarScroll}
            >
              <DayPicker
                mode="range"
                month={visibleMonth}
                onMonthChange={setVisibleMonth}
                startMonth={new Date(2015, 0)}
                endMonth={new Date()}
                numberOfMonths={MONTHS_TO_SHOW}
                selected={pendingRange}
                onSelect={handleRangeSelect}
                disabled={{ after: new Date() }}
                className={styles.calendarRoot ?? ''}
                min={0}
                hideNavigation
              />
            </div>

            {/* Footer: selection summary + apply */}
            <div className="border-t border-warm-border px-3 py-2 flex items-center justify-between gap-2">
              <span className="text-xs text-warm-gray truncate">
                {pendingLabel ?? 'No dates selected'}
              </span>
              <div className="flex items-center gap-1.5">
                {canApply && (
                  <button
                    type="button"
                    onClick={() => setPendingRange(undefined)}
                    className="px-2 py-1 text-xs text-warm-gray hover:text-white rounded-md hover:bg-warm-hover transition-colors"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={!canApply}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors duration-150 bg-warm-peach text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <HiCheck className="w-3.5 h-3.5" />
                  Apply
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Screen reader announcement */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {dateRange.preset !== 'all'
          ? `Date filter: ${customLabel ?? getPresetLabel(dateRange.preset)}`
          : 'No date filter'}
      </div>
    </div>
  );
};

export default DateRangePicker;
