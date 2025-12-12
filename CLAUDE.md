# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

**Speak Phở Real** - A Vietnamese language learning app with AI-powered conversation practice.

- **Live Site**: https://speakphoreal.com
- **Cloudflare Pages Project**: `speakphoreal`
- **D1 Database**: `noi-hay-db` (ID: `1b0a331d-eb7c-4835-96cd-e50f3a7f7a41`)

## Tech Stack

- **Framework**: SvelteKit 2 with Svelte 5
- **Styling**: Tailwind CSS + bits-ui components
- **Database**: Cloudflare D1 (SQLite) with Drizzle ORM
- **Auth**: Better Auth (Google OAuth + Email OTP)
- **Payments**: Polar.sh
- **Email**: Resend
- **Hosting**: Cloudflare Pages

## Common Commands

### Development
```bash
pnpm --filter web dev              # Run dev server (port 5173)
pnpm --filter web build            # Build for production
pnpm --filter web run deploy:pages # Deploy to Cloudflare Pages
```

### Database
```bash
# Query remote D1 database
pnpm wrangler d1 execute noi-hay-db --remote --command "SELECT * FROM user;"

# View table schema
pnpm wrangler d1 execute noi-hay-db --remote --command "PRAGMA table_info(user);"

# List all tables
pnpm wrangler d1 execute noi-hay-db --remote --command "SELECT name FROM sqlite_master WHERE type='table';"

# Generate migrations
pnpm --filter web run generate

# Run migrations
pnpm --filter web run migrate:prod
```

### Deployment Logs
```bash
# List deployments
pnpm wrangler pages deployment list --project-name speakphoreal

# Tail deployment logs (replace ID)
pnpm wrangler pages deployment tail <deployment-id> --project-name speakphoreal
```

## Project Structure

```
apps/
  web/                              # Main SvelteKit application
    src/
      lib/
        server/
          auth.ts                   # Better Auth configuration
          database/
            db.ts                   # D1 database connection
            schema.ts               # Drizzle schema definitions
          email/                    # Email templates (Resend)
        actions/
          authClient.js             # Client-side auth
        components/                 # Svelte components
      routes/
        (app)/                      # Authenticated routes
        (home)/                     # Public marketing pages
        (login)/                    # Auth pages
        api/                        # API endpoints
    hooks.server.ts                 # Server hooks (auth, db init)
    wrangler.toml                   # Cloudflare config
  api/                              # Additional API services
  voice/                            # Voice processing services
packages/                           # Shared packages
docs/                               # Documentation
```

## Database Schema

### Core Tables (Better Auth)
- `user` - User accounts
- `session` - Active sessions
- `account` - OAuth provider links (Google)
- `verification` - OTP/email verification tokens

### Business Tables
- `product` - Products from Polar
- `subscription` - User subscriptions

## Environment Variables

### Build-time (apps/web/.env.production)
```
PUBLIC_ORIGIN=https://speakphoreal.com
PUBLIC_PROJECT_NAME="Speak Phở Real"
```

### Runtime (Cloudflare Dashboard)
Must be set in Cloudflare Pages > Settings > Environment variables:
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `BETTER_AUTH_SECRET` - Auth encryption secret
- `RESEND_API_KEY` - Email service API key
- `FROM_EMAIL` - Sender email address
- `POLAR_ACCESS_TOKEN` - Polar.sh API token
- `POLAR_ORGANIZATION_ID` - Polar organization ID
- `POLAR_WEBHOOK_SECRET` - Polar webhook secret
- `OPENAI_API_KEY` - OpenAI API key

**Important**: `$env/static/private` variables are resolved at build time. For runtime secrets on Cloudflare Workers, use `platform.env` and pass them via `setAuthEnv()`.

## Auth Architecture

Better Auth is configured with lazy initialization because:
1. D1 database binding is only available at runtime via `platform.env`
2. Environment variables must be passed from `hooks.server.ts`

```typescript
// hooks.server.ts
setAuthEnv({
  GOOGLE_CLIENT_ID: env?.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: env?.GOOGLE_CLIENT_SECRET,
  BETTER_AUTH_SECRET: env?.BETTER_AUTH_SECRET
});
const auth = getAuth();
```

## Key Files

- `apps/web/src/hooks.server.ts` - Server hooks, DB/auth initialization
- `apps/web/src/lib/server/auth.ts` - Better Auth config
- `apps/web/src/lib/server/database/schema.ts` - Drizzle schema
- `apps/web/wrangler.toml` - Cloudflare Workers config
- `apps/web/.env.production` - Build-time env vars

## Notes

- The `admin()` plugin requires `banned`, `banReason`, `banExpires` columns on user table
- Session table must have camelCase columns: `expiresAt`, `userId`, `ipAddress`, `userAgent`
- Polar.sh Better Auth plugin is temporarily disabled due to Cloudflare Workers compatibility issues
