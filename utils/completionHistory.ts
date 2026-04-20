import type { CompletedTask } from '@/types';

export interface CompletionHistoryTaskRef {
  id: string;
  taskId: string;
  v2TaskId: string;
  addedAt: string;
  completedAt: string;
  lookupIds?: string[];
}

interface CompletionHistoryIdentity {
  id?: string;
  taskId?: string;
  v2TaskId?: string;
  task_id?: string;
  v2_task_id?: string;
  lookupIds?: string[];
  item_object?: Record<string, unknown> | null;
  itemObject?: Record<string, unknown> | null;
  meta_data?: Record<string, unknown> | null;
  metaData?: Record<string, unknown> | null;
}

function uniqueNonEmpty(values: Array<string | undefined | null>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
    )
  );
}

function getNestedCompletionHistoryIds(value: unknown): string[] {
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

  const visit = (current: unknown) => {
    if (!current || typeof current !== 'object') {
      return;
    }
    if (seen.has(current)) {
      return;
    }
    seen.add(current);

    if (Array.isArray(current)) {
      for (const item of current) {
        visit(item);
      }
      return;
    }

    for (const [key, child] of Object.entries(current)) {
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

  visit(value);
  return ids;
}

export function getCompletionHistoryIds(task: CompletionHistoryIdentity): string[] {
  return uniqueNonEmpty([
    task.taskId,
    task.task_id,
    task.v2TaskId,
    task.v2_task_id,
    task.id,
    ...(task.lookupIds ?? []),
    ...getNestedCompletionHistoryIds(task.item_object),
    ...getNestedCompletionHistoryIds(task.itemObject),
    ...getNestedCompletionHistoryIds(task.meta_data),
    ...getNestedCompletionHistoryIds(task.metaData),
  ]);
}

export function getCompletionHistoryKey(task: CompletionHistoryIdentity): string {
  return getCompletionHistoryIds(task).join('|');
}

export function getEffectiveCompletedAt(task: Pick<CompletedTask, 'completed_at'> & {
  effective_completed_at?: string;
}): string {
  return task.effective_completed_at || task.completed_at;
}

export function applyOriginalCompletionDates(
  tasks: CompletedTask[],
  originalCompletions: CompletionHistoryTaskRef[]
): CompletedTask[] {
  const originalCompletionDates = new Map<string, string>();

  for (const completion of originalCompletions) {
    const taskKey = getCompletionHistoryKey(completion);
    if (taskKey && completion.completedAt) {
      originalCompletionDates.set(taskKey, completion.completedAt);
    }
  }

  return tasks.map((task) => {
    const taskKey = getCompletionHistoryKey(task);
    const originalCompletedAt = originalCompletionDates.get(taskKey) ?? null;

    return {
      ...task,
      effective_completed_at: originalCompletedAt ?? task.completed_at,
      original_completed_at: originalCompletedAt,
    };
  });
}

export function toCompletionHistoryTaskRef(task: CompletedTask): CompletionHistoryTaskRef {
  return {
    id: task.id,
    taskId: task.task_id,
    v2TaskId: task.v2_task_id,
    addedAt: task.added_at || task.completed_at,
    completedAt: task.completed_at,
    lookupIds: getCompletionHistoryIds(task),
  };
}
