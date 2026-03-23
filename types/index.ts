import { Session } from "next-auth/core/types";

// API Response Types - These match the actual API responses
export type CompletedTask = {
  completed_at: string;
  content: string;
  id: string;
  item_object: any | null;
  meta_data: any | null;
  note_count: number;
  notes: any[];
  project_id: string;
  section_id: string;
  task_id: string;
  user_id: string;
  v2_project_id: string;
  v2_section_id: string;
  v2_task_id: string;
};

// Active task type used throughout the dashboard
export type ActiveTask = {
  assigneeId?: string | null;
  assignerId?: string | null;
  commentCount: number;
  content: string;
  createdAt: string;
  creatorId: string;
  description: string;
  due?: {
    isRecurring: boolean;
    string: string;
    date: string;
    datetime?: string | null;
    timezone?: string | null;
  } | null;
  id: string;
  isCompleted: boolean;
  labels: string[];
  order: number;
  parentId?: string | null;
  priority: number;
  projectId: string;
  sectionId?: string | null;
  url: string;
  deadline?: string | null;
};

// Project data used throughout the dashboard
export interface ProjectData {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
  order: number;
  isFavorite: boolean;
  isShared: boolean;
  viewStyle: string;
  url: string;
}

export interface DashboardData {
  activeTasks: ActiveTask[];
  allCompletedTasks: CompletedTask[];
  hasMoreTasks: boolean;
  karma: number;
  karmaRising: boolean;
  karmaTrend: 'up' | 'down' | 'none';
  dailyGoal: number;
  weeklyGoal: number;
  projectData: ProjectData[];
  labels: Label[];
  totalCompletedTasks: number;
  loadError?: {
    message: string;
    type: 'partial' | 'full';
    timestamp: number;
  };
}

export interface LoadingProgress {
  loaded: number;
  total: number;
}

export interface TodoistStats {
  completed_count: number;
  completed_today: number;
  completed_items: number[];
  karma: number;
  karma_trend: string;
  daily_goal: number;
  daily_goal_reached: boolean;
  weekly_goal: number;
  weekly_goal_reached: boolean;
}

export interface TodoistUserData {
  user: {
    karma: number;
    karma_trend: string;
  };
}

export interface LoadMoreResponse {
  newTasks: CompletedTask[];
  hasMoreTasks: boolean;
  totalTasks: number;
  loadedTasks: number;
}

export interface KarmaStats {
  karma: number;
  karmaRising: boolean;
  karmaTrend: 'up' | 'down' | 'none';
}

export interface TodoistUser {
  id: string;
  email: string;
  fullName: string;
  isPremium: boolean;
  karma: number;
  karmaTrend: string;
  dailyGoal: number;
  weeklyGoal: number;
  completedCount: number;
  completedToday: number;
  timezone: string;
  startPage: string;
  lang: string;
}

export interface ExtendedSession extends Session {
  accessToken?: string;
}

export interface ErrorResponse {
  error: string;
  details?: string;
}

export type TodoistColor =
  | 'berry_red'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'olive_green'
  | 'lime_green'
  | 'green'
  | 'mint_green'
  | 'teal'
  | 'sky_blue'
  | 'light_blue'
  | 'blue'
  | 'grape'
  | 'violet'
  | 'lavender'
  | 'magenta'
  | 'salmon'
  | 'charcoal'
  | 'grey'
  | 'taupe';

// Label/Tag type from Todoist API
export interface Label {
  id: string;
  name: string;
  color: string; // Todoist color name (e.g., 'berry_red', 'blue')
  order: number;
  isFavorite: boolean;
}

// Date Range Types for Dashboard Filtering
export type DateRangePreset = 'all' | 'today' | 'yesterday' | '7d' | '30d' | '90d' | '6m' | '1y' | 'custom';

export interface DateRange {
  start: Date | null;
  end: Date | null;
  preset: DateRangePreset;
}

// Dashboard Preferences (persisted in localStorage)
export interface DashboardPreferences {
  selectedProjectIds: string[];
  dateRange: DateRange;
  visibleSections: string[]; // Empty array means all sections visible
  version: number; // For schema migration in the future
}