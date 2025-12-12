# Speak Phở Real

A Vietnamese language learning app with AI-powered conversation practice.

**Live Site:** https://speakphoreal.com

## Tech Stack

- **Frontend**: SvelteKit 2 + Svelte 5 + Tailwind CSS
- **Backend**: Cloudflare Pages + Workers
- **Database**: Cloudflare D1 (SQLite) with Drizzle ORM
- **Auth**: Better Auth with Google OAuth + Email OTP
- **Payments**: Polar.sh integration
- **Email**: Resend

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
