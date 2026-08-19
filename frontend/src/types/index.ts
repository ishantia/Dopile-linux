export type UserRole = 'USER' | 'ADMIN';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface User {
  id: string;
  username: string;
  email?: string | null;
  role: UserRole;
  is_active: boolean;
  allowed_ip?: string | null;
  created_at: string;
  last_login_at?: string | null;
}

export interface Task {
  id: string;
  owner_id: string;
  owner_username?: string | null;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

export interface TaskListResponse {
  items: Task[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AuditLog {
  id: string;
  actor_user_id?: string | null;
  action: string;
  target_type: string;
  target_id?: string | null;
  timestamp: string;
  source_ip?: string | null;
  metadata_json?: string | null;
}

export interface AuditLogListResponse {
  items: AuditLog[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ServerStatus {
  app_name: string;
  version: string;
  app_env: string;
  uptime_seconds: number;
  database_status: string;
  total_users: number;
  total_tasks: number;
  active_websocket_connections: number;
}

export interface BackupInfo {
  filename: string;
  size_bytes: number;
  created_at: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}
