// Per IP, per minute; read on every request so each environment can tune them.
const perMinute = (env: string, fallback: number) => ({ ttl: 60_000, limit: () => Number(process.env[env] ?? fallback) });

export const DEFAULT_LIMIT = perMinute("RATE_LIMIT_PER_MINUTE", 240);
/** Sign-in, sign-up and invite codes: slows guessing. */
export const AUTH_LIMIT = { default: perMinute("AUTH_RATE_LIMIT_PER_MINUTE", 10) };
/** Routes that price a whole basket or plan a week. */
export const HEAVY_LIMIT = { default: perMinute("HEAVY_RATE_LIMIT_PER_MINUTE", 30) };
