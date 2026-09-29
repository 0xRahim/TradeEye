/**
 * Auth API client. Talks to the Tradeye API (`POST /api/login`) whose base
 * URL comes from `NEXT_PUBLIC_API_URL` (falls back to local API dev server).
 */

export interface LoginResult {
  accessToken: string;
  refreshToken: string | null;
  email: string;
}

interface LoginApiSuccess {
  access_token?: unknown;
  refresh_token?: unknown;
  user?: { email?: unknown } | null;
}

function apiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? "";
  const trimmed = raw.trim().replace(/\/+$/, "");
  return trimmed || "http://localhost:3001";
}

function toErrorMessage(status: number, body: unknown, fallback: string): string {
  if (status === 401) return "Invalid email or password.";
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as { error: unknown }).error === "string" &&
    ((body as { error: string }).error as string).length > 0
  ) {
    return (body as { error: string }).error;
  }
  return fallback;
}

export async function loginRequest(email: string, password: string): Promise<LoginResult> {
  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl()}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error("Cannot reach login service. Check your connection.");
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    throw new Error(toErrorMessage(res.status, body, "Login failed. Try again."));
  }

  const data = body as LoginApiSuccess;
  if (typeof data?.access_token !== "string" || data.access_token.length === 0) {
    throw new Error("Login failed. Try again.");
  }
  const apiEmail = data.user && typeof data.user.email === "string" ? data.user.email : email;

  return {
    accessToken: data.access_token,
    refreshToken:
      typeof data.refresh_token === "string" && data.refresh_token.length > 0
        ? data.refresh_token
        : null,
    email: apiEmail,
  };
}
