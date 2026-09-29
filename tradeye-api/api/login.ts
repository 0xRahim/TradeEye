import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "edge" };

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
} as const;

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function jsonError(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: CORS_HEADERS });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonError("Method Not Allowed", 405);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const email =
    typeof body === "object" && body !== null && "email" in body
      ? String((body as { email: unknown }).email ?? "").trim()
      : "";
  const password =
    typeof body === "object" && body !== null && "password" in body
      ? String((body as { password: unknown }).password ?? "")
      : "";

  if (!isEmail(email)) {
    return jsonError("Enter a valid email address.", 400);
  }
  if (!password) {
    return jsonError("Password is required.", 400);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonError("Server misconfigured", 500);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const status =
      typeof (error as { status?: unknown }).status === "number" &&
      (error as { status: number }).status >= 400 &&
      (error as { status: number }).status < 500
        ? (error as { status: number }).status
        : 401;
    // Supabase returns 400 for bad credentials; expose as 401 to callers.
    const mappedStatus = status === 400 ? 401 : status;
    return jsonError(error.message || "Invalid login credentials", mappedStatus);
  }

  if (!data.session) {
    return jsonError("Login failed", 500);
  }

  return Response.json(
    {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      token_type: data.session.token_type,
      user: data.user,
    },
    { status: 200, headers: CORS_HEADERS },
  );
}
