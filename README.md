# Speak Phở Real

A Vietnamese language learning app with AI-powered conversation practice.

**Live Site:** https://speakphoreal.com

## Tech Stack

- **Frontend**: SvelteKit 2 + Svelte 5 + Tailwind CSS
- **Backend**: Cloudflare Pages + Workers
- **Database**: Cloudflare D1 (SQLite) with Drizzle ORM
- **Auth**: Better Auth with Google OAuth + Email OTP (lazy initialization for CF Workers)
- **Payments**: Polar.sh via `@polar-sh/sveltekit` direct SDK
- **Voice**: OpenAI Realtime API with WebRTC
- **Email**: Resend

## Architecture Notes

### Better Auth on Cloudflare Workers

D1 bindings are only available at request time, not at module initialization. We use a **lazy initialization pattern**:

1. `setAuthEnv()` caches environment variables from `platform.env`
2. `getAuth()` creates the auth instance on first call
3. `hooks.server.ts` initializes both DB and auth env before handling requests

See [docs/ARCHITECTURE_UPDATED.md](docs/ARCHITECTURE_UPDATED.md) for full details.

### Polar.sh Payments

The `@polar-sh/better-auth` plugin is incompatible with Cloudflare Workers due to `createRequire()`. We use `@polar-sh/sveltekit` for direct SDK integration:

- Checkout: `src/routes/api/polar/checkout/+server.ts`
- Webhooks: `src/routes/api/polar/webhooks/+server.ts`

See [docs/Better-Auth_PolarSH_CFWorkers_Solutions&Alternatives.md](docs/Better-Auth_PolarSH_CFWorkers_Solutions&Alternatives.md) for the full analysis.

## Quick Start

```bash
# Install dependencies
pnpm install

# Run development server
pnpm --filter web dev

# Build for production
pnpm --filter web build

# Deploy to Cloudflare Pages
pnpm --filter web run deploy:pages
```

## Project Structure

```
apps/
  web/          # Main SvelteKit application
  api/          # API services
  voice/        # Voice processing services
packages/       # Shared packages
docs/           # Documentation
```

## Environment Variables

### Development (.env)
```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
BETTER_AUTH_SECRET=
RESEND_API_KEY=
FROM_EMAIL=
```

### Production (Cloudflare Dashboard)
Set these in Cloudflare Pages > Settings > Environment variables:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `BETTER_AUTH_SECRET`
- `RESEND_API_KEY`
- `FROM_EMAIL`
- `POLAR_ACCESS_TOKEN`
- `POLAR_ORGANIZATION_ID`
- `POLAR_WEBHOOK_SECRET`
- `OPENAI_API_KEY`

## Database

Using Cloudflare D1 with Drizzle ORM.

```bash
# View remote database
pnpm wrangler d1 execute noi-hay-db --remote --command "SELECT * FROM user;"

# Run migrations
pnpm --filter web run migrate:prod
```

## License

MIT
