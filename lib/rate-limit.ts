/**
 * Simple in-memory rate limiter for API endpoints.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * In-memory store for rate limit tracking.
 */
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Clean up expired entries from the rate limit store.
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Create a new rate limit entry for a first-time or expired identifier.
 */
function createNewEntry(
  identifier: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetIn: number } {
  rateLimitStore.set(identifier, {
    count: 1,
    resetTime: Date.now() + windowMs,
  });
  return { allowed: true, remaining: maxRequests - 1, resetIn: windowMs };
}

/**
 * Update an existing rate limit entry and return the result.
 */
function updateExistingEntry(
  entry: RateLimitEntry,
  maxRequests: number
): { allowed: boolean; remaining: number; resetIn: number } {
  const resetIn = entry.resetTime - Date.now();

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetIn };
  }

  entry.count += 1;
  return { allowed: true, remaining: maxRequests - entry.count, resetIn };
}

/**
 * Check and update rate limit for a given identifier.
 * Returns true if the request is allowed, false if rate limited.
 */
export function checkRateLimit({
  identifier,
  maxRequests,
  windowMs,
}: {
  identifier: string;
  maxRequests: number;
  windowMs: number;
}): { allowed: boolean; remaining: number; resetIn: number } {
  if (rateLimitStore.size > 1000) {
    cleanupExpiredEntries();
  }

  const entry = rateLimitStore.get(identifier);
  const isExpired = !entry || Date.now() > entry.resetTime;

  if (isExpired) {
    return createNewEntry(identifier, maxRequests, windowMs);
  }

  return updateExistingEntry(entry, maxRequests);
}

/**
 * Extract client IP from request headers.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  return "unknown";
}
