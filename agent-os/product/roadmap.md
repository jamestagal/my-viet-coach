# Product Roadmap

## Current State

The following features are already implemented:

- [x] AI Voice Conversation Practice with "Co Ha" tutor persona
- [x] Gemini Live API integration (primary voice provider)
- [x] OpenAI Realtime API integration (fallback provider)
- [x] Free Chat mode (natural conversation without corrections)
- [x] Coach mode (active corrections and explanations)
- [x] Topic selection (General, Food, Travel, Family, Work, Hobbies, Shopping, Culture)
- [x] Difficulty levels (Beginner, Intermediate, Advanced)
- [x] Mid-session disconnect UI with provider fallback options
- [x] Session corrections extraction and display
- [x] Conversation history preservation across provider switches
- [x] User authentication (Google OAuth + Email OTP via Better Auth)
- [x] Basic subscription management (Polar.sh integration)
- [x] Responsive web interface (SvelteKit + Tailwind CSS)

---

## Roadmap

1. [x] **Durable Objects Usage Tracking** - Implement Cloudflare Durable Objects for real-time credit verification before voice sessions, with zero-latency checks and async D1 sync. `L`

2. [x] **Usage Display & Limits UI** - Add usage status component showing remaining minutes, progress bar, low-credit warnings, and upgrade prompts when credits exhausted. `S`

3. [x] **Session Heartbeat & Live Tracking** - Implement periodic heartbeat during active sessions to update usage in real-time and auto-end sessions when limits are reached. `M`

4. [x] **Polar Webhook DO Integration** - Connect Polar.sh subscription webhooks to Durable Objects for instant plan upgrades/downgrades without database round-trips. `M`

5. [x] **Extended Session Tracking** - Add provider tracking, disconnect codes, session modes, and message counts to usage_sessions table for admin visibility. `S`

6. [x] **Session Messages Persistence** - Store conversation messages in D1 database (replacing localStorage) so users can review past conversations across devices. `M`

7. [x] **Session Corrections Persistence** - Store corrections in D1 database with category classification (grammar, tone, vocabulary, word_order, pronunciation) for learning review. `M`

8. [x] **Learning History Page** - Create user-facing page to browse past sessions, view conversation transcripts, and review corrections with explanations. `M`

9. [x] **Corrections Review System** - Add ability for users to mark corrections as reviewed, set confidence levels, and track learning progress over time. `S`

10. [x] **Admin Session Health Dashboard** - Build admin dashboard showing session statistics, provider breakdown, disconnect rates, and provider switch metrics. `L`

11. [ ] **Subscription Pricing Page** - Create public pricing page with plan comparison (Free: 10 min, Basic $15: 100 min, Pro $25: 500 min) and checkout flow. `M`

12. [ ] **User Settings & Profile** - Add user profile page with account management, subscription status, usage history, and notification preferences. `S`

13. [ ] **Spaced Repetition for Corrections** - Implement spaced repetition algorithm to resurface unreviewed corrections at optimal intervals for retention. `L`

14. [ ] **Mobile-Optimized Voice Experience** - Optimize voice practice interface for mobile browsers with touch-friendly controls and audio handling. `M`

15. [ ] **Session Analytics for Users** - Show users their learning trends: sessions per week, minutes practiced, correction rates by category, improvement over time. `M`

> Notes
> - Order prioritizes monetization infrastructure (1-4) to enable sustainable growth
> - Learning persistence (5-9) replaces localStorage with server-side storage for cross-device access
> - Admin tools (10) provide operational visibility for debugging and optimization
> - User-facing enhancements (11-15) improve retention and learning outcomes
> - Each item represents a complete, testable feature with both frontend and backend components
