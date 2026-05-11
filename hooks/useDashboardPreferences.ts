import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { DashboardPreferences, DateRange, DateRangePreset } from '@/types';
import { getDateRangeFromPreset } from '@/utils/dateRangePresets';

const STORAGE_KEY = 'todoist_dashboard_preferences';
const SCHEMA_VERSION = 2;
const SAVE_DEBOUNCE_MS = 300;
const VALID_PRESETS: DateRangePreset[] = ['all', 'today', 'yesterday', '7d', '30d', '90d', '6m', '1y', 'custom'];
const DYNAMIC_PRESETS: DateRangePreset[] = ['all', 'today', 'yesterday', '7d', '30d', '90d', '6m', '1y'];

// Default preferences
const DEFAULT_PREFERENCES: DashboardPreferences = {
  selectedProjectIds: [],
  dateRange: {
    start: null,
    end: null,
    preset: 'all',
  },
  visibleSections: [], // Empty array means all sections visible
  version: SCHEMA_VERSION,
};

function getValidPreset(value: unknown): DateRangePreset {
  return VALID_PRESETS.includes(value as DateRangePreset)
    ? value as DateRangePreset
    : 'all';
}

function resolveDateRange(dateRange: DateRange): DateRange {
  if (DYNAMIC_PRESETS.includes(dateRange.preset)) {
    return {
      ...getDateRangeFromPreset(dateRange.preset),
      preset: dateRange.preset,
    };
  }

  return dateRange;
}

function getDateRangeDayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
}

/**
 * Loads preferences from localStorage
 * Handles errors gracefully and falls back to defaults
 */
function loadPreferences(): DashboardPreferences {
  // Check if localStorage is available (fails in private browsing)
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return DEFAULT_PREFERENCES;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return DEFAULT_PREFERENCES;
    }

    const parsed = JSON.parse(stored);

    // Schema migration: v1 -> v2
    if (parsed.version === 1) {
      console.info('Migrating dashboard preferences from v1 to v2');
      parsed.visibleSections = []; // All sections visible by default
      parsed.version = 2;
    }

    // Validate schema version
    if (parsed.version !== SCHEMA_VERSION) {
      console.warn('Dashboard preferences schema mismatch, resetting to defaults');
      return DEFAULT_PREFERENCES;
    }

    // Deserialize date strings to Date objects
    const rawDateRange =
      parsed.dateRange && typeof parsed.dateRange === 'object'
        ? parsed.dateRange
        : { start: null, end: null, preset: 'all' };

    const preset = getValidPreset(rawDateRange.preset);
    const dateRange: DateRange = {
      start: rawDateRange.start ? new Date(rawDateRange.start) : null,
      end: rawDateRange.end ? new Date(rawDateRange.end) : null,
      preset,
    };

    const resolvedDateRange = resolveDateRange(dateRange);

    // Validate dates are not invalid
    if (resolvedDateRange.start && isNaN(resolvedDateRange.start.getTime())) {
      resolvedDateRange.start = null;
    }
    if (resolvedDateRange.end && isNaN(resolvedDateRange.end.getTime())) {
      resolvedDateRange.end = null;
    }

    return {
      selectedProjectIds: Array.isArray(parsed.selectedProjectIds)
        ? parsed.selectedProjectIds
        : [],
      dateRange: resolvedDateRange,
      visibleSections: Array.isArray(parsed.visibleSections)
        ? parsed.visibleSections
        : [],
      version: SCHEMA_VERSION,
    };
  } catch (error) {
    console.error('Failed to load dashboard preferences:', error);
    return DEFAULT_PREFERENCES;
  }
}

/**
 * Saves preferences to localStorage
 * Handles errors gracefully (quota exceeded, etc.)
 */
function savePreferences(preferences: DashboardPreferences): void {
  // Check if localStorage is available
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }

  try {
    // Serialize dates to ISO strings
    const dateRangeToSave = DYNAMIC_PRESETS.includes(preferences.dateRange.preset)
      ? {
          start: null,
          end: null,
          preset: preferences.dateRange.preset,
        }
      : {
          ...preferences.dateRange,
          start: preferences.dateRange.start
            ? preferences.dateRange.start.toISOString()
            : null,
          end: preferences.dateRange.end
            ? preferences.dateRange.end.toISOString()
            : null,
        };
    const toSave = {
      ...preferences,
      dateRange: dateRangeToSave,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (error) {
    // Handle quota exceeded or other localStorage errors
    if (process.env.NODE_ENV === 'development') {
      console.warn('Failed to save dashboard preferences:', error);
    }
  }
}

/**
 * Hook for managing dashboard preferences with localStorage persistence
 *
 * Features:
 * - Auto-loads from localStorage on mount
 * - Auto-saves changes to localStorage (debounced)
 * - Handles localStorage errors gracefully
 * - Validates and sanitizes loaded data
 *
 * @returns Object with preferences, updatePreferences, and clearPreferences
 */
export function useDashboardPreferences() {
  const [preferences, setPreferences] = useState<DashboardPreferences>(loadPreferences);
  const dayKey = getDateRangeDayKey();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced save function
  const debouncedSave = useCallback((prefs: DashboardPreferences) => {
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout
    saveTimeoutRef.current = setTimeout(() => {
      savePreferences(prefs);
    }, SAVE_DEBOUNCE_MS);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Updates preferences (shallow merge) and saves to localStorage
   */
  const updatePreferences = useCallback(
    (updates: Partial<DashboardPreferences>) => {
      setPreferences(prev => {
        const updated = {
          ...prev,
          ...updates,
          version: SCHEMA_VERSION,
        };
        debouncedSave(updated);
        return updated;
      });
    },
    [debouncedSave]
  );

  /**
   * Clears all preferences and resets to defaults
   */
  const clearPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
    savePreferences(DEFAULT_PREFERENCES);
  }, []);

  const resolvedPreferences = useMemo<DashboardPreferences>(() => ({
    ...preferences,
    dateRange: resolveDateRange(preferences.dateRange),
  }), [preferences, dayKey]);

  return {
    preferences: resolvedPreferences,
    updatePreferences,
    clearPreferences,
  };
}
