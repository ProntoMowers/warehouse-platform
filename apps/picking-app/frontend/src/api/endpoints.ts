import { httpGet } from './client';
import type {
  DatabasesStatusResponse,
  HealthResponse,
  SecurePingResponse
} from '../types/api';

export function getHealth() {
  return httpGet<HealthResponse>('/api/health', false);
}

export function getSecurePing() {
  return httpGet<SecurePingResponse>('/api/ping', true);
}

export function getDatabasesStatus() {
  return httpGet<DatabasesStatusResponse>('/api/databases/status', true);
}
