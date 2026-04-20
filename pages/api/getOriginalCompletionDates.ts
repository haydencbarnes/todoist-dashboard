import { getToken } from 'next-auth/jwt';
import type { NextApiRequest, NextApiResponse } from 'next';
import { fetchWithRetry } from '../../utils/fetchWithRetry';
import {
  getCompletionHistoryIds,
  getCompletionHistoryKey,
  type CompletionHistoryTaskRef,
} from '../../utils/completionHistory';

type ApiRecord = Record<string, unknown>;

interface SuccessResponse {
  originalCompletions: CompletionHistoryTaskRef[];
}

interface ErrorResponse {
  error: string;
}

interface NormalizedTaskRef extends CompletionHistoryTaskRef {
  historyKey: string;
  lookupIds: string[];
  addedAtMs: number;
  completedAtMs: number;
}

const PAGE_LIMIT = 100;
const PAGE_DELAY_MS = 50;
const MAX_ACTIVITY_PAGES = 250;
const COMPLETION_EVENT_SKEW_MS = 5 * 60 * 1000;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

function asObjectOrNull(value: unknown): ApiRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as ApiRecord
    : null;
}

function getStringValue(source: ApiRecord, ...keys: string[]): string {
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

function uniqueNonEmpty(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function getStringArrayValue(source: ApiRecord, ...keys: string[]): string[] {
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) {
      return value
        .map((entry) => {
          if (typeof entry === 'string') {
            return entry;
          }
          if (typeof entry === 'number' || typeof entry === 'bigint') {
            return String(entry);
          }
          return '';
        })
        .filter(Boolean);
    }
  }

  return [];
}

function parseTaskRef(value: unknown): NormalizedTaskRef | null {
  const source = asObjectOrNull(value);
  if (!source) {
    return null;
  }

  const id = getStringValue(source, 'id');
  const taskId = getStringValue(source, 'taskId', 'task_id');
  const v2TaskId = getStringValue(source, 'v2TaskId', 'v2_task_id');
  const addedAt = getStringValue(source, 'addedAt', 'added_at', 'completedAt', 'completed_at');
  const completedAt = getStringValue(source, 'completedAt', 'completed_at');
  const historyKey = getCompletionHistoryKey({ id, taskId, v2TaskId });
  const providedLookupIds = getStringArrayValue(source, 'lookupIds', 'lookup_ids');
  const lookupIds = uniqueNonEmpty([
    ...providedLookupIds,
    ...getCompletionHistoryIds({ id, taskId, v2TaskId }),
  ]);
  const addedAtMs = Date.parse(addedAt);
  const completedAtMs = Date.parse(completedAt);

  if (!historyKey || !lookupIds.length || Number.isNaN(completedAtMs)) {
    return null;
  }

  return {
    id,
    taskId,
    v2TaskId,
    addedAt,
    completedAt,
    historyKey,
    lookupIds,
    addedAtMs: Number.isNaN(addedAtMs) ? completedAtMs : addedAtMs,
    completedAtMs,
  };
}

function isCompletionEvent(event: ApiRecord): boolean {
  const type = getStringValue(event, 'event_type', 'eventType').toLowerCase();

  if (type === 'completed' || type === 'item:completed' || type === 'item_completed') {
    return true;
  }

  if (type === 'updated' || type === 'item:updated' || type === 'item_updated') {
    const extraData =
      asObjectOrNull(event.event_data_extra) ??
      asObjectOrNull(event.eventDataExtra) ??
      asObjectOrNull(event.extra_data) ??
      asObjectOrNull(event.extraData);

    if (!extraData) {
      return false;
    }

    const intent = getStringValue(extraData, 'update_intent', 'updateIntent').toLowerCase();
    return intent === 'completed' || intent === 'item_completed';
  }

  return false;
}

function extractEventDate(event: ApiRecord): string {
  return getStringValue(event, 'event_date', 'eventDate', 'timestamp');
}

function extractEventIds(event: ApiRecord): string[] {
  const ids: string[] = [];
  const seen = new Set<unknown>();
  const targetKeys = new Set([
    'id',
    'object_id',
    'objectId',
    'v2_object_id',
    'v2ObjectId',
    'item_id',
    'itemId',
    'v2_item_id',
    'v2ItemId',
    'task_id',
    'taskId',
    'v2_task_id',
    'v2TaskId',
  ]);

  const visit = (value: unknown) => {
    if (value === null || value === undefined) {
      return;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') {
      return;
    }

    if (seen.has(value)) {
      return;
    }
    seen.add(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }
      return;
    }

    if (typeof value !== 'object') {
      return;
    }

    for (const [key, child] of Object.entries(value)) {
      if (targetKeys.has(key)) {
        if (typeof child === 'string') {
          ids.push(child);
        } else if (typeof child === 'number' || typeof child === 'bigint') {
          ids.push(String(child));
        }
      }

      visit(child);
    }
  };

  visit(event);

  return uniqueNonEmpty(ids);
}

async function fetchActivityLogEvents(
  accessToken: string,
  since: string,
  until: string
): Promise<ApiRecord[]> {
  const events: ApiRecord[] = [];
  let cursor: string | null = null;
  let pageCount = 0;
  const sinceMs = Date.parse(since);

  do {
    const params = new URLSearchParams({
      object_type: 'item',
      since,
      until,
      limit: String(PAGE_LIMIT),
    });
    if (cursor) {
      params.set('cursor', cursor);
    }

    const resp = await fetchWithRetry(
      `https://api.todoist.com/api/v1/activities?${params}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        maxRetries: 3,
      }
    );

    if (!resp.ok) {
      const text = await resp.text().catch(() => 'Unknown error');
      throw new Error(`Todoist activities error: ${resp.status} ${text}`);
    }

    const data = await resp.json();
    const pageEvents = Array.isArray(data.results)
      ? data.results
      : Array.isArray(data.events)
        ? data.events
        : [];

    for (const event of pageEvents) {
      const record = asObjectOrNull(event);
      if (record) {
        events.push(record);
      }
    }

    cursor = typeof data.next_cursor === 'string' && data.next_cursor ? data.next_cursor : null;
    pageCount++;

    let oldestEventTime: number | null = null;
    for (const event of pageEvents) {
      const record = asObjectOrNull(event);
      if (!record) continue;

      const eventTime = Date.parse(extractEventDate(record));
      if (Number.isNaN(eventTime)) continue;

      if (oldestEventTime === null || eventTime < oldestEventTime) {
        oldestEventTime = eventTime;
      }
    }

    if (!cursor || pageCount >= MAX_ACTIVITY_PAGES) {
      break;
    }

    if (!Number.isNaN(sinceMs) && oldestEventTime !== null && oldestEventTime < sinceMs) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, PAGE_DELAY_MS));
  } while (true);

  return events;
}

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    response.setHeader('Cache-Control', 'no-store, max-age=0');

    const token = await getToken({ req: request });
    if (!token?.accessToken) {
      return response.status(401).json({ error: 'Not authenticated' });
    }

    const body = asObjectOrNull(request.body);
    const rawTasks = Array.isArray(body?.tasks) ? body.tasks : [];
    const bodySince = body ? getStringValue(body, 'since') : '';
    const bodyUntil = body ? getStringValue(body, 'until') : '';
    const tasks = rawTasks.map(parseTaskRef).filter((task): task is NormalizedTaskRef => Boolean(task));

    if (tasks.length === 0) {
      return response.status(200).json({ originalCompletions: [] });
    }

    const earliestAddedAtMs = Math.min(...tasks.map((task) => task.addedAtMs));
    const latestCompletedAtMs = Math.max(...tasks.map((task) => task.completedAtMs));
    const since = !Number.isNaN(Date.parse(bodySince))
      ? new Date(bodySince).toISOString()
      : new Date(earliestAddedAtMs).toISOString();
    const until = !Number.isNaN(Date.parse(bodyUntil))
      ? new Date(bodyUntil).toISOString()
      : new Date(latestCompletedAtMs).toISOString();

    const tasksByLookupId = new Map<string, NormalizedTaskRef[]>();
    for (const task of tasks) {
      for (const lookupId of task.lookupIds) {
        const existing = tasksByLookupId.get(lookupId) ?? [];
        existing.push(task);
        tasksByLookupId.set(lookupId, existing);
      }
    }

    const events = await fetchActivityLogEvents(token.accessToken as string, since, until);

    const earliestCompletionByTask = new Map<string, string>();

    for (const event of events) {
      if (!isCompletionEvent(event)) {
        continue;
      }

      const eventDate = extractEventDate(event);
      const eventTime = Date.parse(eventDate);
      if (Number.isNaN(eventTime)) {
        continue;
      }

      const matchedTasks = new Map<string, NormalizedTaskRef>();
      for (const lookupId of extractEventIds(event)) {
        for (const task of tasksByLookupId.get(lookupId) ?? []) {
          matchedTasks.set(task.historyKey, task);
        }
      }

      for (const task of Array.from(matchedTasks.values())) {
        if (
          eventTime < task.addedAtMs - COMPLETION_EVENT_SKEW_MS ||
          eventTime > task.completedAtMs + COMPLETION_EVENT_SKEW_MS
        ) {
          continue;
        }

        const existing = earliestCompletionByTask.get(task.historyKey);
        if (!existing || eventTime < Date.parse(existing)) {
          earliestCompletionByTask.set(task.historyKey, eventDate);
        }
      }
    }

    const originalCompletions = tasks
      .map((task) => {
        const originalCompletedAt = earliestCompletionByTask.get(task.historyKey);
        if (!originalCompletedAt) {
          return null;
        }

        return {
          id: task.id,
          taskId: task.taskId,
          v2TaskId: task.v2TaskId,
          addedAt: task.addedAt,
          completedAt: originalCompletedAt,
        };
      })
      .filter((task): task is CompletionHistoryTaskRef => Boolean(task));

    return response.status(200).json({ originalCompletions });
  } catch (error) {
    console.error('Error in getOriginalCompletionDates:', error);
    return response.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
