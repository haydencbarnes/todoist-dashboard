import { useState, useEffect } from 'react';
import type { DateRange, TodoistTaskDuration } from '@/types';
import { subDays } from 'date-fns';

export interface DurationTask {
  id: string;
  addedAt: string;
  content: string;
  projectId: string;
  completedAt: string;
  taskId: string;
  v2TaskId: string;
  duration: TodoistTaskDuration;
  labels: string[];
}

export interface NoDurationTask {
  id: string;
  addedAt: string;
  content: string;
  projectId: string;
  completedAt: string;
  taskId: string;
  v2TaskId: string;
  labels: string[];
}

interface UseTaskDurationsResult {
  tasks: DurationTask[];
  noDurationTasks: NoDurationTask[];
  isLoading: boolean;
  error: string | null;
}

const MS_90_DAYS = 90 * 24 * 60 * 60 * 1000;

function getDateWindows(start: Date, end: Date): Array<{ since: string; until: string }> {
  const windows: Array<{ since: string; until: string }> = [];
  let windowStart = new Date(start);

  while (windowStart < end) {
    const windowEnd = new Date(
      Math.min(windowStart.getTime() + MS_90_DAYS, end.getTime())
    );
    windows.push({
      since: windowStart.toISOString(),
      until: windowEnd.toISOString(),
    });
    windowStart = windowEnd;
  }

  return windows.length > 0
    ? windows
    : [{ since: start.toISOString(), until: end.toISOString() }];
}

export function useTaskDurations(
  dateRange: DateRange,
  selectedProjectIds: string[],
  enabled = true
): UseTaskDurationsResult {
  const [tasks, setTasks] = useState<DurationTask[]>([]);
  const [noDurationTasks, setNoDurationTasks] = useState<NoDurationTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const startIso = dateRange.start?.toISOString() ?? '';
  const endIso = dateRange.end?.toISOString() ?? '';
  const preset = dateRange.preset;
  const projectKey = selectedProjectIds.join(',');

  useEffect(() => {
    if (!enabled) {
      setTasks([]);
      setNoDurationTasks([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    async function fetchDurations() {
      setIsLoading(true);
      setError(null);

      try {
        const now = new Date();
        const start = startIso ? new Date(startIso) : subDays(now, 90);
        const end = endIso ? new Date(endIso) : now;
        const windows = getDateWindows(start, end);
        const allTasks: DurationTask[] = [];
        const allNoDuration: NoDurationTask[] = [];

        for (const window of windows) {
          if (signal.aborted) return;

          const params = new URLSearchParams({
            since: window.since,
            until: window.until,
          });
          if (process.env.NODE_ENV === 'development') {
            params.set('debugDuration', '1');
          }

          const resp = await fetch(
            `/api/getCompletedWithDuration?${params}`,
            {
              signal,
              cache: 'no-store',
            }
          );

          if (!resp.ok) {
            throw new Error(`Failed to fetch duration data: ${resp.status}`);
          }

          const data = await resp.json();
          if (Array.isArray(data.tasks)) {
            for (const task of data.tasks) {
              allTasks.push({
                id: task.id,
                addedAt: task.added_at ?? '',
                content: task.content,
                projectId: task.project_id,
                completedAt: task.completed_at,
                taskId: task.task_id ?? task.id,
                v2TaskId: task.v2_task_id ?? task.task_id ?? task.id,
                duration: task.duration,
                labels: task.labels ?? [],
              });
            }
          }
          if (Array.isArray(data.noDurationTasks)) {
            for (const task of data.noDurationTasks) {
              allNoDuration.push({
                id: task.id,
                addedAt: task.added_at ?? '',
                content: task.content,
                projectId: task.project_id,
                completedAt: task.completed_at,
                taskId: task.task_id ?? task.id,
                v2TaskId: task.v2_task_id ?? task.task_id ?? task.id,
                labels: task.labels ?? [],
              });
            }
          }
        }

        if (signal.aborted) return;

        const projectIds = projectKey ? projectKey.split(',') : [];
        if (projectIds.length > 0) {
          setTasks(allTasks.filter(t => projectIds.includes(t.projectId)));
          setNoDurationTasks(allNoDuration.filter(t => projectIds.includes(t.projectId)));
        } else {
          setTasks(allTasks);
          setNoDurationTasks(allNoDuration);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!signal.aborted) {
          setError(err instanceof Error ? err.message : 'Failed to load duration data');
        }
      } finally {
        if (!signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    fetchDurations();
    return () => controller.abort();
  }, [enabled, startIso, endIso, preset, projectKey]);

  return { tasks, noDurationTasks, isLoading, error };
}
