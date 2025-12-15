# Payment Webhook Handlers - Polar (Primary) + Stripe (Alternative)

## Polar Webhook Handler (Primary)

Your project uses **Polar.sh** as the payment gateway. The existing webhook handler at `apps/web/src/routes/api/polar/webhooks/+server.ts` needs to be extended to also update the Durable Object when subscriptions change.

### How It Works

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────────────┐
│   Polar.sh   │────▶│ Webhook Handler │────▶│  Update D1 Database  │
│ (Subscription│     │ /api/polar/     │     │  (existing code)     │
│   Change)    │     │   webhooks      │     └──────────────────────┘
└──────────────┘     └────────┬────────┘
                              │
                              ▼
                     ┌──────────────────────┐
                     │ Update Durable Object │  ← NEW!
                     │ (instant plan change) │
                     └──────────────────────┘
```

### Update the Polar Webhook Utility

Modify `apps/web/src/lib/server/utils/polar.ts` to include Durable Object updates:

```typescript
// apps/web/src/lib/server/utils/polar.ts
// ADD these new exports and functions to your existing file

// ════════════════════════════════════════════════════════════════════════════
// PLAN MAPPING (add this section)
// ════════════════════════════════════════════════════════════════════════════

// Map Polar product metadata.plan to usage plan types
export type UsagePlanType = 'free' | 'basic' | 'pro';

export const PLAN_MAPPING: Record<string, UsagePlanType> = {
  'free': 'free',
  'basic': 'basic',
  'starter': 'basic',     // Alias
  'pro': 'pro',
  'premium': 'pro',       // Alias
  'enterprise': 'pro',    // Treat enterprise as pro for usage limits
};

export function mapPolarPlanToUsagePlan(polarPlan: string | null | undefined): UsagePlanType {
  if (!polarPlan) return 'free';
  return PLAN_MAPPING[polarPlan.toLowerCase()] ?? 'free';
}

// ════════════════════════════════════════════════════════════════════════════
// DURABLE OBJECT INTEGRATION (add this section)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Update the UserUsageObject when a subscription changes
 * This ensures real-time plan enforcement without database lookups
 */
export async function updateUserUsageDO(
  env: App.Platform['env'],
  userId: string,
  plan: UsagePlanType,
  action: 'upgrade' | 'downgrade' | 'cancel'
): Promise<void> {
  try {
    // Access the Durable Object namespace from the platform env
    const USER_USAGE = env.USER_USAGE;
    
    if (!USER_USAGE) {
      console.warn('[Polar→DO] USER_USAGE binding not available, skipping DO update');
      return;
    }
    
    const id = USER_USAGE.idFromName(userId);
    const stub = USER_USAGE.get(id);
    
    switch (action) {
      case 'upgrade':
        await stub.upgradePlan(plan);
        console.log(`[Polar→DO] Upgraded user ${userId} to ${plan} plan`);
        break;
        
      case 'downgrade':
      case 'cancel':
        await stub.downgradePlan('free');
        console.log(`[Polar→DO] Downgraded user ${userId} to free plan`);
        break;
    }
  } catch (error) {
    // User might not be initialized yet - this is OK
    // The DO will be initialized with the correct plan on first use
    console.log(`[Polar→DO] User ${userId} not initialized, plan will be set on first use`);
  }
}
```

### Update the handleWebhook.onSubscriptionUpdated Function

Add DO integration to your existing `onSubscriptionUpdated` handler:

```typescript
// In apps/web/src/lib/server/utils/polar.ts
// MODIFY the existing onSubscriptionUpdated function

export const handleWebhook = {
  /**
   * Handle subscription created/updated/canceled
   * Now also updates the Durable Object for real-time plan enforcement
   */
  onSubscriptionUpdated: async (event: unknown, platform?: App.Platform) => {
    try {
      const webhookEvent = event as SubscriptionWebhookEvent;
      
      if (!webhookEvent?.data) {
        console.error('[Polar Webhook] Missing subscription data');
        return;
      }
      
      const subscriptionData = webhookEvent.data;
      const userId = subscriptionData.customer?.externalId; // Your user ID
      const polarProductId = subscriptionData.product?.id;
      const status = subscriptionData.status;
      
      if (!userId || !status) {
        console.error('[Polar Webhook] Missing userId or status');
        return;
      }
      
      const db = getDb();
      
      // Find the product to get the plan type
      const productRecord = await db
        .select()
        .from(product)
        .where(eq(product.polarProductId, polarProductId || ''))
        .limit(1);
      
      const productData = productRecord[0];
      const plan = mapPolarPlanToUsagePlan(productData?.plan);
      
      // ══════════════════════════════════════════════════════════════════════
      // NEW: UPDATE DURABLE OBJECT
      // ══════════════════════════════════════════════════════════════════════
      
      if (platform?.env) {
        const isActive = status === 'active' || status === 'trialing';
        const isCanceled = status === 'canceled' || status === 'incomplete_expired';
        
        if (isActive) {
          await updateUserUsageDO(platform.env, userId, plan, 'upgrade');
        } else if (isCanceled) {
          await updateUserUsageDO(platform.env, userId, 'free', 'cancel');
        }
      } else {
        console.warn('[Polar Webhook] Platform not available, DO not updated');
      }
      
      // ══════════════════════════════════════════════════════════════════════
      // EXISTING: UPDATE D1 DATABASE
      // ══════════════════════════════════════════════════════════════════════
      
      // ... keep all your existing subscription update logic here ...
      
    } catch (error) {
      console.error('[Polar Webhook] Error:', error);
    }
  },
  
  // ... other handlers remain unchanged ...
};
```

### Update the Webhook Endpoint

Update `apps/web/src/routes/api/polar/webhooks/+server.ts` to pass the platform context:

```typescript
// apps/web/src/routes/api/polar/webhooks/+server.ts

import { Webhooks } from '@polar-sh/sveltekit';
import { env } from '$env/dynamic/private';
import { handleWebhook } from '$lib/server/utils/polar';
import type { RequestEvent } from '@sveltejs/kit';

export const POST = async (event: RequestEvent) => {
  // Capture platform for DO access in webhook handlers
  const platform = event.platform;
  
  const webhookHandler = Webhooks({
    webhookSecret: env.POLAR_WEBHOOK_SECRET || '',

    onSubscriptionCreated: async (payload) => {
      console.log('[Polar Webhook] subscription.created:', payload.data.id);
      await handleWebhook.onSubscriptionUpdated(payload, platform);
    },

    onSubscriptionUpdated: async (payload) => {
      console.log('[Polar Webhook] subscription.updated:', payload.data.id);
      await handleWebhook.onSubscriptionUpdated(payload, platform);
    },

    onSubscriptionCanceled: async (payload) => {
      console.log('[Polar Webhook] subscription.canceled:', payload.data.id);
      await handleWebhook.onSubscriptionUpdated(payload, platform);
    },

    onOrderPaid: async (payload) => {
      console.log('[Polar Webhook] order.paid:', payload.data.id);
      await handleWebhook.onOrderPaid(payload);
    },

    onProductUpdated: async (payload) => {
      console.log('[Polar Webhook] product.updated:', payload.data.id);
      await handleWebhook.onProductUpdated(payload);
    }
  });
  
  return webhookHandler(event);
};
```

### Type Definitions for Durable Object Binding

Add the USER_USAGE binding to your app types in `apps/web/src/app.d.ts`:

```typescript
// apps/web/src/app.d.ts

declare global {
  namespace App {
    interface Platform {
      env: {
        DB: D1Database;
        USER_USAGE: DurableObjectNamespace;
        POLAR_ACCESS_TOKEN?: string;
        POLAR_WEBHOOK_SECRET?: string;
        // ... other bindings
      };
      context: ExecutionContext;
      caches: CacheStorage & { default: Cache };
    }
  }
}

export {};
```

### Wrangler Configuration (SvelteKit App)

Update `apps/web/wrangler.toml` to include the Durable Object binding:

```toml
# apps/web/wrangler.toml

name = "speakphoreal"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]

# D1 Database
[[d1_databases]]
binding = "DB"
database_name = "noi-hay-db"
database_id = "1b0a331d-eb7c-4835-96cd-e50f3a7f7a41"

# Durable Object binding (from the API worker)
# This uses a service binding to access DOs from another worker
[[services]]
binding = "USER_USAGE_SERVICE"
service = "viet-coach-api"

# OR if hosting DO in same worker:
# [[durable_objects.bindings]]
# name = "USER_USAGE"
# class_name = "UserUsageObject"
```

> **Note**: Since your SvelteKit app runs on Cloudflare Pages and the Durable Object lives in a separate Worker (`viet-coach-api`), you'll need to use a **Service Binding** to communicate between them. See the [Service Bindings section](#service-bindings-for-cross-worker-do-access) below.

---

## Service Bindings for Cross-Worker DO Access

Since your architecture has:
- **SvelteKit app** → Cloudflare Pages (receives Polar webhooks)
- **API Worker** → Contains the UserUsageObject Durable Object

You need a service binding to allow the Pages function to call the API worker:

### Option A: Call API Endpoint from Webhook

The simplest approach - call your API worker's endpoint:

```typescript
// apps/web/src/lib/server/utils/polar.ts

export async function updateUserUsageDO(
  env: App.Platform['env'],
  userId: string,
  plan: UsagePlanType,
  action: 'upgrade' | 'downgrade' | 'cancel'
): Promise<void> {
  try {
    // Call the API worker endpoint instead of direct DO access
    const apiUrl = env.API_URL || 'https://viet-coach-api.your-subdomain.workers.dev';
    
    const response = await fetch(`${apiUrl}/api/internal/update-plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': env.INTERNAL_API_SECRET || '',
      },
      body: JSON.stringify({ userId, plan, action }),
    });
    
    if (!response.ok) {
      console.error('[Polar→DO] API call failed:', await response.text());
    } else {
      console.log(`[Polar→DO] Updated user ${userId} to ${plan} plan via API`);
    }
  } catch (error) {
    console.error('[Polar→DO] Error calling API:', error);
  }
}
```

Then add the internal endpoint to your API worker:

```typescript
// apps/api/worker/routes/internal.ts

import { Hono } from 'hono';

const app = new Hono<{ Bindings: Env }>();

// Internal endpoint for cross-worker DO updates
app.post('/api/internal/update-plan', async (c) => {
  // Verify internal secret
  const secret = c.req.header('X-Internal-Secret');
  if (secret !== c.env.INTERNAL_API_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const { userId, plan, action } = await c.req.json();
  
  const id = c.env.USER_USAGE.idFromName(userId);
  const stub = c.env.USER_USAGE.get(id);
  
  try {
    if (action === 'upgrade') {
      await stub.upgradePlan(plan);
    } else {
      await stub.downgradePlan('free');
    }
    return c.json({ success: true });
  } catch {
    // User not initialized yet
    return c.json({ success: true, note: 'User will be initialized on first use' });
  }
});

export default app;
```

### Option B: Service Binding (Direct DO Access)

For lower latency, use a service binding:

```toml
# apps/web/wrangler.toml
[[services]]
binding = "API_WORKER"
service = "viet-coach-api"
```

```typescript
// Then in your webhook handler:
const response = await env.API_WORKER.fetch(
  new Request('https://internal/update-plan', {
    method: 'POST',
    body: JSON.stringify({ userId, plan, action }),
  })
);
```

---

## Stripe Webhook Handler (Alternative)

If you decide to use Stripe instead of or in addition to Polar, here's the equivalent implementation for a Hono-based API worker:

```typescript
// apps/api/worker/routes/stripe-webhook.ts

import { Hono } from 'hono';
import Stripe from 'stripe';

const app = new Hono<{ Bindings: Env }>();

// Map Stripe price IDs to plans
const PRICE_TO_PLAN: Record<string, 'free' | 'basic' | 'pro'> = {
  'price_basic_monthly': 'basic',
  'price_pro_monthly': 'pro',
};

app.post('/api/webhooks/stripe', async (c) => {
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY);
  const signature = c.req.header('stripe-signature');
  
  if (!signature) {
    return c.json({ error: 'Missing signature' }, 400);
  }
  
  let event: Stripe.Event;
  
  try {
    const body = await c.req.text();
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      c.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return c.json({ error: 'Invalid signature' }, 400);
  }
  
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata.userId;
      
      if (!userId) {
        console.error('No userId in subscription metadata');
        break;
      }
      
      const priceId = subscription.items.data[0]?.price.id;
      const newPlan = PRICE_TO_PLAN[priceId] ?? 'free';
      
      // Update Durable Object
      const id = c.env.USER_USAGE.idFromName(userId);
      const stub = c.env.USER_USAGE.get(id);
      
      try {
        await stub.upgradePlan(newPlan);
        console.log(`[Stripe] Updated user ${userId} to ${newPlan}`);
      } catch {
        console.log(`[Stripe] User ${userId} not initialized yet`);
      }
      
      break;
    }
    
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata.userId;
      
      if (userId) {
        const id = c.env.USER_USAGE.idFromName(userId);
        const stub = c.env.USER_USAGE.get(id);
        
        try {
          await stub.downgradePlan('free');
          console.log(`[Stripe] Downgraded user ${userId} to free`);
        } catch {
          // User might not exist
        }
      }
      
      break;
    }
  }
  
  return c.json({ received: true });
});

export default app;
```

---

## Summary: Polar vs Stripe Integration

| Aspect | Polar (Your Setup) | Stripe (Alternative) |
|--------|-------------------|---------------------|
| **Webhook Location** | `apps/web/src/routes/api/polar/webhooks/` | `apps/api/worker/routes/stripe-webhook.ts` |
| **SDK** | `@polar-sh/sveltekit` | `stripe` |
| **User ID Source** | `customer.externalId` | `subscription.metadata.userId` |
| **Plan Source** | `product.metadata.plan` | Price ID mapping |
| **DO Access** | Via API call or service binding | Direct (same worker) |
