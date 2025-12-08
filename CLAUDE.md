# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a pnpm monorepo for a full-stack application deployed on Cloudflare. The project manages geo-routed links with analytics and evaluations.

## Common Commands

### Development
```bash
pnpm dev-frontend          # Run React frontend (port 3000)
pnpm dev-data-service      # Run data-service worker
pnpm build-package         # Build the @repo/data-ops package
```

### Individual App Commands
```bash
# user-application
pnpm --filter user-application dev      # Dev server
pnpm --filter user-application build    # Build for production
pnpm --filter user-application test     # Run tests
pnpm --filter user-application deploy   # Deploy to Cloudflare

# data-service
pnpm --filter data-service dev          # Dev with remote bindings
pnpm --filter data-service test         # Run tests
pnpm --filter data-service deploy       # Deploy worker
```

### Database (in packages/data-ops)
```bash
pnpm --filter @repo/data-ops pull       # Pull schema from D1
pnpm --filter @repo/data-ops generate   # Generate migrations
pnpm --filter @repo/data-ops migrate    # Run migrations
pnpm --filter @repo/data-ops studio     # Open Drizzle Studio
```

### Type Generation
```bash
pnpm --filter user-application cf-typegen   # Generate worker types
pnpm --filter data-service cf-typegen       # Generate worker types
```

## Architecture

### Monorepo Structure
- `apps/user-application/` - React SPA with Cloudflare Worker backend
- `apps/data-service/` - Cloudflare Worker entrypoint service
- `packages/data-ops/` - Shared data layer (database, schemas, auth)

### user-application Stack
- **Frontend**: React 19 + TanStack Router + TanStack Query + Tailwind CSS v4
- **Backend**: Cloudflare Worker serving tRPC API at `/trpc`
- **Build**: Vite 7 with `@cloudflare/vite-plugin`
- **UI Components**: Radix UI primitives in `src/components/ui/`

### Path Aliases (user-application)
- `@/*` → `./src/*`
- `@/worker/*` → `./worker/*`

### Backend Architecture (user-application)
The worker entry (`worker/index.ts`) handles:
- tRPC requests at `/trpc` via `@trpc/server/adapters/fetch`
- Static assets via `env.ASSETS.fetch()`

tRPC router structure:
- `worker/trpc/router.ts` - Main router combining sub-routers
- `worker/trpc/routers/` - Domain-specific routers (links, evaluations)

### data-ops Package Exports
```typescript
import { initDatabase, getDb } from "@repo/data-ops/database"
import { ... } from "@repo/data-ops/queries/*"
import { ... } from "@repo/data-ops/zod-schema/*"
import { ... } from "@repo/data-ops/durable-objects-helpers"
import { ... } from "@repo/data-ops/auth"
```

### Database
- Cloudflare D1 (SQLite)
- Drizzle ORM with `drizzle-kit`
- Better Auth for authentication with Stripe integration

### Key Dependencies
- **Auth**: better-auth with @better-auth/stripe
- **State**: Zustand for client state, TanStack Query for server state
- **Routing**: TanStack Router with file-based routes
- **API**: tRPC v11 for type-safe API calls
