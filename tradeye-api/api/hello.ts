export const config = { runtime: "edge" };

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
} as const;

export default function handler(req: Request): Response {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "GET") {
    return Response.json(
      { error: "Method Not Allowed" },
      { status: 405, headers: CORS_HEADERS },
    );
  }

  const url = new URL(req.url);
  const name = url.searchParams.get("name") ?? "Tradeye";

  return Response.json(
    {
      message: `Hello from Tradeye API, ${name}!`,
      timestamp: new Date().toISOString(),
      runtime: "edge",
    },
    { headers: CORS_HEADERS },
  );
}
