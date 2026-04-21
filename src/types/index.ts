export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
}

export interface Mapping {
  id: string;
  slug: string;
  label: string;
  targetUrl: string;
  logRetain: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  logs?: RequestLog[];
  _count?: {
    logs: number;
  };
  alwaysReturn200: boolean;   // ← add this 
}

export interface RequestLog {
  id: string;
  mappingId: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
  queryParams: Record<string, string> | null;
  statusCode: number | null;
  success: boolean;
  error: string | null;
  duration: number | null;
  createdAt: Date;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}
