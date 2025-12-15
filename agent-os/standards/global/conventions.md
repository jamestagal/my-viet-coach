# Development Conventions - Speak Phở Real

Project structure, naming patterns, and workflow standards.

## Project Structure

```
apps/
  web/                              # Main SvelteKit application
    src/
      lib/
        server/                     # Server-only code
          auth.ts                   # Better Auth configuration
          database/
            db.ts                   # D1 database connection
            schema.ts               # Drizzle schema definitions
          email/                    # Email templates (Resend)
          utils/                    # Server utilities
        actions/                    # Client-side auth
        components/                 # Reusable Svelte components
        voice/                      # Voice client abstraction
      routes/
        (app)/                      # Authenticated routes (dashboard, practice, settings)
        (home)/                     # Public marketing pages
        (login)/                    # Auth pages (login, signup)
        api/
          private/                  # Authenticated API endpoints
          public/                   # Public API endpoints
          polar/                    # Polar.sh webhooks
    hooks.server.ts                 # Server hooks (auth, db init)
    wrangler.toml                   # Cloudflare config
  api/                              # Separate API worker (Hono)
  voice/                            # Voice processing services
packages/                           # Shared packages
docs/                               # Architecture documentation
agent-os/                           # AI agent standards and specs
```

## Route Groups

SvelteKit route groups organize layouts:

- `(app)/` - Authenticated routes with app layout (sidebar, header)
- `(home)/` - Public pages with marketing layout
- `(login)/` - Auth pages with minimal layout

## File Naming

| Type | Pattern | Example |
|------|---------|---------|
| Routes | `+page.svelte`, `+layout.svelte` | `src/routes/(app)/dashboard/+page.svelte` |
| Server routes | `+server.ts` | `src/routes/api/private/session/+server.ts` |
| Components | PascalCase | `Modal.svelte`, `VoiceOrb.svelte` |
| Utilities | camelCase | `formatDate.ts`, `validateEmail.ts` |
| Classes | PascalCase | `VoiceClient.ts`, `RealtimeClient.ts` |
| Config | kebab-case | `wrangler.toml`, `drizzle.config.ts` |

## API Endpoint Conventions

- **Private endpoints:** `/api/private/*` - Require authentication
- **Public endpoints:** `/api/public/*` - No authentication required
- **Webhooks:** `/api/polar/webhooks`, `/api/auth/*`

```typescript
// +server.ts pattern
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  const session = locals.session;
  if (!session) throw error(401, 'Unauthorized');

  const data = await request.json();
  // ... handle request

  return json({ success: true, data });
};
```

## Environment Configuration

- **Build-time:** `$env/static/private` and `$env/static/public`
- **Runtime:** Access via `platform.env` in hooks/endpoints
- **Never commit:** `.env` files with secrets

```typescript
// For Cloudflare Workers runtime secrets
const apiKey = platform?.env?.GOOGLE_API_KEY;
```

## Git Workflow

- **Main branch:** `main` (production)
- **Commit messages:** Descriptive, present tense ("Add voice fallback", "Fix auth redirect")
- **No long-lived branches:** Merge features quickly

## Documentation

- `CLAUDE.md` - AI assistant context (commands, structure, notes)
- `README.md` - Project overview and quick start
- `docs/` - Detailed architecture documents
- `agent-os/specs/` - Feature specifications

## Version Control

- Commit logical chunks (one feature/fix per commit)
- Don't commit generated files (`.svelte-kit/`, `node_modules/`)
- Keep `wrangler.toml` in version control (no secrets)
