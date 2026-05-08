import type { ApiErrorBody } from '../types/api';

const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const apiKey = import.meta.env.VITE_API_KEY || '';

function buildHeaders(customHeaders?: HeadersInit, withApiKey = false): Headers {
  const headers = new Headers(customHeaders);
  headers.set('Content-Type', 'application/json');

  if (withApiKey && apiKey) {
    headers.set('x-api-key', apiKey);
  }

  return headers;
}

export async function httpGet<T>(path: string, withApiKey = false): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'GET',
    headers: buildHeaders(undefined, withApiKey)
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    const message = body?.message || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}
