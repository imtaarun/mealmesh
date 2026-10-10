const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** A machine-readable reason some errors carry, e.g. "AGE_REQUIRED". */
    public code?: string,
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
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(0, "Can't reach MealMesh right now. Check your connection and try again.");
  }

  if (!res.ok) {
    // The backend explains itself in a `message` field; show that, not raw JSON.
    const text = await res.text();
    let message = text;
    let explained = false;
    let code: string | undefined;
    try {
      const parsed = JSON.parse(text) as { message?: string | string[]; code?: string };
      code = parsed.code;
      if (parsed.message) {
        message = Array.isArray(parsed.message) ? parsed.message.join("\n") : parsed.message;
        explained = true;
      }
    } catch {
      // not JSON — keep the text as is
    }
    // A crash says nothing useful; a deliberate 5xx ("Google sign-in isn't set up yet") does.
    if (res.status >= 500 && (!explained || message === "Internal server error")) message = "Something went wrong on our side. Try again in a moment.";
    throw new ApiError(res.status, message, code);
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
