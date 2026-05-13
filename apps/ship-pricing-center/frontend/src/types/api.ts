export interface ApiErrorBody {
  ok?: boolean;
  message?: string;
}

export interface HealthResponse {
  ok: boolean;
  service: string;
  timestamp: string;
  uptimeSeconds: number;
}

export interface SecurePingResponse {
  ok: boolean;
  message: string;
  timestamp: string;
}

export interface DatabaseCheckResult {
  status: 'ok' | 'error' | 'skipped';
  message?: string;
}

export interface DatabasesStatusResponse {
  ok: boolean;
  timestamp: string;
  databases: {
    mysql: DatabaseCheckResult;
    mssql: DatabaseCheckResult;
    bigquery: DatabaseCheckResult;
  };
}

export interface OrdersResponse {
  ok: boolean;
  total: number;
  page: number;
  pages: number;
  summary: Record<string, unknown>;
  orders: unknown[];
  filters: Record<string, unknown>;
}

export interface OptionsResponse {
  ok: boolean;
  options: string[];
  assignments?: Record<string, unknown>;
}
