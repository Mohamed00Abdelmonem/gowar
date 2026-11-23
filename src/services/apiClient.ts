const viteEnv = (
  import.meta as unknown as {
    env?: Record<string, string | boolean | undefined>;
  }
).env;

const IS_PROD_BUILD = viteEnv?.PROD === true;

const rawApiBaseUrl =
  typeof viteEnv?.VITE_API_BASE_URL === 'string' && viteEnv.VITE_API_BASE_URL.trim()
    ? viteEnv.VITE_API_BASE_URL.trim()
    : IS_PROD_BUILD
      ? '/api/v1'
      : 'http://localhost:8000/api/v1';

export const API_BASE_URL = rawApiBaseUrl.replace(/\/+$/, '');

export const IS_BACKEND_API_ENABLED = IS_PROD_BUILD
  ? viteEnv?.VITE_USE_BACKEND_API !== 'false'
  : viteEnv?.VITE_USE_BACKEND_API === 'true';

const ACCESS_KEY = 'gowar_jwt_access_v1';
const REFRESH_KEY = 'gowar_jwt_refresh_v1';
const USER_KEY = 'gowar_api_user_v1';

export interface BackendUserSummary {
  id: string;
  email: string;
  phone_number: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: 'customer' | 'merchant' | 'delivery' | 'admin';
  is_verified: boolean;
  search_radius_km?: number | null;
  merchant_approval_status?: string | null;
  stores?: Array<{
    id: string;
    name: string;
    name_en: string;
    approval_status: string;
    is_open: boolean;
  }>;
}

export class ApiClientError extends Error {
  status: number;
  code?: string;
  errors?: unknown;
  retryAfterSeconds?: number;

  constructor(
    message: string,
    status: number,
    code?: string,
    errors?: unknown,
    retryAfterSeconds?: number
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.errors = errors;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function formatApiErrorMessage(
  err: unknown,
  language: 'ar' | 'en',
  fallbackAr: string,
  fallbackEn: string
): string {
  const isAr = language === 'ar';
  if (!(err instanceof ApiClientError)) {
    return isAr ? fallbackAr : fallbackEn;
  }
  if (err.code === 'NETWORK_ERROR' || err.status === 0) {
    return isAr
      ? 'في مشكلة في الاتصال بالإنترنت. راجع اتصالك وحاول تاني.'
      : 'Connection issue. Please check your internet and try again.';
  }
  if (err.status === 429 || err.code === 'RATE_LIMITED') {
    if (err.retryAfterSeconds && err.retryAfterSeconds > 0) {
      return isAr
        ? `أنت بتستخدم الخدمة بسرعة. استنى ${err.retryAfterSeconds} ثانية وجرب تاني.`
        : `You are making requests too quickly. Please wait ${err.retryAfterSeconds}s and try again.`;
    }
    return isAr
      ? 'أنت بتستخدم الخدمة بسرعة. استنى لحظات وجرب تاني.'
      : 'Too many requests. Please wait a moment and try again.';
  }
  if (err.status === 401 || err.code === 'SESSION_EXPIRED') {
    return isAr
      ? 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى.'
      : 'Your session expired. Please sign in again.';
  }
  if (err.status === 403 || err.code === 'FORBIDDEN') {
    return isAr
      ? 'ليس لديك صلاحية لتنفيذ هذا الإجراء.'
      : 'You do not have permission to perform this action.';
  }
  if (err.status >= 500 || err.code === 'SERVER_ERROR') {
    return isAr
      ? 'حصلت مشكلة مؤقتة. حاول مرة تانية.'
      : 'A temporary server issue occurred. Please try again.';
  }
  return err.message || (isAr ? fallbackAr : fallbackEn);
}

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(ACCESS_KEY);
  } catch {
    return null;
  }
}

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function getStoredApiUser(): BackendUserSummary | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as BackendUserSummary) : null;
  } catch {
    return null;
  }
}

export function setAuthTokens(
  access: string,
  refresh: string,
  user?: BackendUserSummary
): void {
  try {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  } catch {
    // Ignore storage quota issues
  }
}

export function clearAuthTokens(): void {
  try {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // Ignore
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessTokenSingleFlight(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  const refresh = getRefreshToken();
  if (!refresh) return null;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      });
      if (!res.ok) {
        clearAuthTokens();
        return null;
      }
      const data = (await res.json()) as { access: string; refresh?: string };
      localStorage.setItem(ACCESS_KEY, data.access);
      if (data.refresh) {
        localStorage.setItem(REFRESH_KEY, data.refresh);
      }
      return data.access;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  skipAuth?: boolean;
  retryOn401?: boolean;
}

function formatFieldErrors(errorsObj: unknown): string | null {
  if (!errorsObj) return null;
  if (Array.isArray(errorsObj) && typeof errorsObj[0] === 'string') {
    return errorsObj[0];
  }
  if (typeof errorsObj !== 'object') return null;

  const entries = Object.entries(errorsObj as Record<string, unknown>);
  for (const [key, val] of entries) {
    if (key === 'error' || key === 'status_code' || key === 'code' || key === 'detail' || key === 'errors') {
      continue;
    }
    if (Array.isArray(val) && typeof val[0] === 'string') {
      return key === 'non_field_errors' ? val[0] : `${key}: ${val[0]}`;
    }
    if (typeof val === 'string' && val) {
      return key === 'non_field_errors' ? val : `${key}: ${val}`;
    }
  }
  return null;
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const obj = payload as Record<string, unknown>;

  const nestedFieldMsg = formatFieldErrors(obj.errors);
  if (obj.detail === 'Request failed.' && nestedFieldMsg) {
    return nestedFieldMsg;
  }
  if (typeof obj.detail === 'string' && obj.detail && obj.detail !== 'Request failed.') {
    return obj.detail;
  }
  if (Array.isArray(obj.non_field_errors) && typeof obj.non_field_errors[0] === 'string') {
    return obj.non_field_errors[0];
  }
  if (nestedFieldMsg) return nestedFieldMsg;

  const topLevelFieldMsg = formatFieldErrors(obj);
  if (topLevelFieldMsg) return topLevelFieldMsg;

  if (typeof obj.detail === 'string' && obj.detail) return obj.detail;
  return fallback;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { body, skipAuth = false, retryOn401 = true, headers, ...rest } = options;
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  const reqHeaders = new Headers(headers);
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (!isFormData && !reqHeaders.has('Content-Type')) {
    reqHeaders.set('Content-Type', 'application/json');
  }

  if (!skipAuth) {
    const token = getAccessToken();
    if (token) {
      reqHeaders.set('Authorization', `Bearer ${token}`);
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      headers: reqHeaders,
      body: isFormData
        ? (body as FormData)
        : body !== undefined
          ? JSON.stringify(body)
          : undefined,
    });
  } catch (err) {
    throw new ApiClientError(
      'في مشكلة في الاتصال بالإنترنت. راجع اتصالك وحاول تاني.',
      0,
      'NETWORK_ERROR',
      err
    );
  }

  if (response.status === 401 && !skipAuth && retryOn401 && getRefreshToken()) {
    const nextToken = await refreshAccessTokenSingleFlight();
    if (nextToken) {
      return apiRequest<T>(path, { ...options, retryOn401: false });
    }
    clearAuthTokens();
    throw new ApiClientError('انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى.', 401, 'SESSION_EXPIRED');
  }

  let data: unknown = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const retryAfterHeader = response.headers.get('Retry-After');
    const retryAfterBody =
      data && typeof data === 'object' && 'retry_after' in data
        ? Number((data as { retry_after: unknown }).retry_after)
        : NaN;
    const parsedRetry = retryAfterHeader ? Number(retryAfterHeader) : retryAfterBody;
    const retryAfterSeconds =
      Number.isFinite(parsedRetry) && parsedRetry > 0 ? Math.ceil(parsedRetry) : undefined;

    const code =
      data && typeof data === 'object' && 'code' in data
        ? String((data as { code: unknown }).code)
        : response.status === 429
          ? 'RATE_LIMITED'
          : response.status === 403
            ? 'FORBIDDEN'
            : response.status >= 500
              ? 'SERVER_ERROR'
              : undefined;

    const fallbackMsg =
      response.status === 429
        ? 'أنت بتستخدم الخدمة بسرعة. استنى لحظات وجرب تاني.'
        : response.status === 403
          ? 'ليس لديك صلاحية لتنفيذ هذا الإجراء.'
          : response.status >= 500
            ? 'حصلت مشكلة مؤقتة. حاول مرة تانية.'
            : `HTTP Error ${response.status}`;

    const message =
      response.status === 429 || response.status >= 500
        ? fallbackMsg
        : extractErrorMessage(data, fallbackMsg);
    throw new ApiClientError(message, response.status, code, data, retryAfterSeconds);
  }

  return data as T;
}
