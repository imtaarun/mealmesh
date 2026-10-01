const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Set by AuthProvider; read by every request.
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
    // The backend explains itself in a `message` field; show that, not raw JSON.
    const text = await res.text();
    let message = text;
    try {
      const parsed = JSON.parse(text) as { message?: string | string[] };
      if (parsed.message) message = Array.isArray(parsed.message) ? parsed.message.join("\n") : parsed.message;
    } catch {
      // not JSON — keep the text as is
    }
    throw new ApiError(res.status, message);
  }

  // NestJS sends `null` as an empty body.
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
