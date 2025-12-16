import type { UserUsageObject } from '../durable-objects/UserUsageObject';

export interface Env {
  ANTHROPIC_API_KEY: string;
  GOOGLE_API_KEY: string;
  OPENAI_API_KEY: string;

  // D1 Database binding
  DB: D1Database;

  // Durable Objects
  USER_USAGE: DurableObjectNamespace<UserUsageObject>;

  // Internal API secret for cross-worker communication
  INTERNAL_API_SECRET?: string;
}

export async function createContext({
  req,
  env,
  workerCtx,
}: {
  req: Request;
  env: Env;
  workerCtx: ExecutionContext;
}) {
  return {
    req,
    env,
    workerCtx,
    // TODO: Add real user authentication
    userInfo: {
      userId: "anonymous",
    },
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
