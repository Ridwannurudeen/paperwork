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

function humanizeRetry(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const m = Math.ceil(seconds / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"}`;
  const h = Math.ceil(m / 60);
  return `${h} hour${h === 1 ? "" : "s"}`;
}

export function rateLimitResponse(retryAfter: number): Response {
  return Response.json(
    {
      error: `Demo rate limit reached. Try again in ${humanizeRetry(retryAfter)}. Each IP gets a small hourly quota so this stays free — clone the repo and run it locally for unlimited use: github.com/Ridwannurudeen/paperwork`,
      rate_limited: true,
      retry_after_seconds: retryAfter,
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
