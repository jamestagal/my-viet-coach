# Tech Stack

## Overview

Speak Pho Real is built on a modern edge-first architecture using Cloudflare's platform for hosting, database, and real-time state management. The application uses SvelteKit for the web framework with AI voice capabilities powered by Google Gemini and OpenAI.

---

## Frontend

### Framework
- **SvelteKit 2** with **Svelte 5** - Full-stack web framework with server-side rendering
- **TypeScript** - Type-safe JavaScript throughout the codebase

### Styling & UI
- **Tailwind CSS** - Utility-first CSS framework
- **bits-ui** - Headless component library for Svelte (similar to Radix UI)
- **Custom components** - Built on top of bits-ui primitives

### State Management
- **Svelte 5 runes** - Native reactive state (`$state`, `$derived`, `$effect`)
- **Stores** - For shared application state

---

## Backend & API

### Runtime & Hosting
- **Cloudflare Pages** - Edge hosting for SvelteKit application
- **Cloudflare Workers** - Serverless functions for API routes
- **Cloudflare Durable Objects** - Real-time usage tracking and session state (planned)

### API Framework
- **SvelteKit API routes** - Primary API endpoints in `+server.ts` files
- **Hono** - Lightweight router for dedicated API worker (apps/api)

### Validation
- **Zod** - Schema validation for API inputs

---

## Database & Storage

### Primary Database
- **Cloudflare D1** - SQLite-based serverless database
- **Database name**: `noi-hay-db`
- **Database ID**: `1b0a331d-eb7c-4835-96cd-e50f3a7f7a41`

### ORM
- **Drizzle ORM** - Type-safe SQL query builder and schema management
- **drizzle-kit** - Migration generation and management

### Schema Tables
- `user` - User accounts (Better Auth)
- `session` - Active sessions (Better Auth)
- `account` - OAuth provider links (Better Auth)
- `verification` - OTP/email verification tokens (Better Auth)
- `product` - Products from Polar
- `subscription` - User subscriptions
- `usage_periods` - Monthly usage records (planned)
- `usage_sessions` - Individual session logs (planned)
- `session_messages` - Conversation history (planned)
- `session_corrections` - Learning corrections (planned)

---

## AI & Voice Services

### Primary Voice Provider
- **Google Gemini Live API** (`@google/genai`) - Real-time voice conversations
- **Model**: Gemini 2.0 Flash with native audio

### Fallback Voice Provider
- **OpenAI Realtime API** - Backup for connection failures
- **Model**: GPT-4o Realtime

### Voice Features
- Real-time speech-to-text transcription
- AI-generated spoken responses
- Automatic provider fallback on disconnect
- Conversation history preservation across switches

---

## Authentication

### Framework
- **Better Auth** - Modern authentication library
- **Lazy initialization** - Required for Cloudflare Workers runtime

### Methods
- **Google OAuth** - Primary social login
- **Email OTP** - Magic link / one-time password authentication

### Environment Variables
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `BETTER_AUTH_SECRET`

---

## Payments & Subscriptions

### Payment Provider
- **Polar.sh** - Subscription billing and checkout

### Integration
- **Better Auth Polar plugin** - (temporarily disabled for Workers compatibility)
- **Webhook handlers** - Subscription lifecycle events
- **Service bindings** - Cross-worker communication for DO updates

### Subscription Plans
| Plan | Price | Minutes/Month |
|------|-------|---------------|
| Free | $0 | 10 |
| Basic | $15 | 100 |
| Pro | $25 | 500 |

### Environment Variables
- `POLAR_ACCESS_TOKEN`
- `POLAR_ORGANIZATION_ID`
- `POLAR_WEBHOOK_SECRET`

---

## Email

### Provider
- **Resend** - Transactional email service

### Use Cases
- Email OTP authentication
- Welcome emails
- Subscription notifications

### Environment Variables
- `RESEND_API_KEY`
- `FROM_EMAIL`

---

## Infrastructure

### DNS & CDN
- **Cloudflare** - DNS, SSL, CDN, DDoS protection

### Domains
- **Production**: https://speakphoreal.com
- **Cloudflare Pages project**: `speakphoreal`

### Configuration
- **wrangler.toml** - Cloudflare Workers/Pages configuration
- **Environment variables** - Set in Cloudflare Dashboard (runtime secrets)
- **Build-time variables** - Set in `.env.production`

---

## Development Tools

### Package Manager
- **pnpm** - Fast, disk space efficient package manager
- **Monorepo** - Workspace-based project structure

### Code Quality
- **TypeScript** - Static type checking
- **ESLint** - JavaScript/TypeScript linting
- **Prettier** - Code formatting

### Build & Deploy
- **Vite** - Build tool (via SvelteKit)
- **wrangler** - Cloudflare CLI for deployments

### Common Commands
```bash
# Development
pnpm --filter web dev              # Run dev server (port 5173)
pnpm --filter web build            # Build for production
pnpm --filter web run deploy:pages # Deploy to Cloudflare Pages

# Database
pnpm --filter web run generate     # Generate migrations
pnpm --filter web run migrate:prod # Run migrations

# Deployment logs
pnpm wrangler pages deployment list --project-name speakphoreal
pnpm wrangler pages deployment tail <deployment-id> --project-name speakphoreal
```

---

## Project Structure

```
apps/
  web/                    # Main SvelteKit application
    src/
      lib/
        server/
          auth.ts         # Better Auth configuration
          database/
            db.ts         # D1 database connection
            schema.ts     # Drizzle schema definitions
          email/          # Email templates (Resend)
        actions/
          authClient.js   # Client-side auth
        components/       # Svelte components
      routes/
        (app)/            # Authenticated routes
        (home)/           # Public marketing pages
        (login)/          # Auth pages
        api/              # API endpoints
    hooks.server.ts       # Server hooks (auth, db init)
    wrangler.toml         # Cloudflare config
  api/                    # Additional API services (Hono)
  voice/                  # Voice processing services
packages/                 # Shared packages
docs/                     # Documentation
agent-os/                 # Product planning & specs
```

---

## Environment Variables Summary

### Build-Time (apps/web/.env.production)
```
PUBLIC_ORIGIN=https://speakphoreal.com
PUBLIC_PROJECT_NAME="Speak Pho Real"
```

### Runtime (Cloudflare Dashboard)
```
# Auth
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
BETTER_AUTH_SECRET

# Email
RESEND_API_KEY
FROM_EMAIL

# Payments
POLAR_ACCESS_TOKEN
POLAR_ORGANIZATION_ID
POLAR_WEBHOOK_SECRET

# AI
OPENAI_API_KEY
GOOGLE_AI_API_KEY
```
