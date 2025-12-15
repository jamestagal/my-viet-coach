# Better-Auth and Polar.sh on Cloudflare Workers: Solutions and Alternatives

> **Status (December 2024):** ✅ Implemented. Using Better Auth 1.4.6 with lazy initialization pattern and `@polar-sh/sveltekit` direct SDK integration. The `@polar-sh/better-auth` plugin remains disabled.

The "createRequire" error plaguing your SvelteKit deployment stems from the `@polar-sh/better-auth` plugin—not better-auth itself. **Better-auth 1.4.x also has breaking changes for Cloudflare Workers**, but a clear solution path exists: downgrade better-auth to v1.3.7 and bypass the Polar plugin entirely using direct SDK integration with `@polar-sh/sveltekit` or `@polar-sh/hono`.

## The root cause and immediate fix

The `createRequire` error occurs because Node.js's `module.createRequire()` API is unavailable in Cloudflare Workers even with the `nodejs_compat` flag. The `@polar-sh/better-auth` plugin imports dependencies that use this API at module load time—before your code even executes.

**Two compounding issues exist:**
1. The Polar better-auth plugin has Node.js-only dependencies
2. Better-auth 1.4.x introduced a separate `runWithRequestState` error affecting Cloudflare Workers (GitHub issue #6613)

**Immediate fix:** Downgrade to `better-auth@1.3.7` (confirmed working) and remove the `@polar-sh/better-auth` plugin. Add these flags to `wrangler.toml`:

```toml
compatibility_flags = ["nodejs_compat"]
compatibility_date = "2024-09-23"
```

## The better-auth-cloudflare package simplifies D1 integration

A community package called **`better-auth-cloudflare`** (v0.2.9, 376+ GitHub stars) provides Cloudflare-optimized wrappers for better-auth. It includes D1 support via Drizzle ORM, KV storage for session caching, R2 file storage, automatic geolocation tracking from Cloudflare headers, and a CLI for scaffolding projects.

The package provides a `withCloudflare()` helper that handles the complexity of D1 bindings (which are only available in request context):

```typescript
import { betterAuth } from "better-auth";
import { withCloudflare } from "better-auth-cloudflare";
import { drizzle } from "drizzle-orm/d1";

export const createAuth = (env: Env, cf?: IncomingRequestCfProperties) => {
  const db = drizzle(env.DATABASE, { schema });
  return betterAuth({
    ...withCloudflare({
      d1: { db, options: { usePlural: true } },
      kv: env.KV,
      cf: cf || {},
    }, {
      emailAndPassword: { enabled: true },
      plugins: [emailOTP()],
      socialProviders: {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        }
      }
    }),
  });
};
```

## Polar.sh works without the plugin via direct SDK integration

The core `@polar-sh/sdk` uses native Fetch API and is explicitly designed for "serverless runtimes where application bundle size is a primary concern." The problem was the better-auth plugin wrapper, not Polar itself.

**Use `@polar-sh/sveltekit` for your stack:** This package provides ready-made handlers for checkouts, webhooks, and customer portals. Install with `pnpm install @polar-sh/sveltekit zod`.

For checkout (`src/routes/api/checkout/+server.ts`):
```typescript
import { Checkout } from "@polar-sh/sveltekit";

export const GET = Checkout({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  successUrl: "/success?checkout_id={CHECKOUT_ID}",
  server: "production",
});
```

For webhooks (`src/routes/api/webhooks/polar/+server.ts`):
```typescript
import { Webhooks } from "@polar-sh/sveltekit";

export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,
  onOrderPaid: async (payload) => {
    const userId = payload.data.customer.externalId;
    // Update user subscription in D1
  },
  onSubscriptionCanceled: async (payload) => {
    // Handle cancellation
  },
});
```

**Link Polar customers to better-auth users** using `external_customer_id`—set it to your better-auth user ID when creating checkouts. Query subscription status via `polar.customers.stateExternal({ externalId: userId })`.

## Alternative auth solutions if better-auth remains problematic

| Solution | D1 Support | Email OTP | Google OAuth | Edge Compatible | Status |
|----------|------------|-----------|--------------|-----------------|--------|
| **Better Auth** | ✅ Drizzle/Kysely | ✅ Built-in | ✅ 50+ providers | ✅ (v1.3.7) | Active |
| **Auth.js** | ✅ @auth/d1-adapter | ⚠️ Limited | ✅ | ✅ | Now under Better Auth Inc. |
| **Lucia Auth** | ❌ | ❌ | ❌ | ❌ | **Deprecated March 2025** |
| **Clerk/Supabase** | ❌ Uses own DB | ✅ | ✅ | ✅ | Active |

**Better-auth remains the best choice** for your requirements. Lucia Auth is deprecated (announced late 2024, maintenance ends March 2025). Auth.js works but is now part of Better Auth Inc. Managed services like Clerk and Supabase Auth don't support D1 as the auth database—they use their own cloud infrastructure.

For email OTP on Cloudflare Workers free tier, better-auth's built-in Email OTP plugin is **CPU-efficient** compared to password hashing (scrypt takes ~80ms, which can exceed free tier CPU limits).

## Stripe is the safest payment alternative if Polar issues persist

Stripe has an **official Cloudflare partnership** and native SDK support since v11.10.0. Key configuration for Workers:

```typescript
import Stripe from 'stripe';

const webCrypto = Stripe.createSubtleCryptoProvider();

export function createStripeClient(secretKey: string) {
  return new Stripe(secretKey, {
    httpClient: Stripe.createFetchHttpClient(), // Critical: not Node's http
  });
}

// Webhook verification must use async method
const event = await stripe.webhooks.constructEventAsync(
  await request.text(),
  sig,
  webhookSecret,
  undefined,
  webCrypto  // WebCrypto is async, unlike Node crypto
);
```

**Lemon Squeezy** is another option if you want Merchant of Record (handles tax compliance). It works on Cloudflare Workers without `nodejs_compat` using manual WebCrypto webhook verification, though no official edge SDK exists.

## Recommended implementation path

**Step 1:** Downgrade better-auth and remove Polar plugin
```bash
npm install better-auth@1.3.7
npm uninstall @polar-sh/better-auth
npm install @polar-sh/sveltekit @polar-sh/sdk
```

**Step 2:** Update `wrangler.toml`
```toml
compatibility_flags = ["nodejs_compat"]
compatibility_date = "2024-09-23"
```

**Step 3:** Create dynamic auth instance for D1 bindings
```typescript
// src/lib/server/auth.ts
export const createAuth = (env: Env) => {
  const db = drizzle(env.DB, { schema });
  return betterAuth({
    database: drizzleAdapter(db, { provider: "sqlite" }),
    plugins: [emailOTP()],
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      }
    }
  });
};
```

**Step 4:** Add Polar routes using `@polar-sh/sveltekit` handlers for `/api/checkout`, `/api/webhooks/polar`, and optionally `/api/portal` for customer management.

**Step 5:** In webhook handlers, use `payload.data.customer.externalId` (set during checkout creation to your user ID) to link payments to better-auth users and update subscription status in your D1 database.

## Conclusion

The "createRequire" error is solvable by decoupling Polar from better-auth's plugin system. The `@polar-sh/sveltekit` adapter provides all the functionality you need—checkout, webhooks, subscription management—without Node.js dependencies. Combined with downgrading to better-auth v1.3.7 and using the `better-auth-cloudflare` community package for D1 integration, you have a production-ready path forward. Monitor better-auth GitHub issue #6613 for when v1.4.x becomes Cloudflare-compatible again.

---

## Implementation Notes (December 2024)

### What We Actually Implemented

1. **Better Auth 1.4.6** - We stayed on 1.4.6 (not downgrading to 1.3.7) by using a lazy initialization pattern that works around the D1 binding timing issue.

2. **Lazy Initialization Pattern** - Instead of creating the auth instance at module load, we:
   - Cache environment variables via `setAuthEnv()` in hooks
   - Create the auth instance on first `getAuth()` call
   - Reset the instance when env changes

3. **`@polar-sh/sveltekit` Direct SDK** - API routes at:
   - `/api/polar/checkout/+server.ts` - Checkout handler
   - `/api/polar/webhooks/+server.ts` - Webhook handler

4. **Disabled `@polar-sh/better-auth`** - Plugin remains commented out in `src/lib/server/auth.ts` with explanation comments.

### Key Files

- `src/lib/server/auth.ts` - Auth configuration with lazy init
- `src/hooks.server.ts` - DB and auth env initialization
- `src/routes/api/polar/` - Direct Polar SDK routes
- `wrangler.toml` - `nodejs_compat` flag and D1 bindings