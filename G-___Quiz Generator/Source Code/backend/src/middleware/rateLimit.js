import { AppError } from "../utils/AppError.js";

const buckets = new Map();

function clientKey(req) {
  return req.user?._id?.toString() || req.ip || req.headers["x-forwarded-for"] || "anonymous";
}

export function rateLimit({ windowMs = 60_000, max = 20, label = "requests" } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    const key = `${label}:${clientKey(req)}`;
    const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs };

    if (bucket.resetAt <= now) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }

    bucket.count += 1;
    buckets.set(key, bucket);

    if (bucket.count > max) {
      return next(new AppError("Too many requests. Please wait and try again.", 429));
    }

    return next();
  };
}
