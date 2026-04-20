import { getToken } from 'next-auth/jwt';
import type { NextApiRequest, NextApiResponse } from 'next';
import { fetchWithRetry } from '../../utils/fetchWithRetry';
import type { TodoistTaskDuration } from '../../types';

type ApiTaskRecord = Record<string, unknown>;

interface DurationTaskItem {
  id: string;
  added_at: string;
  content: string;
  project_id: string;
  completed_at: string;
  task_id: string;
  v2_task_id: string;
  duration: TodoistTaskDuration;
  labels: string[];
}

interface NoDurationTaskItem {
  id: string;
  added_at: string;
  content: string;
  project_id: string;
  completed_at: string;
  task_id: string;
  v2_task_id: string;
  labels: string[];
}

interface SuccessResponse {
  tasks: DurationTaskItem[];
  noDurationTasks: NoDurationTaskItem[];
}

interface ErrorResponse {
  error: string;
}

interface DurationDebugEntry {
  id: string;
  task_id: string;
  v2_task_id: string;
  content: string;
  completed_at: string;
  duration: unknown;
  duration_unit: unknown;
  item_object_duration: unknown;
  item_object_duration_unit: unknown;
  meta_data_duration: unknown;
  meta_data_duration_unit: unknown;
}

const MAX_PAGES = 50;
const PAGE_LIMIT = 200;
const PAGE_DELAY_MS = 50;

function asObjectOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function getStringValue(source: ApiTaskRecord, ...keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'bigint') {
      return String(value);
    }
  }

  return '';
}

function getStringArrayValue(source: ApiTaskRecord, ...keys: string[]): string[] {
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) {
      return value.map(String);
    }
  }

  return [];
}

function parsePositiveNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function normalizeDurationUnit(value: unknown): 'minute' | 'day' | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'minute' || normalized === 'minutes') {
    return 'minute';
  }
  if (normalized === 'day' || normalized === 'days') {
    return 'day';
  }

  return null;
}

function normalizeTaskDuration(value: unknown, unitHint?: unknown): TodoistTaskDuration | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const d = value as { amount?: unknown; unit?: unknown };
    const amount = parsePositiveNumber(d.amount);
    const unit = normalizeDurationUnit(d.unit);

    if (amount && unit) {
      return { amount, unit };
    }
  }

  const amount = parsePositiveNumber(value);
  const unit = normalizeDurationUnit(unitHint);
  if (amount && unit) {
    return { amount, unit };
  }

  return null;
}

function extractDurationFromContainer(container: Record<string, unknown> | null): TodoistTaskDuration | null {
  if (!container) {
    return null;
  }

  return normalizeTaskDuration(
    container.duration,
    container.duration_unit ?? container.durationUnit
  );
}

function extractTaskDuration(source: ApiTaskRecord): TodoistTaskDuration | null {
  const itemObject = asObjectOrNull(source.item_object) ?? asObjectOrNull(source.itemObject);
  const metaData = asObjectOrNull(source.meta_data) ?? asObjectOrNull(source.metaData);
  const containers: Array<Record<string, unknown> | null> = [source, itemObject, metaData];

  for (const container of [itemObject, metaData]) {
    if (!container) continue;

    containers.push(
      asObjectOrNull(container.task),
      asObjectOrNull(container.item),
      asObjectOrNull(container.item_object) ?? asObjectOrNull(container.itemObject)
    );
  }

  for (const container of containers) {
    const duration = extractDurationFromContainer(container);
    if (duration) {
      return duration;
    }
  }

  return null;
}

function extractTaskLabels(source: ApiTaskRecord): string[] {
  const topLevelLabels = getStringArrayValue(source, 'labels');
  if (topLevelLabels.length > 0) {
    return topLevelLabels;
  }

  const itemObject = asObjectOrNull(source.item_object) ?? asObjectOrNull(source.itemObject);
  const metaData = asObjectOrNull(source.meta_data) ?? asObjectOrNull(source.metaData);

  for (const container of [itemObject, metaData]) {
    if (!container) continue;

    const containerLabels = getStringArrayValue(container, 'labels');
    if (containerLabels.length > 0) {
      return containerLabels;
    }

    const nestedTask = asObjectOrNull(container.task);
    if (nestedTask) {
      const nestedTaskLabels = getStringArrayValue(nestedTask, 'labels');
      if (nestedTaskLabels.length > 0) {
        return nestedTaskLabels;
      }
    }

    const nestedItem = asObjectOrNull(container.item);
    if (nestedItem) {
      const nestedItemLabels = getStringArrayValue(nestedItem, 'labels');
      if (nestedItemLabels.length > 0) {
        return nestedItemLabels;
      }
    }

    const nestedObject = asObjectOrNull(container.item_object) ?? asObjectOrNull(container.itemObject);
    if (nestedObject) {
      const nestedObjectLabels = getStringArrayValue(nestedObject, 'labels');
      if (nestedObjectLabels.length > 0) {
        return nestedObjectLabels;
      }
    }
  }

  return [];
}

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  try {
    response.setHeader('Cache-Control', 'no-store, max-age=0');

    const token = await getToken({ req: request });
    if (!token?.accessToken) {
      return response.status(401).json({ error: 'Not authenticated' });
    }

    const since = request.query.since as string;
    const until = request.query.until as string;

    if (!since || !until) {
      return response.status(400).json({ error: 'since and until query params are required' });
    }
    if (isNaN(Date.parse(since)) || isNaN(Date.parse(until))) {
      return response.status(400).json({ error: 'Invalid date format' });
    }

    const accessToken = token.accessToken as string;
    const tasks: DurationTaskItem[] = [];
    const noDurationTasks: NoDurationTaskItem[] = [];
    const debugEntries: DurationDebugEntry[] = [];
    let cursor: string | null = null;
    let pageCount = 0;

    do {
      const params = new URLSearchParams({
        since,
        until,
        limit: String(PAGE_LIMIT),
      });
      if (cursor) params.set('cursor', cursor);

      const resp = await fetchWithRetry(
        `https://api.todoist.com/api/v1/tasks/completed/by_completion_date?${params}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          maxRetries: 3,
        }
      );

      if (!resp.ok) {
        const text = await resp.text().catch(() => 'Unknown error');
        console.error('Todoist by_completion_date error:', resp.status, text);
        return response.status(resp.status).json({ error: text });
      }

      const data = await resp.json();
      const items: unknown[] = data.items ?? [];

      for (const raw of items) {
        if (!raw || typeof raw !== 'object') continue;
        const item = raw as ApiTaskRecord;
        const itemObject = asObjectOrNull(item.item_object) ?? asObjectOrNull(item.itemObject);
        const metaData = asObjectOrNull(item.meta_data) ?? asObjectOrNull(item.metaData);
        const duration = extractTaskDuration(item);
        const base = {
          id: getStringValue(item, 'id'),
          added_at: getStringValue(item, 'added_at', 'addedAt'),
          content: getStringValue(item, 'content'),
          project_id: getStringValue(item, 'project_id', 'projectId'),
          completed_at: getStringValue(item, 'completed_at', 'completedAt'),
          task_id: getStringValue(item, 'task_id', 'taskId', 'id'),
          v2_task_id: getStringValue(item, 'v2_task_id', 'v2TaskId', 'task_id', 'taskId', 'id'),
          labels: extractTaskLabels(item),
        };

        if (duration) {
          tasks.push({ ...base, duration });
        } else {
          if (request.query.debugDuration === '1') {
            debugEntries.push({
              id: base.id,
              task_id: base.task_id,
              v2_task_id: base.v2_task_id,
              content: base.content,
              completed_at: base.completed_at,
              duration: item.duration,
              duration_unit: item.duration_unit ?? item.durationUnit,
              item_object_duration: itemObject?.duration,
              item_object_duration_unit: itemObject?.duration_unit ?? itemObject?.durationUnit,
              meta_data_duration: metaData?.duration,
              meta_data_duration_unit: metaData?.duration_unit ?? metaData?.durationUnit,
            });
          }
          noDurationTasks.push(base);
        }
      }

      cursor = typeof data.next_cursor === 'string' && data.next_cursor ? data.next_cursor : null;
      pageCount++;

      if (cursor && pageCount < MAX_PAGES) {
        await new Promise(r => setTimeout(r, PAGE_DELAY_MS));
      }
    } while (cursor && pageCount < MAX_PAGES);

    if (request.query.debugDuration === '1') {
      console.info('getCompletedWithDuration debug', {
        since,
        until,
        tasksWithDuration: tasks.length,
        tasksWithoutDuration: noDurationTasks.length,
        taskSamples: tasks.slice(0, 25).map((task) => ({
          task_id: task.task_id,
          completed_at: task.completed_at,
          content: task.content,
          duration: task.duration,
          labels: task.labels,
        })),
        missingSamples: debugEntries.slice(0, 20),
      });
    }

    response.status(200).json({ tasks, noDurationTasks });
  } catch (error) {
    console.error('Error in getCompletedWithDuration:', error);
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
