export interface Env {
  ANTHROPIC_API_KEY: string;
  // Add other env bindings here as needed
  // DB: D1Database;
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
