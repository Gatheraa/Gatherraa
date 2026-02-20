const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface ApiError {
  message: string;
  statusCode: number;
  error?: string;
}

export class ApiClientError extends Error {
  statusCode: number;
  error?: string;

  constructor(message: string, statusCode: number, error?: string) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.error = error;
  }
}

async function getAuthToken(): Promise<string | null> {
  // Get token from cookies or localStorage
  if (typeof document !== 'undefined') {
    const cookies = document.cookie.split(';');
    const tokenCookie = cookies.find((c) => c.trim().startsWith('access_token='));
    if (tokenCookie) {
      return tokenCookie.split('=')[1];
    }
  }
  return null;
}

async function fetchWithAuth(
  url: string,
  options: RequestInit = {},
  skipJsonContentType: boolean = false,
): Promise<Response> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  // Don't set Content-Type for FormData - browser will set it with boundary
  if (!skipJsonContentType && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData: ApiError = await response.json().catch(() => ({
      message: response.statusText,
      statusCode: response.status,
    }));
    throw new ApiClientError(
      errorData.message || response.statusText,
      errorData.statusCode || response.status,
      errorData.error,
    );
  }

  return response;
}

export async function apiGet<T>(url: string): Promise<T> {
  const response = await fetchWithAuth(url, { method: 'GET' });
  return response.json();
}

export async function apiPost<T>(url: string, data?: unknown): Promise<T> {
  const isFormData = data instanceof FormData;
  const response = await fetchWithAuth(
    url,
    {
      method: 'POST',
      body: isFormData ? data : data ? JSON.stringify(data) : undefined,
    },
    isFormData,
  );
  return response.json();
}

export async function apiPatch<T>(url: string, data?: unknown): Promise<T> {
  const response = await fetchWithAuth(url, {
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
  });
  return response.json();
}

export async function apiDelete<T>(url: string): Promise<T> {
  const response = await fetchWithAuth(url, { method: 'DELETE' });
  return response.json();
}

export async function apiUpload<T>(url: string, formData: FormData): Promise<T> {
  const token = await getAuthToken();
  const headers: HeadersInit = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${url}`, {
    method: 'POST',
    headers,
    body: formData,
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData: ApiError = await response.json().catch(() => ({
      message: response.statusText,
      statusCode: response.status,
    }));
    throw new ApiClientError(
      errorData.message || response.statusText,
      errorData.statusCode || response.status,
      errorData.error,
    );
  }

  return response.json();
}
