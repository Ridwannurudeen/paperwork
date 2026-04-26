import { NextRequest } from "next/server";

type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

function clientIp(req: NextRequest): string {
  // Prefer X-Real-IP — our nginx sets it explicitly to $remote_addr, so it
  // can't be spoofed by client-supplied headers. We only fall back to
  // X-Forwarded-For (and only the LAST hop, which nginx writes) if
  // X-Real-IP is missing. Don't trust the first hop of XFF — it can be
  // attacker-supplied and fool the per-IP rate limit.
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1]!;
  }
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
