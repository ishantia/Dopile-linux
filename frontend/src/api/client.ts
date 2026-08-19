import { ApiError } from '../types';

let csrfToken: string | null = localStorage.getItem('csrf_token');

export function setCsrfToken(token: string | null) {
  csrfToken = token;
  if (token) {
    localStorage.setItem('csrf_token', token);
  } else {
    localStorage.removeItem('csrf_token');
  }
}

export function getCsrfToken(): string | null {
  return csrfToken || localStorage.getItem('csrf_token');
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  const currentCsrf = getCsrfToken();
  if (currentCsrf && ['POST', 'PUT', 'PATCH', 'DELETE'].includes((options.method || 'GET').toUpperCase())) {
    headers['X-CSRF-Token'] = currentCsrf;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include',
  });

  const responseCsrf = response.headers.get('X-CSRF-Token');
  if (responseCsrf) {
    setCsrfToken(responseCsrf);
  }

  // Auto-refresh token attempt if 401 and not already logging in, checking session, or refreshing
  if (
    response.status === 401 &&
    !endpoint.includes('/api/auth/login') &&
    !endpoint.includes('/api/auth/refresh') &&
    !endpoint.includes('/api/auth/me')
  ) {
    try {
      const refreshRes = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        if (refreshData.csrf_token) {
          setCsrfToken(refreshData.csrf_token);
        }
        // Retry original request
        headers['X-CSRF-Token'] = getCsrfToken() || '';
        const retryRes = await fetch(endpoint, {
          ...options,
          headers,
          credentials: 'include',
        });
        if (!retryRes.ok) {
          const errData: ApiError = await retryRes.json().catch(() => ({ error: { code: 'UNKNOWN', message: 'An unknown error occurred' } }));
          throw new Error(errData.error?.message || 'Request failed');
        }
        if (retryRes.status === 204) return {} as T;
        return await retryRes.json();
      }
    } catch {
      // Refresh failed, proceed to handle 401 error
    }
  }

  if (!response.ok) {
    const errorData: ApiError = await response.json().catch(() => ({
      error: { code: 'HTTP_ERROR', message: `Request failed with status ${response.status}` }
    }));
    throw new Error(errorData.error?.message || 'An error occurred');
  }

  if (response.status === 204) {
    return {} as T;
  }

  return await response.json();
}
