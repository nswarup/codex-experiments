/**
 * Birdie's API as one Vercel Function. vercel.json rewrites /api/* here; Hono routes on the
 * original path, streams writer output as server-sent events, and checks the session too.
 */
import { app } from "../server/src/index.js";

export default app;
