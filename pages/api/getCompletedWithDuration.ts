import { getToken } from 'next-auth/jwt';
import type { NextApiRequest, NextApiResponse } from 'next';
import { fetchWithRetry } from '../../utils/fetchWithRetry';
import type { TodoistTaskDuration } from '../../types';

interface DurationTaskItem {
  id: string;
  content: string;
  project_id: string;
  completed_at: string;
  duration: TodoistTaskDuration;
  labels: string[];
}

interface NoDurationTaskItem {
  id: string;
  content: string;
  project_id: string;
  completed_at: string;
  labels: string[];
}

interface SuccessResponse {
  tasks: DurationTaskItem[];
  noDurationTasks: NoDurationTaskItem[];
}

interface ErrorResponse {
  error: string;
}

const MAX_PAGES = 50;
const PAGE_LIMIT = 200;
const PAGE_DELAY_MS = 50;

function parseDuration(value: unknown): TodoistTaskDuration | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const d = value as { amount?: unknown; unit?: unknown };
  if (
    typeof d.amount === 'number' &&
    Number.isFinite(d.amount) &&
    d.amount > 0 &&
    (d.unit === 'minute' || d.unit === 'day')
  ) {
    return { amount: d.amount, unit: d.unit };
  }
  return null;
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
        const item = raw as Record<string, unknown>;
        const duration = parseDuration(item.duration);
        const base = {
          id: String(item.id ?? ''),
          content: String(item.content ?? ''),
          project_id: String(item.project_id ?? ''),
          completed_at: String(item.completed_at ?? ''),
          labels: Array.isArray(item.labels) ? item.labels.map(String) : [],
        };

        if (duration) {
          tasks.push({ ...base, duration });
        } else {
          noDurationTasks.push(base);
        }
      }

      cursor = typeof data.next_cursor === 'string' && data.next_cursor ? data.next_cursor : null;
      pageCount++;

      if (cursor && pageCount < MAX_PAGES) {
        await new Promise(r => setTimeout(r, PAGE_DELAY_MS));
      }
    } while (cursor && pageCount < MAX_PAGES);

    response.status(200).json({ tasks, noDurationTasks });
  } catch (error) {
    console.error('Error in getCompletedWithDuration:', error);
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
