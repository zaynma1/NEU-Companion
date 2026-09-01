import { buildApiUrl, environment } from '../config/environment';
import { buildCookieHeader, loadCookieJar, parseSetCookieHeader, saveCookieJar } from '../auth/session';

export type ApiErrorShape = {
  message: string;
  status?: number;
  code?: string;
};

export class ApiClientError extends Error {
  status?: number;
  code?: string;

  constructor(message: string, init?: { status?: number; code?: string }) {
    super(message);
    this.name = 'ApiClientError';
    this.status = init?.status;
    this.code = init?.code;
  }
}

export type ApiRequestOptions = RequestInit & {
  timeoutMs?: number;
  json?: unknown;
};

async function parseApiResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  const setCookieHeader = response.headers.get('set-cookie') ?? response.headers.get('Set-Cookie');

  if (setCookieHeader) {
    const cookieJar = await loadCookieJar();
    const nextCookieJar = { ...cookieJar, ...parseSetCookieHeader(setCookieHeader) };
    await saveCookieJar(nextCookieJar);
  }

  if (contentType.includes('application/json')) {
    const data = await response.json();
    if (!response.ok) {
      throw new ApiClientError(data?.message ?? 'Request failed', {
        status: response.status,
        code: data?.code,
      });
    }
    return data as T;
  }

  if (!response.ok) {
    throw new ApiClientError(`Request failed with status ${response.status}`, {
      status: response.status,
    });
  }

  return undefined as T;
}

export async function request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { timeoutMs = environment.apiTimeoutMs, json, headers, ...rest } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const cookieJar = await loadCookieJar();
    const cookieHeader = buildCookieHeader(cookieJar);

    const response = await fetch(buildApiUrl(path), {
      ...rest,
      headers: {
        Accept: 'application/json',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      signal: controller.signal,
    });

    return await parseApiResponse<T>(response);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiClientError('Request timed out', { status: 408 });
    }

    if (error instanceof ApiClientError) {
      throw error;
    }

    throw new ApiClientError(error instanceof Error ? error.message : 'Request failed');
  } finally {
    clearTimeout(timeoutId);
  }
}

export const api = {
  get: <T>(path: string, options?: Omit<ApiRequestOptions, 'json'>) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, jsonBody?: unknown, options?: Omit<ApiRequestOptions, 'json'>) =>
    request<T>(path, { ...options, method: 'POST', json: jsonBody }),
  put: <T>(path: string, jsonBody?: unknown, options?: Omit<ApiRequestOptions, 'json'>) =>
    request<T>(path, { ...options, method: 'PUT', json: jsonBody }),
  del: <T>(path: string, options?: Omit<ApiRequestOptions, 'json'>) => request<T>(path, { ...options, method: 'DELETE' }),
};
