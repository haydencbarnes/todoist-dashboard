import React, { useEffect, useMemo, useState } from 'react';
import type { CompletedTask, DateRange, Label } from '@/types';
import { useTaskDurations } from '@/hooks/useTaskDurations';
import { stripLabelsFromContent } from '@/utils/parseLabelsFromContent';
import Spinner from './shared/Spinner';

interface TaskDurationTableProps {
  completedTasks: CompletedTask[];
  dateRange: DateRange;
  labels: Label[];
  selectedProjectIds: string[];
}

interface LabelRow {
  label: string;
  tasksCompleted: number;
  totalMinutes: number;
}

const NO_LABEL = 'No label';
const MINUTES_PER_DAY = 480;

function toMinutes(amount: number, unit: string): number {
  return unit === 'day' ? amount * MINUTES_PER_DAY : amount;
}

function getDayKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeContent(content: string, labels: Label[]): string {
  const stripped = stripLabelsFromContent(content, labels);
  return stripped
    .replace(/(^|\s)@[^\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function buildComparisonKey(content: string, completedAt: string, labels: Label[]): string {
  return `${normalizeContent(content, labels)}|${getDayKey(completedAt)}`;
}

function TaskDurationTable({ completedTasks, dateRange, labels: labelsProp, selectedProjectIds }: TaskDurationTableProps) {
  const { tasks, isLoading, error } = useTaskDurations(dateRange, selectedProjectIds);
  const [showTasksWithoutDuration, setShowTasksWithoutDuration] = useState(false);

  const { rows, taskCount, tasksWithoutDuration, totalCompletedCount, totalMinutes } = useMemo(() => {
    const totals = new Map<string, { count: number; minutes: number }>();
    const availableCounts = new Map<string, number>();

    for (const task of tasks) {
      const minutes = toMinutes(task.duration.amount, task.duration.unit);
      const taskLabels = task.labels.length > 0 ? task.labels : [NO_LABEL];
      const comparisonKey = buildComparisonKey(task.content, task.completedAt, labelsProp);
      availableCounts.set(comparisonKey, (availableCounts.get(comparisonKey) ?? 0) + 1);

      for (const label of taskLabels) {
        const key = label === NO_LABEL ? NO_LABEL : label;
        const entry = totals.get(key) ?? { count: 0, minutes: 0 };
        entry.count += 1;
        entry.minutes += minutes;
        totals.set(key, entry);
      }
    }

    const aggregated: LabelRow[] = Array.from(totals.entries())
      .map(([label, { count, minutes }]) => ({
        label,
        tasksCompleted: count,
        totalMinutes: minutes,
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes);

    const missing = completedTasks.filter((task) => {
      const comparisonKey = buildComparisonKey(task.content, task.completed_at, labelsProp);
      const remaining = availableCounts.get(comparisonKey) ?? 0;

      if (remaining > 0) {
        availableCounts.set(comparisonKey, remaining - 1);
        return false;
      }

      return true;
    });

    return {
      rows: aggregated,
      taskCount: tasks.length,
      tasksWithoutDuration: missing,
      totalCompletedCount: completedTasks.length,
      totalMinutes: tasks.reduce((sum, t) => sum + toMinutes(t.duration.amount, t.duration.unit), 0),
    };
  }, [completedTasks, labelsProp, tasks]);

  useEffect(() => {
    setShowTasksWithoutDuration(tasksWithoutDuration.length > 0 && tasksWithoutDuration.length < 6);
  }, [tasksWithoutDuration.length]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[220px] text-warm-gray">
        <p className="text-sm">Failed to load duration data</p>
        <p className="text-xs mt-1 opacity-70">{error}</p>
      </div>
    );
  }

  if (rows.length === 0 && tasksWithoutDuration.length === 0) {
    const isAllTime = dateRange.preset === 'all';
    return (
      <div className="flex flex-col items-center justify-center h-[220px] text-warm-gray">
        <p className="text-sm">No tasks with duration estimates found</p>
        <p className="text-xs mt-1 opacity-70">
          {isAllTime
            ? 'Showing last 90 days. Set durations on tasks in Todoist to see them here.'
            : 'Try expanding the selected time period or add durations to tasks in Todoist.'}
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
                    {totalMinutes}
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
                    key={`${task.task_id}-${task.completed_at}`}
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
