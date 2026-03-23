import React, { useMemo } from 'react';
import type { DateRange } from '@/types';
import { useTaskDurations } from '@/hooks/useTaskDurations';
import Spinner from './shared/Spinner';

interface TaskDurationTableProps {
  dateRange: DateRange;
  selectedProjectIds: string[];
}

interface LabelRow {
  label: string;
  tasksCompleted: number;
  totalMinutes: number;
}

const NO_LABEL = 'No label';

function TaskDurationTable({ dateRange, selectedProjectIds }: TaskDurationTableProps) {
  const { tasks, isLoading, error } = useTaskDurations(dateRange, selectedProjectIds);

  const { rows, taskCount, totalMinutes } = useMemo(() => {
    const minuteTasks = tasks.filter(t => t.duration.unit === 'minute');
    const totals = new Map<string, { count: number; minutes: number }>();

    for (const task of minuteTasks) {
      const labels = task.labels.length > 0 ? task.labels : [NO_LABEL];

      for (const label of labels) {
        const key = label === NO_LABEL ? NO_LABEL : label;
        const entry = totals.get(key) ?? { count: 0, minutes: 0 };
        entry.count += 1;
        entry.minutes += task.duration.amount;
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

    return {
      rows: aggregated,
      taskCount: minuteTasks.length,
      totalMinutes: minuteTasks.reduce((sum, t) => sum + t.duration.amount, 0),
    };
  }, [tasks]);

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

  if (rows.length === 0) {
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
        {taskCount} task{taskCount === 1 ? '' : 's'}, {totalMinutes} min total
        {dateRange.preset === 'all' && (
          <span className="opacity-70"> (last 90 days)</span>
        )}
      </p>

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
    </div>
  );
}

export default React.memo(TaskDurationTable);
