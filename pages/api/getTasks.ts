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
  ProjectData
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
const mapToActiveTask = (task: SdkTask): ActiveTask => ({
  assigneeId: task.responsibleUid || null,
  assignerId: task.assignedByUid || null,
  commentCount: task.noteCount,
  content: task.content,
  createdAt: task.addedAt || '',
  creatorId: task.userId,
  description: task.description,
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
});

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
  return tasks.map((task: Record<string, string>): CompletedTask => ({
    completed_at: task.completed_at ?? task.completedAt ?? '',
    content: task.content ?? '',
    id: task.id ?? '',
    item_object: null,
    meta_data: null,
    note_count: 0,
    notes: [],
    project_id: task.project_id ?? task.projectId ?? '',
    section_id: task.section_id ?? task.sectionId ?? '',
    task_id: task.task_id ?? task.id ?? '',
    user_id: task.user_id ?? task.userId ?? '',
    v2_project_id: task.project_id ?? task.projectId ?? '',
    v2_section_id: task.section_id ?? task.sectionId ?? '',
    v2_task_id: task.task_id ?? task.id ?? '',
  }));
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
