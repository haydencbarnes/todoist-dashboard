import { TodoistApi } from "@doist/todoist-api-typescript";
import type { Task as SdkTask, PersonalProject, WorkspaceProject } from "@doist/todoist-api-typescript";
import { getToken } from 'next-auth/jwt';
import { MAX_TASKS, INITIAL_BATCH_SIZE } from "../../utils/constants";
import type { NextApiRequest, NextApiResponse } from 'next';
import { fetchWithRetry } from '../../utils/fetchWithRetry';
import path from 'path';
import { promises as fs } from 'fs';
import type {
  CompletedTask,
  LoadMoreResponse,
  ErrorResponse,
  DashboardData,
  ActiveTask,
  ProjectData,
  TodoistTaskDuration
} from '../../types';

// Toggle dummy data testing via env flag to avoid bundling local fixtures in prod
const USE_DUMMY_DATA = process.env.USE_DUMMY_DATA === 'true';

interface ApiResponse extends Omit<DashboardData, 'projectData'> {
  projectData: ProjectData[];
}

// Custom error classes for better error handling
class TodoistAPIError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'TodoistAPIError';
  }
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

type ApiTaskRecord = Record<string, unknown>;

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

function getNumberValue(source: ApiTaskRecord, ...keys: string[]): number {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  return 0;
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
    const duration = value as { amount?: unknown; unit?: unknown };
    const amount = parsePositiveNumber(duration.amount);
    const unit = normalizeDurationUnit(duration.unit);

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

function extractTaskDuration(
  source: ApiTaskRecord,
  itemObject: Record<string, unknown> | null,
  metaData: Record<string, unknown> | null
): TodoistTaskDuration | null {
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

async function loadDummyDataset(): Promise<ApiResponse> {
  const datasetPath = path.join(process.cwd(), 'test/data/fake-dataset.json');

  try {
    const fileContents = await fs.readFile(datasetPath, 'utf-8');
    return JSON.parse(fileContents) as ApiResponse;
  } catch (error) {
    console.error('Failed to load dummy dataset at', datasetPath, error);
    throw new Error('Fake dataset not found. Create test/data/fake-dataset.json or disable USE_DUMMY_DATA.');
  }
}

// Map Todoist API v1 Task to our ActiveTask type
const mapToActiveTask = (task: SdkTask): ActiveTask => {
  const taskWithDuration = task as SdkTask & { duration?: TodoistTaskDuration | null };

  return {
    assigneeId: task.responsibleUid || null,
    assignerId: task.assignedByUid || null,
    commentCount: task.noteCount,
    content: task.content,
    createdAt: task.addedAt || '',
    creatorId: task.userId,
    description: task.description,
    duration: normalizeTaskDuration(taskWithDuration.duration),
    due: task.due ? {
      isRecurring: task.due.isRecurring,
      string: task.due.string,
      date: task.due.date,
      datetime: task.due.datetime ?? null,
      timezone: task.due.timezone ?? null,
    } : null,
    id: task.id,
    isCompleted: task.checked,
    labels: task.labels,
    order: task.childOrder,
    parentId: task.parentId || null,
    priority: task.priority,
    projectId: task.projectId,
    sectionId: task.sectionId || null,
    url: task.url,
    deadline: task.deadline?.date || null,
  };
};

// Map Todoist API v1 Project to our ProjectData type
const mapToProjectData = (project: PersonalProject | WorkspaceProject): ProjectData => ({
  id: project.id,
  name: project.name,
  color: project.color,
  parentId: 'parentId' in project ? project.parentId || null : null,
  order: project.childOrder,
  isFavorite: project.isFavorite,
  isShared: project.isShared,
  viewStyle: project.viewStyle,
  url: project.url,
});

async function fetchCompletedTasksBatch(
  token: string,
  offset: number,
  limit: number
): Promise<CompletedTask[]> {
  // Input validation
  if (!Number.isInteger(offset) || offset < 0) {
    throw new ValidationError('Invalid offset: must be a non-negative integer');
  }
  if (limit <= 0) {
    throw new ValidationError('Invalid limit: must be a positive integer');
  }

  const params = new URLSearchParams({
    limit: String(Math.min(limit, 50)),
    offset: String(offset),
  });

  const response = await fetchWithRetry(
    `https://api.todoist.com/api/v1/tasks/completed?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      maxRetries: 3
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'No error details available');
    throw new TodoistAPIError(
      response.status,
      `Failed to fetch completed tasks batch: ${response.status} ${response.statusText}. ${errorText}`
    );
  }

  const data = await response.json();
  const tasks = data.tasks ?? data.items;
  if (!Array.isArray(tasks)) {
    throw new Error('Invalid response: tasks is not an array');
  }

  // Map v1 API response to CompletedTask format for compatibility
  // The v1 API uses camelCase (completedAt, projectId) but we map to the legacy snake_case format
  return tasks.map((task: ApiTaskRecord): CompletedTask => {
    const itemObject = asObjectOrNull(task.item_object) ?? asObjectOrNull(task.itemObject);
    const metaData = asObjectOrNull(task.meta_data) ?? asObjectOrNull(task.metaData);

    return {
      added_at: getStringValue(task, 'added_at', 'addedAt'),
      completed_at: getStringValue(task, 'completed_at', 'completedAt'),
      content: getStringValue(task, 'content'),
      duration: extractTaskDuration(task, itemObject, metaData),
      effective_completed_at: getStringValue(task, 'completed_at', 'completedAt'),
      id: getStringValue(task, 'id'),
      item_object: itemObject,
      meta_data: metaData,
      note_count: getNumberValue(task, 'note_count', 'noteCount'),
      notes: Array.isArray(task.notes) ? task.notes : [],
      original_completed_at: null,
      project_id: getStringValue(task, 'project_id', 'projectId'),
      section_id: getStringValue(task, 'section_id', 'sectionId'),
      task_id: getStringValue(task, 'task_id', 'taskId', 'id'),
      user_id: getStringValue(task, 'user_id', 'userId'),
      v2_project_id: getStringValue(task, 'v2_project_id', 'v2ProjectId', 'project_id', 'projectId'),
      v2_section_id: getStringValue(task, 'v2_section_id', 'v2SectionId', 'section_id', 'sectionId'),
      v2_task_id: getStringValue(task, 'v2_task_id', 'v2TaskId', 'task_id', 'taskId', 'id'),
    };
  });
}

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse<ApiResponse | LoadMoreResponse | ErrorResponse>
) {
  try {
    // If using dummy data, return it immediately
    if (USE_DUMMY_DATA) {
      const dummyDataset = await loadDummyDataset();

      // Handle "load more" requests (dummy data is already fully loaded)
      if (request.query.loadMore === 'true') {
        return response.status(200).json({
          newTasks: [],
          hasMoreTasks: false,
          totalTasks: dummyDataset.totalCompletedTasks,
          loadedTasks: dummyDataset.totalCompletedTasks
        });
      }

      // Return dummy dataset
      return response.status(200).json(dummyDataset as unknown as ApiResponse);
    }

    const token = await getToken({ req: request });
    if (!token?.accessToken) {
      return response.status(401).json({ error: "Not authenticated" });
    }

    const accessToken = token.accessToken as string;
    const api = new TodoistApi(accessToken);

    // Handle "load more" requests
    if (request.query.loadMore === 'true') {
      const offset = parseInt(request.query.offset as string) || 0;
      const total = parseInt(request.query.total as string) || 0;

      try {
        const newTasks = await fetchCompletedTasksBatch(accessToken, offset, INITIAL_BATCH_SIZE);
        return response.status(200).json({
          newTasks,
          hasMoreTasks: offset + newTasks.length < total && offset + newTasks.length < MAX_TASKS,
          totalTasks: total,
          loadedTasks: offset + newTasks.length
        });
      } catch (error) {
        console.error('Error loading more tasks:', error);
        return response.status(500).json({ error: 'Failed to load more tasks' });
      }
    }

    // Fetch all data in parallel using the SDK + manual completed tasks fetch
    const [currentUser, productivityStats, projectsResponse, tasksResponse, labelsResponse, initialTasks] = await Promise.all([
      api.getUser(),
      api.getProductivityStats(),
      api.getProjects(),
      api.getTasks(),
      api.getLabels(),
      fetchCompletedTasksBatch(accessToken, 0, INITIAL_BATCH_SIZE),
    ]);

    const totalCount = productivityStats.completedCount;

    // Map SDK types to our internal format
    const projectData = projectsResponse.results.map(mapToProjectData);
    const activeTasks = tasksResponse.results.map(mapToActiveTask);

    const responseData: ApiResponse = {
      allCompletedTasks: initialTasks,
      projectData,
      activeTasks,
      labels: labelsResponse.results.map(l => ({
        id: l.id,
        name: l.name,
        color: l.color,
        order: l.order ?? 0,
        isFavorite: l.isFavorite,
      })),
      totalCompletedTasks: totalCount,
      hasMoreTasks: initialTasks.length < Math.min(totalCount, MAX_TASKS),
      karma: currentUser.karma,
      karmaRising: currentUser.karmaTrend === 'up',
      karmaTrend: currentUser.karmaTrend as 'up' | 'down' | 'none',
      dailyGoal: currentUser.dailyGoal,
      weeklyGoal: currentUser.weeklyGoal,
    };

    response.status(200).json(responseData);
  } catch (error) {
    console.error('Error in getTasks API:', error);
    if (error instanceof TodoistAPIError) {
      return response.status(error.statusCode).json({
        error: error.message,
        details: 'Todoist API error'
      });
    }
    if (error instanceof ValidationError) {
      return response.status(400).json({
        error: error.message,
        details: 'Validation error'
      });
    }
    response.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
