const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with retry and exponential backoff for transient (5xx) errors.
 * Delays: 1s, 2s, 4s (2^attempt * 1000ms) between retries.
 * Non-5xx responses are returned immediately without retry.
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.status >= 500 && attempt < maxRetries) {
        await sleep(Math.pow(2, attempt) * 1000);
        continue;
      }
      return res;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await sleep(Math.pow(2, attempt) * 1000);
    }
  }
  throw new Error('Max retries exceeded');
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('aromasys_token');
}

function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('aromasys_token', token);
}

function handleUnauthorized() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('aromasys_token');
  localStorage.removeItem('aromasys_user');
  window.location.href = '/login?session=expired';
}

// Track whether a refresh is already in progress to avoid multiple concurrent refreshes
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

/**
 * Attempt to refresh the JWT token using the current token.
 * Returns the new token on success, or null on failure.
 */
async function attemptTokenRefresh(): Promise<string | null> {
  const token = getToken();
  if (!token) return null;

  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (data.success && data.token) {
      setToken(data.token);
      return data.token;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Handles 401 by attempting a token refresh, then retrying the original request.
 * If refresh fails, redirects to login.
 */
async function handleUnauthorizedWithRefresh(
  path: string,
  mergedHeaders: Record<string, string>,
  rest: RequestInit
): Promise<Response | null> {
  // Avoid refreshing for the refresh endpoint itself
  if (path === '/auth/refresh') return null;

  // Deduplicate concurrent refresh attempts
  if (!isRefreshing) {
    isRefreshing = true;
    refreshPromise = attemptTokenRefresh();
  }

  const newToken = await refreshPromise;
  isRefreshing = false;
  refreshPromise = null;

  if (!newToken) return null;

  // Retry the original request with the new token
  mergedHeaders['Authorization'] = `Bearer ${newToken}`;
  const retryRes = await fetch(`${BASE_URL}${path}`, {
    headers: mergedHeaders,
    ...rest,
  });

  return retryRes;
}

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { skipAuth = false, headers = {}, ...rest } = options;
  const token = getToken();

  const mergedHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (typeof window !== 'undefined') {
    const customKey = localStorage.getItem('aromasys_gemini_api_key');
    if (customKey) {
      mergedHeaders['x-gemini-api-key'] = customKey;
    }
  }

  if (!skipAuth && token) {
    mergedHeaders['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetchWithRetry(`${BASE_URL}${path}`, {
    headers: mergedHeaders,
    ...rest,
  });

  if (res.status === 401) {
    // Attempt token refresh and retry the request
    const retryRes = await handleUnauthorizedWithRefresh(path, { ...mergedHeaders }, rest);
    if (retryRes && retryRes.ok) {
      const data = await retryRes.json();
      return data as T;
    }
    // Refresh failed — redirect to login
    handleUnauthorized();
    throw new Error('Unauthorized');
  }

  const data = await res.json();
  return data as T;
}

export const api = {
  get: <T = unknown>(path: string, opts?: FetchOptions) =>
    apiFetch<T>(path, { method: 'GET', ...opts }),

  post: <T = unknown>(path: string, body?: unknown, opts?: FetchOptions) =>
    apiFetch<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...opts,
    }),

  put: <T = unknown>(path: string, body?: unknown, opts?: FetchOptions) =>
    apiFetch<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...opts,
    }),

  delete: <T = unknown>(path: string, opts?: FetchOptions) =>
    apiFetch<T>(path, { method: 'DELETE', ...opts }),

  postForm: <T = unknown>(path: string, body: FormData, opts?: FetchOptions) => {
    const { headers = {}, ...rest } = opts ?? {};
    const mergedHeaders = { ...(headers as Record<string, string>) };
    const token = getToken();
    if (token) mergedHeaders['Authorization'] = `Bearer ${token}`;
    // Do NOT set Content-Type — browser sets it with boundary for multipart
    return apiFetch<T>(path, {
      method: 'POST',
      headers: mergedHeaders,
      body,
      ...rest,
    });
  },
};
