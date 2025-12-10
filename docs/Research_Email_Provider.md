# Choosing the Best Email Provider for SvelteKit on Cloudflare Workers

**Resend is the clear winner for your use case.** It's the only provider with native SDK support in Cloudflare Workers' edge runtime, offers a generous 3,000 emails/month free tier, and provides excellent developer experience that matches modern SvelteKit workflows. For a solo developer starting an MVP with commercial ambitions, Resend offers the smoothest path from zero to scale.

## The critical Cloudflare Workers compatibility issue

Most email providers' JavaScript SDKs **do not work** in Cloudflare Workers' edge runtime. This is the single most important factor in your decision. Workers run on V8 isolates—not Node.js—so any SDK relying on Node.js APIs (`fs`, `http2`, `crypto`) will fail. Only **Resend's SDK works natively**. All other providers require using their HTTP REST API directly via `fetch()`, which adds development overhead.

| Provider | SDK Status on Workers | Integration Method |
|----------|----------------------|-------------------|
| **Resend** | ✅ Works natively | `npm install resend` → direct SDK use |
| Postmark | ❌ SDK broken | HTTP API via `fetch()` |
| SendGrid | ❌ SDK broken | HTTP API via `fetch()` |
| Mailgun | ❌ SDK broken | HTTP API via `fetch()` |
| Amazon SES | ❌ SDK broken | `aws4fetch` library for request signing |

Cloudflare maintains official tutorials for both Resend (SDK) and Postmark (HTTP API), confirming these as their recommended options.

## Free tier comparison: Loops leads, but with caveats

For pure volume, **Loops offers 4,000 emails/month**—the most generous free tier. However, Resend's **3,000/month** comes with critical advantages for Cloudflare Workers deployments. The daily limits matter more than monthly totals for MVP testing: Resend caps at 100/day while Mailjet restricts to 200/day, both manageable for development.

| Provider | Free Emails | Daily Limit | Time Limit | Credit Card |
|----------|-------------|-------------|------------|-------------|
| **Loops** | 4,000/mo | None stated | Permanent | No |
| **Resend** | 3,000/mo | 100/day | Permanent | No |
| **Mailgun** | 3,000/mo | 100/day | Permanent | No |
| **Mailjet** | 6,000/mo | 200/day | Permanent | No |
| **Brevo** | 9,000/mo | 300/day | Permanent | No |
| SendGrid | 3,000/mo | 100/day | Permanent | No |
| Postmark | **100/mo** | None | Permanent | No |
| Amazon SES | 3,000/mo | N/A | **12 months only** | Yes |

Postmark's free tier is notably restrictive at only 100 emails/month—impractical even for light testing. Amazon SES offers excellent pricing but requires an AWS account and expires after 12 months.

## Pricing progression from free to commercial scale

Scaling cost-effectively matters if your MVP succeeds. At **10,000 emails/month**, most providers cluster around $15-20/month except Amazon SES at ~$1. At **100,000 emails/month**, SES dominates at ~$10 while others range from $65-90.

| Volume | Resend | Postmark | SendGrid | Mailgun | Amazon SES |
|--------|--------|----------|----------|---------|------------|
| 3,000/mo | Free | $15 | Free | Free | Free (12mo) |
| 10,000/mo | $20 | $15 | $19.95 | $15 | ~$1 |
| 50,000/mo | $20 | $50 | $34.95 | $35 | ~$5 |
| 100,000/mo | $90 | $100 | $89.95 | $90 | ~$10 |
| 500,000/mo | ~$400 | ~$350 | ~$250 | ~$350 | ~$50 |

**Amazon SES is 5-10x cheaper at scale** but trades cost for complexity. The sandbox exit process requires detailed justification, IAM configuration, and manual request signing for Workers. For a solo developer, this friction rarely justifies the savings until you're sending hundreds of thousands monthly.

## Developer experience and setup time

Setup complexity varies dramatically. Resend lives up to its "Stripe for email" positioning with a **5-minute integration**—create API key, verify domain, send emails. Postmark requires manual account approval (typically <24 hours). SendGrid's compliance team has a notorious reputation for unexplained account suspensions. Amazon SES demands IAM policies, DKIM records, and sandbox exit requests.

**Resend advantages for SvelteKit developers:**
- Native TypeScript support with excellent type definitions
- React Email integration for component-based templates (adaptable to any framework)
- Clean, minimal API surface: `resend.emails.send()` handles everything
- Cloudflare-specific documentation with copy-paste code examples
- Wrangler secret integration for secure API key storage

The API design difference is stark. Resend's call structure:
```javascript
const { data, error } = await resend.emails.send({
  from: 'you@domain.com',
  to: 'user@example.com', 
  subject: 'Welcome',
  html: '<p>Hello</p>'
});
```

Versus SendGrid's more verbose structure requiring nested objects for personalizations, content arrays, and from/to objects.

## Transactional versus marketing support

Your requirement for transactional emails now with marketing capability later is well-served by several options. **Resend added Broadcasts** (their marketing product) with a WYSIWYG editor, scheduling, and unsubscribe handling. **Postmark supports both via Message Streams**—separate infrastructure ensures your marketing emails won't impact transactional deliverability. **Loops specifically targets SaaS** with unlimited transactional emails on paid plans.

| Provider | Transactional | Marketing | Same Platform |
|----------|--------------|-----------|---------------|
| Resend | ✅ Primary focus | ✅ Broadcasts | Yes |
| Postmark | ✅ Industry-leading | ✅ Broadcast streams | Yes |
| SendGrid | ✅ Email API | ✅ Marketing Campaigns | Separate products, same account |
| Mailgun | ✅ Primary focus | ⚠️ Basic support | Yes |
| Amazon SES | ✅ Full support | ⚠️ No built-in tools | Needs third-party layer |

## Hidden gotchas worth knowing

**Resend's rate limit** is 2 requests/second by default—fine for transactional but requires Cloudflare Queues for bulk operations. **Postmark's pricing gap** jumps from 100 free emails to $15/month for 10,000—nothing in between for light commercial use. **SendGrid's account approval** process has widespread complaints about arbitrary suspensions. **Mailgun's sandbox** restricts you to 5 manually-verified recipients until you add a credit card. **Amazon SES sandbox exit** commonly gets rejected without clear explanation.

**Deliverability reputation** varies significantly. Postmark consistently achieves **93-98% inbox placement**—the highest in the industry. Resend, backed by Y Combinator and used by companies like Warner Bros and eBay, maintains strong deliverability. SendGrid's shared IP pools occasionally suffer from blacklisting issues caused by other users.

## My recommendation: Start with Resend

For a SvelteKit app on Cloudflare Workers with your specific requirements, **Resend is the optimal choice**:

1. **Only native Workers SDK** eliminates HTTP API boilerplate
2. **3,000 free emails/month** handles MVP development comfortably  
3. **$20/month Pro tier** provides 50,000 emails—sufficient for early commercial use
4. **Modern DX** matches SvelteKit's developer-friendly philosophy
5. **Transactional + marketing** in one platform supports your growth path
6. **Official Cloudflare tutorial** ensures well-tested integration patterns

**Migration path if you outgrow Resend:** At 500,000+ emails/month, Amazon SES becomes compelling purely on cost (~$50 vs ~$400). By then, you'll have engineering resources to handle SES complexity. Use `aws4fetch` for Workers compatibility and consider a service like BigMailer or MailBluster as a management layer.

**Alternative consideration:** If marketing emails become a primary focus, **Loops** deserves attention—4,000 free emails, unlimited transactional on paid plans, and purpose-built for SaaS. Its $49/month starting price is higher than Resend's $20, but the unlimited transactional benefit makes it economical for high-volume triggered emails.

## Quick-start implementation for Resend + SvelteKit

```bash
npm install resend
npx wrangler secret put RESEND_API_KEY
```

```typescript
// src/lib/email.ts
import { Resend } from 'resend';

export async function sendEmail(env: Env, options: {
  to: string;
  subject: string;
  html: string;
}) {
  const resend = new Resend(env.RESEND_API_KEY);
  return resend.emails.send({
    from: 'noreply@yourdomain.com',
    ...options
  });
}
```

Domain verification requires adding DNS records (DKIM, SPF) in your Cloudflare dashboard—a 10-minute process with immediate propagation since you're already on Cloudflare.