const rateLimit = require("express-rate-limit");

/**
 * ============================================================
 * RATE LIMITING
 * ============================================================
 * Every other route in this backend sits behind the `auth`
 * middleware (a valid JWT is required first), which already limits
 * who can even attempt abuse. POST /api/auth/login is the one
 * genuinely public, unauthenticated endpoint in the whole API —
 * anyone can throw password guesses at it with no rate limiting at
 * all today. This is that fix.
 * ============================================================
 */

/**
 * Strict limiter for the login endpoint itself: 10 attempts per 15
 * minutes per IP. `skipSuccessfulRequests: true` means only FAILED
 * attempts count toward the limit — a legitimate user who gets it
 * right on the 3rd try isn't penalized for the 2 typos, but 10
 * WRONG passwords in a row from the same IP is a brute-force
 * pattern, not normal human behavior.
 */
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  // Matches authController.login's own response shape (`{ message }`,
  // not the rest of the app's `{ success, message }` convention) —
  // consistency with the ONE endpoint this sits in front of, rather
  // than the app as a whole.
  handler: (req, res) => {
    res.status(429).json({
      message: "Too many login attempts. Please wait a few minutes and try again.",
    });
  },
});

/**
 * A light, general-purpose limiter applied to the whole API as
 * defense-in-depth against scraping/abuse — 300 requests per 15
 * minutes per IP is generous enough that no legitimate usage
 * pattern (a busy HR dashboard polling notifications, a large
 * paginated export, etc.) should ever come close to it.
 */
const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many requests. Please slow down and try again shortly.",
    });
  },
});

module.exports = { loginRateLimiter, generalRateLimiter };
