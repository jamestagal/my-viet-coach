# Tech Stack - Speak Phở Real

This document defines the technical stack for the Speak Phở Real Vietnamese language learning app.

## Framework & Runtime

- **Application Framework:** SvelteKit 2
- **Language:** TypeScript
- **Runtime:** Cloudflare Workers (V8 isolates)
- **Package Manager:** pnpm (monorepo with workspaces)

## Frontend

- **UI Framework:** Svelte 5 (with runes reactivity)
- **CSS Framework:** Tailwind CSS
- **UI Components:** bits-ui (headless components)
- **Icons:** lucide-svelte

## Backend & API

- **API Routes:** SvelteKit `+server.ts` endpoints
- **API Worker:** Hono (for separate API services in `apps/api/`)
- **Real-time:** WebSocket connections for voice streaming

## Database & Storage

- **Database:** Cloudflare D1 (SQLite)
- **ORM:** Drizzle ORM
- **Real-time State:** Cloudflare Durable Objects (planned for usage tracking)

## AI & Voice Services

- **Primary Voice AI:** Google Gemini Live API
- **Fallback Voice AI:** OpenAI Realtime API
- **Text AI:** Gemini 2.0 Flash (for corrections extraction)

## Authentication

- **Auth Library:** Better Auth
- **OAuth Providers:** Google OAuth
- **Magic Link:** Email OTP via Resend
- **Pattern:** Lazy initialization for Cloudflare Workers compatibility

## Payments

- **Payment Gateway:** Polar.sh
- **SDK:** `@polar-sh/sveltekit` (direct integration)
- **Webhooks:** `/api/polar/webhooks` endpoint

## Email

- **Provider:** Resend
- **Templates:** Custom HTML templates in `src/lib/server/email/`

## Infrastructure & Deployment

- **Hosting:** Cloudflare Pages
- **CDN:** Cloudflare (automatic)
- **DNS:** Cloudflare
- **CI/CD:** Cloudflare Pages automatic deployments from Git

## Development Tools

- **Linting:** ESLint with Svelte plugin
- **Formatting:** Prettier
- **Type Checking:** TypeScript strict mode
- **Local Dev:** Wrangler for D1 and Workers emulation

## Key Commands

```bash
# Development
pnpm --filter web dev              # Start dev server (port 5173)

# Build & Deploy
pnpm --filter web build            # Production build
pnpm --filter web run deploy:pages # Deploy to Cloudflare

# Database
pnpm wrangler d1 execute noi-hay-db --remote --command "..."
pnpm --filter web run generate     # Generate migrations
pnpm --filter web run migrate:prod # Run migrations
```

## Environment Variables

### Build-time (`apps/web/.env.production`)
- `PUBLIC_ORIGIN` - Site URL
- `PUBLIC_PROJECT_NAME` - Display name

### Runtime (Cloudflare Dashboard)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - OAuth
- `BETTER_AUTH_SECRET` - Auth encryption
- `GOOGLE_API_KEY` - Gemini API
- `OPENAI_API_KEY` - OpenAI fallback
- `RESEND_API_KEY`, `FROM_EMAIL` - Email
- `POLAR_ACCESS_TOKEN`, `POLAR_ORGANIZATION_ID`, `POLAR_WEBHOOK_SECRET` - Payments
