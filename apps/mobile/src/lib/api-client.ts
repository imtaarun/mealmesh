// Thin fetch wrapper for apps/backend. Every mutating route on the backend already
// returns the updated resource plus any recomputed derived values (docs/architecture.md
// "API surface") — callers should trust the response, not recompute anything client-side.

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Set once by AuthProvider on login/signup/restore, read by every request after —
// simplest way to attach the session token without threading it through every call
// site or fighting a circular import with the auth context.
let currentToken: string | null = null;

export function setAuthToken(token: string | null): void {
  currentToken = token;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    throw new ApiError(res.status, await res.text());
  }

  // NestJS sends a handler's `null` (e.g. "no plan yet") as an empty body, which
  // res.json() would throw on.
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
};
