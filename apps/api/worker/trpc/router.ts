import { t } from "./trpc-instance";
import { coachTrpcRoutes } from "./routers/coach";

export const appRouter = t.router({
  coach: coachTrpcRoutes,
});

export type AppRouter = typeof appRouter;
