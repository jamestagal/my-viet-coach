import { t } from "./trpc-instance";
import { coachTrpcRoutes } from "./routers/coach";
import { voiceTrpcRoutes } from "./routers/voice";

export const appRouter = t.router({
  coach: coachTrpcRoutes,
  voice: voiceTrpcRoutes,
});

export type AppRouter = typeof appRouter;
