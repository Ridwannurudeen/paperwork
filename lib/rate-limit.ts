import { NextRequest } from "next/server";

type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export type RateLimitResult =
  | { ok: true; remaining: number; reset: number }
  | { ok: false; retryAfter: number };

export function rateLimit(
  req: NextRequest,
  routeId: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const ip = clientIp(req);
  const key = `${routeId}:${ip}`;
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.reset <= now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, remaining: limit - 1, reset: now + windowMs };
  }

  if (existing.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((existing.reset - now) / 1000) };
  }

  existing.count += 1;
  return { ok: true, remaining: limit - existing.count, reset: existing.reset };
}

export function rateLimitResponse(retryAfter: number): Response {
  return Response.json(
    {
      error: `Rate limit exceeded. Try again in ${retryAfter}s. This is a public demo with hard caps to prevent cost abuse — for a higher quota, run it locally.`,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Reason": "demo cost cap",
      },
    },
  );
}
