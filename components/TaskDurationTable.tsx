import React, { useEffect, useMemo, useState } from 'react';
import type { CompletedTask, DateRange, Label, TodoistTaskDuration } from '@/types';
import { useTaskDurations } from '@/hooks/useTaskDurations';
import { parseLabelsFromContent, stripLabelsFromContent } from '@/utils/parseLabelsFromContent';
import { getCompletionHistoryKey } from '@/utils/completionHistory';
import Spinner from './shared/Spinner';

interface TaskDurationTableProps {
  completedTasks: CompletedTask[];
  loadingFullData?: boolean;
  selectedProjectIds: string[];
  dateRange: DateRange;
  labels: Label[];
}

interface LabelRow {
  label: string;
  tasksCompleted: number;
  totalMinutes: number;
}

interface DurationCandidate {
  id: string;
  taskKey: string;
  historyKey: string;
  content: string;
  normalizedContent: string;
  projectId: string;
  addedAt: string;
  completedAt: string;
  localDate: string;
  duration: TodoistTaskDuration;
  labels: string[];
}

interface MergedTask {
  id: string;
  taskId: string;
  v2TaskId: string;
  completedAt: string;
  content: string;
  duration: TodoistTaskDuration | null;
  labels: string[];
}

const NO_LABEL = 'No label';
const MINUTES_PER_DAY = 480;
const REOPEN_DURATION_LOOKAHEAD_DAYS = 30;

function toMinutes(amount: number, unit: string): number {
  return unit === 'day' ? amount * MINUTES_PER_DAY : amount;
}

function formatMinutesWithHours(minutes: number): string {
  return `${minutes.toLocaleString()} (${(minutes / 60).toFixed(1)}hr)`;
}

function getParsedTaskLabels(content: string, labels: Label[]): string[] {
  const parsedLabels = parseLabelsFromContent(content, labels);
  return parsedLabels.length > 0 ? parsedLabels : [NO_LABEL];
}

function normalizeContent(content: string, labels: Label[]): string {
  return stripLabelsFromContent(content, labels)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function toLocalDateString(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isWithinDateRange(value: string, dateRange: DateRange): boolean {
  if (!dateRange.start && !dateRange.end) {
    return true;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  if (dateRange.start && date < dateRange.start) {
    return false;
  }
  if (dateRange.end && date > dateRange.end) {
    return false;
  }

  return true;
}

function getTaskKey(taskId: string, v2TaskId: string): string {
  return v2TaskId || taskId;
}

function getTaskHistoryKey(task: {
  id: string;
  taskId?: string;
  task_id?: string;
  v2TaskId?: string;
  v2_task_id?: string;
}): string {
  const identity: {
    id: string;
    taskId?: string;
    v2TaskId?: string;
  } = {
    id: task.id,
  };

  const taskId = task.taskId ?? task.task_id;
  const v2TaskId = task.v2TaskId ?? task.v2_task_id;
  if (taskId) {
    identity.taskId = taskId;
  }
  if (v2TaskId) {
    identity.v2TaskId = v2TaskId;
  }

  return getCompletionHistoryKey(identity);
}

function getLocalTaskKey(task: {
  taskId?: string;
  task_id?: string;
  v2TaskId?: string;
  v2_task_id?: string;
  completedAt?: string;
  completed_at?: string;
}): string {
  return [
    toLocalDateString(task.completedAt ?? task.completed_at ?? ''),
    getTaskKey(
      task.taskId ?? task.task_id ?? '',
      task.v2TaskId ?? task.v2_task_id ?? ''
    ),
  ].join('|');
}

function getLocalContentAddedKey(task: {
  content: string;
  projectId?: string;
  project_id?: string;
  addedAt?: string;
  added_at?: string;
  completedAt?: string;
  completed_at?: string;
}, labels: Label[]): string {
  return [
    toLocalDateString(task.completedAt ?? task.completed_at ?? ''),
    task.projectId ?? task.project_id ?? '',
    task.addedAt ?? task.added_at ?? '',
    normalizeContent(task.content, labels),
  ].join('|');
}

function getContentAddedKey(task: {
  content: string;
  projectId?: string;
  project_id?: string;
  addedAt?: string;
  added_at?: string;
}, labels: Label[]): string {
  return [
    task.projectId ?? task.project_id ?? '',
    task.addedAt ?? task.added_at ?? '',
    normalizeContent(task.content, labels),
  ].join('|');
}

function getLocalContentProjectKey(task: {
  content: string;
  projectId?: string;
  project_id?: string;
  completedAt?: string;
  completed_at?: string;
}, labels: Label[]): string {
  return [
    toLocalDateString(task.completedAt ?? task.completed_at ?? ''),
    task.projectId ?? task.project_id ?? '',
    normalizeContent(task.content, labels),
  ].join('|');
}

function getContentProjectKey(task: {
  content: string;
  projectId?: string;
  project_id?: string;
}, labels: Label[]): string {
  return [
    task.projectId ?? task.project_id ?? '',
    normalizeContent(task.content, labels),
  ].join('|');
}

function getMergeDedupKeys(task: {
  taskId?: string;
  task_id?: string;
  v2TaskId?: string;
  v2_task_id?: string;
  content: string;
  projectId?: string;
  project_id?: string;
  addedAt?: string;
  added_at?: string;
  completedAt?: string;
  completed_at?: string;
}, labels: Label[]): string[] {
  return [
    getLocalTaskKey(task),
    getLocalContentAddedKey(task, labels),
    getLocalContentProjectKey(task, labels),
  ].filter(Boolean);
}

function getLocalContentKey(task: {
  content: string;
  completedAt?: string;
  completed_at?: string;
}, labels: Label[]): string {
  return [
    toLocalDateString(task.completedAt ?? task.completed_at ?? ''),
    normalizeContent(task.content, labels),
  ].join('|');
}

function TaskDurationTable({
  completedTasks,
  loadingFullData = false,
  selectedProjectIds,
  dateRange,
  labels: labelsProp,
}: TaskDurationTableProps) {
  const {
    tasks: selectedDurationTasks,
    noDurationTasks: selectedNoDurationTasks,
    isLoading: isSelectedDurationLoading,
    error: selectedDurationError,
  } = useTaskDurations(dateRange, selectedProjectIds);

  const [showTasksWithoutDuration, setShowTasksWithoutDuration] = useState(false);

  const sameDayCompletedTasks = useMemo(() => {
    return completedTasks.filter((task) => isWithinDateRange(task.completed_at, dateRange));
  }, [completedTasks, dateRange]);

  // Task identities present on the selected day (from both API sources + same-day completed tasks).
  // Used to scope reopened-task discovery so we only look at tasks related to this day.
  const todayTaskIds = useMemo(() => {
    const ids = new Set<string>();
    for (const t of selectedDurationTasks) {
      ids.add(getTaskKey(t.taskId, t.v2TaskId));
    }
    for (const t of selectedNoDurationTasks) {
      ids.add(getTaskKey(t.taskId, t.v2TaskId));
    }
    for (const t of sameDayCompletedTasks) {
      ids.add(getTaskKey(t.task_id, t.v2_task_id));
    }
    return ids;
  }, [selectedDurationTasks, selectedNoDurationTasks, sameDayCompletedTasks]);

  // Reopened tasks: completed AFTER the selected range (re-completed on a later day
  // to fix duration), whose task identity matches something on the selected day.
  // Past completions of the same recurring task are not reopened — only future
  // re-completions within the lookahead window qualify.
  const reopenedCompletedTasksInRange = useMemo(() => {
    if (dateRange.preset === 'all' || !dateRange.end) return [];
    const lookaheadEnd = new Date(dateRange.end);
    lookaheadEnd.setDate(lookaheadEnd.getDate() + REOPEN_DURATION_LOOKAHEAD_DAYS);
    return completedTasks.filter((task) => {
      if (isWithinDateRange(task.completed_at, dateRange)) return false;
      if (!todayTaskIds.has(getTaskKey(task.task_id, task.v2_task_id))) return false;
      const completedDate = new Date(task.completed_at);
      // Only include tasks re-completed AFTER the range end, within the lookahead window
      return dateRange.end !== null && completedDate > dateRange.end && completedDate <= lookaheadEnd;
    });
  }, [completedTasks, dateRange, todayTaskIds]);

  const durationRange = useMemo<DateRange>(() => {
    if (dateRange.preset === 'all') {
      return dateRange;
    }

    const completionTimes = sameDayCompletedTasks
      .map((task) => Date.parse(task.completed_at))
      .filter((time) => Number.isFinite(time));

    if (completionTimes.length === 0) {
      return {
        start: dateRange.start,
        end: dateRange.end,
        preset: 'custom',
      };
    }

    const start = new Date(Math.min(...completionTimes));
    const end = new Date(Math.max(...completionTimes));
    end.setDate(end.getDate() + REOPEN_DURATION_LOOKAHEAD_DAYS);

    return {
      start,
      end,
      preset: 'custom',
    };
  }, [dateRange, sameDayCompletedTasks]);

  const needsExpandedLookup = useMemo(() => {
    if (dateRange.preset === 'all') {
      return false;
    }

    return reopenedCompletedTasksInRange.length > 0 || sameDayCompletedTasks.some((task) => !task.duration);
  }, [dateRange.preset, reopenedCompletedTasksInRange.length, sameDayCompletedTasks]);

  const {
    tasks: lookupDurationTasks,
    isLoading: isLookupLoading,
    error: lookupDurationError,
  } = useTaskDurations(durationRange, selectedProjectIds, needsExpandedLookup);

  const combinedDurationError = selectedDurationError ?? lookupDurationError;

  const { rows, taskCount, tasksWithoutDuration, totalCompletedCount, totalMinutes } = useMemo(() => {
    const candidateSource = needsExpandedLookup
      ? lookupDurationTasks
      : selectedDurationTasks;

    const durationCandidatesByHistoryKey = new Map<string, DurationCandidate[]>();
    const durationCandidatesByLocalTaskKey = new Map<string, DurationCandidate[]>();
    const durationCandidatesByLocalContentAddedKey = new Map<string, DurationCandidate[]>();
    const durationCandidatesByLocalContentProjectKey = new Map<string, DurationCandidate[]>();
    const durationCandidatesByLocalContentKey = new Map<string, DurationCandidate[]>();
    const usedCandidateIds = new Set<string>();

    const addCandidate = (map: Map<string, DurationCandidate[]>, key: string, candidate: DurationCandidate) => {
      if (!key) {
        return;
      }

      const existing = map.get(key) ?? [];
      existing.push(candidate);
      map.set(key, existing);
    };

    for (const durationTask of candidateSource) {
      const candidate: DurationCandidate = {
        id: durationTask.id,
        taskKey: getTaskKey(durationTask.taskId, durationTask.v2TaskId),
        historyKey: getTaskHistoryKey(durationTask),
        content: durationTask.content,
        normalizedContent: normalizeContent(durationTask.content, labelsProp),
        projectId: durationTask.projectId,
        addedAt: durationTask.addedAt,
        completedAt: durationTask.completedAt,
        localDate: toLocalDateString(durationTask.completedAt),
        duration: durationTask.duration,
        labels: durationTask.labels,
      };

      addCandidate(durationCandidatesByHistoryKey, candidate.historyKey, candidate);
      addCandidate(durationCandidatesByLocalTaskKey, getLocalTaskKey(durationTask), candidate);
      addCandidate(durationCandidatesByLocalContentAddedKey, getLocalContentAddedKey(durationTask, labelsProp), candidate);
      addCandidate(durationCandidatesByLocalContentProjectKey, getLocalContentProjectKey(durationTask, labelsProp), candidate);
      addCandidate(durationCandidatesByLocalContentKey, getLocalContentKey(durationTask, labelsProp), candidate);
    }

    const takeFromMap = (
      map: Map<string, DurationCandidate[]>,
      key: string
    ): DurationCandidate | null => {
      if (!key) {
        return null;
      }

      const candidates = map.get(key);
      if (!candidates) {
        return null;
      }

      while (candidates.length > 0) {
        const candidate = candidates.shift() ?? null;
        if (!candidate) {
          break;
        }
        if (usedCandidateIds.has(candidate.id)) {
          continue;
        }

        usedCandidateIds.add(candidate.id);
        if (candidates.length === 0) {
          map.delete(key);
        }
        return candidate;
      }

      map.delete(key);
      return null;
    };

    const takeCandidate = (task: {
      id: string;
      taskId?: string;
      task_id?: string;
      v2TaskId?: string;
      v2_task_id?: string;
      content: string;
      projectId?: string;
      project_id?: string;
      addedAt?: string;
      added_at?: string;
      completedAt?: string;
      completed_at?: string;
    }): DurationCandidate | null => {
      return (
        takeFromMap(durationCandidatesByLocalTaskKey, getLocalTaskKey(task)) ??
        takeFromMap(durationCandidatesByLocalContentAddedKey, getLocalContentAddedKey(task, labelsProp)) ??
        takeFromMap(durationCandidatesByLocalContentProjectKey, getLocalContentProjectKey(task, labelsProp)) ??
        takeFromMap(durationCandidatesByLocalContentKey, getLocalContentKey(task, labelsProp)) ??
        takeFromMap(durationCandidatesByHistoryKey, getTaskHistoryKey(task)) ??
        null
      );
    };

    // Identity sets from reopened tasks (re-completed after the range)
    const reopenedHistoryKeys = new Set(reopenedCompletedTasksInRange.map((task) => getTaskHistoryKey(task)));
    const reopenedTaskKeys = new Set(reopenedCompletedTasksInRange.map((task) => getTaskKey(task.task_id, task.v2_task_id)));
    const reopenedContentAddedKeys = new Set(
      reopenedCompletedTasksInRange.map((task) => getContentAddedKey(task, labelsProp)).filter(Boolean)
    );
    const reopenedContentProjectKeys = new Set(
      reopenedCompletedTasksInRange.map((task) => getContentProjectKey(task, labelsProp)).filter(Boolean)
    );

    // Also match against same-day tasks by content+project. This catches tasks
    // that were un-completed from today and re-completed on a later day as a
    // DIFFERENT task (different task_id) — e.g. a bugreporter task that was
    // recreated with an updated duration. Task IDs may differ across APIs,
    // so content+project matching is the reliable fallback.
    const sameDayContentAddedKeys = new Set(
      sameDayCompletedTasks.map((task) => getContentAddedKey(task, labelsProp)).filter(Boolean)
    );
    const sameDayContentProjectKeys = new Set(
      sameDayCompletedTasks.map((task) => getContentProjectKey(task, labelsProp)).filter(Boolean)
    );
    for (const task of selectedDurationTasks) {
      const k1 = getContentAddedKey(task, labelsProp);
      const k2 = getContentProjectKey(task, labelsProp);
      if (k1) sameDayContentAddedKeys.add(k1);
      if (k2) sameDayContentProjectKeys.add(k2);
    }
    for (const task of selectedNoDurationTasks) {
      const k1 = getContentAddedKey(task, labelsProp);
      const k2 = getContentProjectKey(task, labelsProp);
      if (k1) sameDayContentAddedKeys.add(k1);
      if (k2) sameDayContentProjectKeys.add(k2);
    }

    const reopenedDurationTasks = lookupDurationTasks.filter((task) => {
      if (isWithinDateRange(task.completedAt, dateRange)) {
        return false;
      }

      return (
        reopenedHistoryKeys.has(getTaskHistoryKey(task)) ||
        reopenedTaskKeys.has(getTaskKey(task.taskId, task.v2TaskId)) ||
        reopenedContentAddedKeys.has(getContentAddedKey(task, labelsProp)) ||
        reopenedContentProjectKeys.has(getContentProjectKey(task, labelsProp)) ||
        sameDayContentAddedKeys.has(getContentAddedKey(task, labelsProp)) ||
        sameDayContentProjectKeys.has(getContentProjectKey(task, labelsProp))
      );
    });

    const mergedTasks: MergedTask[] = [];
    const seen = new Set<string>();

    const hasMergedIdentity = (task: {
      id: string;
      taskId?: string;
      task_id?: string;
      v2TaskId?: string;
      v2_task_id?: string;
    }) => {
      const taskHistoryKey = getTaskHistoryKey(task);
      const taskKey = getTaskKey(task.taskId ?? task.task_id ?? '', task.v2TaskId ?? task.v2_task_id ?? '');

      return mergedTasks.some((mergedTask) => {
        return (
          getTaskHistoryKey(mergedTask) === taskHistoryKey ||
          getTaskKey(mergedTask.taskId, mergedTask.v2TaskId) === taskKey
        );
      });
    };

    const addMergedTask = (task: MergedTask, dedupKeysOverride?: string[]) => {
      const dedupKeys = (dedupKeysOverride ?? getMergeDedupKeys(task, labelsProp)).filter(Boolean);
      if (dedupKeys.some((key) => seen.has(key))) {
        return;
      }

      for (const key of dedupKeys) {
        seen.add(key);
      }
      mergedTasks.push(task);
    };

    for (const task of selectedDurationTasks) {
      takeCandidate(task);

      addMergedTask({
        id: task.id,
        taskId: task.taskId,
        v2TaskId: task.v2TaskId,
        completedAt: task.completedAt,
        content: task.content,
        duration: task.duration,
        labels: task.labels.length > 0
          ? task.labels
          : getParsedTaskLabels(task.content, labelsProp),
      });
    }

    for (const task of selectedNoDurationTasks) {
      const matchedCandidate = takeCandidate(task);
      addMergedTask({
        id: task.id,
        taskId: task.taskId,
        v2TaskId: task.v2TaskId,
        completedAt: task.completedAt,
        content: task.content,
        duration: matchedCandidate?.duration ?? null,
        labels: matchedCandidate?.labels.length
          ? matchedCandidate.labels
          : task.labels.length > 0
            ? task.labels
            : getParsedTaskLabels(task.content, labelsProp),
      });
    }

    for (const task of sameDayCompletedTasks) {
      const dedupKeys = getMergeDedupKeys(task, labelsProp);
      const identityAlreadyMerged = hasMergedIdentity(task);
      if (dedupKeys.some((key) => seen.has(key)) && identityAlreadyMerged) {
        continue;
      }

      const matchedCandidate = takeCandidate(task);
      const mergedTask: MergedTask = {
        id: task.id,
        taskId: task.task_id,
        v2TaskId: task.v2_task_id,
        completedAt: task.completed_at,
        content: matchedCandidate?.content ?? task.content,
        duration: matchedCandidate?.duration ?? task.duration ?? null,
        labels: matchedCandidate?.labels.length
          ? matchedCandidate.labels
          : getParsedTaskLabels(task.content, labelsProp),
      };

      addMergedTask(
        mergedTask,
        identityAlreadyMerged
          ? undefined
          : [getLocalTaskKey(task), getTaskHistoryKey(task)].filter(Boolean)
      );
    }

    // Reopened tasks from completedTasks are NOT added directly — recurring tasks
    // share the same task_id and would flood the list. Instead, we rely on
    // reopenedDurationTasks (step 5) which only includes tasks from the expanded
    // by_completion_date API that have duration data AND match a reopened identity.
    // This correctly captures re-completions (e.g. bugreporter 285 min fixed on
    // a later day) while excluding recurring completions (e.g. daily "Do neck PT").

    for (const task of reopenedDurationTasks) {
      addMergedTask({
        id: task.id,
        taskId: task.taskId,
        v2TaskId: task.v2TaskId,
        completedAt: task.completedAt,
        content: task.content,
        duration: task.duration,
        labels: task.labels.length > 0
          ? task.labels
          : getParsedTaskLabels(task.content, labelsProp),
      });
    }

    const withDuration = mergedTasks.filter((task) => Boolean(task.duration));
    const withoutDuration = mergedTasks.filter((task) => !task.duration);

    const totals = new Map<string, { count: number; minutes: number }>();
    for (const task of withDuration) {
      const duration = task.duration!;
      const minutes = toMinutes(duration.amount, duration.unit);

      for (const label of task.labels) {
        const entry = totals.get(label) ?? { count: 0, minutes: 0 };
        entry.count += 1;
        entry.minutes += minutes;
        totals.set(label, entry);
      }
    }

    const aggregated: LabelRow[] = Array.from(totals.entries())
      .map(([label, { count, minutes }]) => ({
        label,
        tasksCompleted: count,
        totalMinutes: minutes,
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes);

    return {
      rows: aggregated,
      taskCount: withDuration.length,
      tasksWithoutDuration: withoutDuration,
      totalCompletedCount: mergedTasks.length,
      totalMinutes: withDuration.reduce((sum, task) => {
        const duration = task.duration!;
        return sum + toMinutes(duration.amount, duration.unit);
      }, 0),
    };
  }, [
    labelsProp,
    lookupDurationTasks,
    needsExpandedLookup,
    reopenedCompletedTasksInRange,
    sameDayCompletedTasks,
    selectedDurationTasks,
    selectedNoDurationTasks,
    dateRange,
  ]);

  useEffect(() => {
    setShowTasksWithoutDuration(tasksWithoutDuration.length > 0 && tasksWithoutDuration.length < 6);
  }, [tasksWithoutDuration.length]);

  if ((loadingFullData || isSelectedDurationLoading || isLookupLoading) && (completedTasks.length > 0 || loadingFullData)) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <Spinner />
      </div>
    );
  }

  if (combinedDurationError && rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[220px] text-warm-gray">
        <p className="text-sm">Failed to load duration data</p>
        <p className="text-xs mt-1 opacity-70">{combinedDurationError}</p>
      </div>
    );
  }

  if (rows.length === 0 && tasksWithoutDuration.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[220px] text-warm-gray">
        <p className="text-sm">No tasks with duration estimates found</p>
        <p className="text-xs mt-1 opacity-70">
          Try expanding the selected time period or add durations to tasks in Todoist.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-warm-gray">
        {totalCompletedCount} completed, {taskCount} with duration, {tasksWithoutDuration.length} without duration data, {totalMinutes.toLocaleString()} min total
        {dateRange.preset === 'all' && (
          <span className="opacity-70"> (last 90 days)</span>
        )}
      </p>

      {rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-warm-border bg-warm-black/20">
          <div className="max-h-[420px] overflow-auto">
            <table className="min-w-full table-fixed">
              <thead className="sticky top-0 z-10 bg-warm-card">
                <tr className="border-b border-warm-border text-left text-xs uppercase tracking-wide text-warm-gray">
                  <th scope="col" className="w-[40%] px-4 py-3 font-medium">Label</th>
                  <th scope="col" className="w-[30%] px-4 py-3 text-right font-medium">Tasks Completed</th>
                  <th scope="col" className="w-[30%] px-4 py-3 text-right font-medium">Time (min)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-border">
                {rows.map((row) => (
                  <tr key={row.label} className="align-top">
                    <td className="px-4 py-3 text-sm text-white">
                      {row.label}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-warm-gray">
                      {row.tasksCompleted}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium tabular-nums text-white">
                      {row.totalMinutes}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-warm-border bg-warm-card/50">
                  <td className="px-4 py-3 text-sm font-semibold text-white">Total</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-white">
                    {taskCount}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-white">
                    {formatMinutesWithHours(totalMinutes)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {tasksWithoutDuration.length > 0 && (
        <div className="rounded-xl border border-warm-border bg-warm-card/40 p-4">
          <button
            type="button"
            onClick={() => setShowTasksWithoutDuration((current) => !current)}
            aria-expanded={showTasksWithoutDuration}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <span className="text-sm font-medium text-white">
              {tasksWithoutDuration.length} task{tasksWithoutDuration.length === 1 ? '' : 's'} without duration data
            </span>
            <span className="text-xs font-medium text-warm-gray">
              {showTasksWithoutDuration ? 'Hide' : 'Show'}
            </span>
          </button>
          <p className="mt-1 text-xs text-warm-gray">
            These completed tasks are included in the total count but could not be matched to a usable duration value.
          </p>
          {showTasksWithoutDuration && (
            <div className="mt-2 max-h-64 overflow-auto pr-1">
              <ul className="space-y-1">
                {tasksWithoutDuration.map((task) => (
                  <li
                    key={`${task.taskId}-${task.completedAt}`}
                    className="text-sm text-warm-gray"
                  >
                    {task.content}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default React.memo(TaskDurationTable);
