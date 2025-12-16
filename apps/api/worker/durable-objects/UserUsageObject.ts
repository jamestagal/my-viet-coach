import { DurableObject } from 'cloudflare:workers';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type PlanType = 'free' | 'basic' | 'pro';

export interface ActiveSession {
  id: string;
  startTime: number; // Unix timestamp (ms)
  lastHeartbeat: number; // Unix timestamp (ms)
  minutesUsed: number; // Running total for this session
}

export interface UsageState {
  userId: string;
  plan: PlanType;
  minutesLimit: number; // Monthly limit based on plan
  minutesUsed: number; // Total used this billing period
  periodStart: string; // ISO date (YYYY-MM-DD)
  periodEnd: string; // ISO date (YYYY-MM-DD)
  activeSession: ActiveSession | null;
  lastSyncedAt: string | null; // ISO timestamp of last D1 sync
  version: number; // For optimistic concurrency
}

export interface UsageStatus {
  plan: PlanType;
  minutesUsed: number;
  minutesRemaining: number;
  minutesLimit: number;
  periodStart: string;
  periodEnd: string;
  hasActiveSession: boolean;
  activeSessionMinutes: number;
  percentUsed: number;
}

export interface SessionResult {
  sessionId?: string;
  error?: string;
  minutesUsed?: number;
}

// ============================================================================
// PLAN CONFIGURATION
// ============================================================================

export const PLAN_CONFIG: Record<PlanType, { minutes: number; price: number }> = {
  free: { minutes: 10, price: 0 }, // 10 minutes/month trial
  basic: { minutes: 100, price: 15 }, // 100 minutes/month @ $15
  pro: { minutes: 500, price: 25 } // 500 minutes/month @ $25
};

// ============================================================================
// ENVIRONMENT INTERFACE
// ============================================================================

interface Env {
  DB: D1Database;
}

// ============================================================================
// DURABLE OBJECT CLASS
// ============================================================================

export class UserUsageObject extends DurableObject<Env> {
  private state: UsageState | null = null;
  private initialized = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    // Block concurrent requests until state is loaded from storage
    ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get<UsageState>('state');
      if (stored) {
        this.state = stored;
        this.initialized = true;
      }
    });
  }

  // ==========================================================================
  // INITIALIZATION (called when user signs up or first uses voice features)
  // ==========================================================================

  async initialize(userId: string, plan: PlanType = 'free'): Promise<UsageStatus> {
    const now = new Date();
    const periodStart = this.getMonthStart(now);
    const periodEnd = this.getMonthEnd(now);

    this.state = {
      userId,
      plan,
      minutesLimit: PLAN_CONFIG[plan].minutes,
      minutesUsed: 0,
      periodStart,
      periodEnd,
      activeSession: null,
      lastSyncedAt: null,
      version: 1
    };

    await this.persist();
    this.initialized = true;

    return this.getStatus();
  }

  // ==========================================================================
  // CREDIT CHECKING (zero latency - in-memory only!)
  // ==========================================================================

  async hasCredits(): Promise<{ allowed: boolean; remaining: number; reason?: string }> {
    if (!this.initialized || !this.state) {
      return { allowed: false, remaining: 0, reason: 'User not initialized' };
    }

    // Check if billing period needs reset
    await this.maybeResetPeriod();

    // Calculate remaining (including any active session usage)
    const activeMinutes = this.state.activeSession?.minutesUsed ?? 0;
    const totalUsed = this.state.minutesUsed + activeMinutes;
    const remaining = Math.max(0, this.state.minutesLimit - totalUsed);

    if (remaining <= 0) {
      return {
        allowed: false,
        remaining: 0,
        reason: `Monthly limit reached (${this.state.minutesLimit} minutes on ${this.state.plan} plan)`
      };
    }

    return { allowed: true, remaining };
  }

  // ==========================================================================
  // SESSION MANAGEMENT
  // ==========================================================================

  async startSession(): Promise<SessionResult> {
    // Verify credits first
    const { allowed, reason } = await this.hasCredits();

    if (!allowed) {
      return { error: reason ?? 'No credits available' };
    }

    // Check for existing active session
    if (this.state!.activeSession) {
      // Check if it's a stale session (no heartbeat for 10+ minutes)
      const lastHeartbeat = this.state!.activeSession.lastHeartbeat;
      const staleThreshold = 10 * 60 * 1000; // 10 minutes

      if (Date.now() - lastHeartbeat > staleThreshold) {
        // Auto-end stale session
        await this.endSession(this.state!.activeSession.id);
      } else {
        return { error: 'Session already active. End current session first.' };
      }
    }

    // Create new session
    const sessionId = crypto.randomUUID();
    const now = Date.now();

    this.state!.activeSession = {
      id: sessionId,
      startTime: now,
      lastHeartbeat: now,
      minutesUsed: 0
    };

    await this.persist();

    // Schedule periodic sync alarm (every 30 seconds)
    await this.ctx.storage.setAlarm(Date.now() + 30_000);

    return { sessionId };
  }

  async heartbeat(
    sessionId: string
  ): Promise<{ minutesUsed: number; remaining: number } | { error: string }> {
    if (!this.state?.activeSession || this.state.activeSession.id !== sessionId) {
      return { error: 'No active session with this ID' };
    }

    const now = Date.now();
    const session = this.state.activeSession;

    // Calculate minutes since session start
    const elapsedMs = now - session.startTime;
    const minutesUsed = Math.ceil(elapsedMs / 60_000);

    // Update session
    session.lastHeartbeat = now;
    session.minutesUsed = minutesUsed;

    // Check if we've hit the limit
    const totalUsed = this.state.minutesUsed + minutesUsed;
    const remaining = Math.max(0, this.state.minutesLimit - totalUsed);

    await this.persist();

    // Return warning if running low
    return { minutesUsed, remaining };
  }

  async endSession(sessionId: string): Promise<SessionResult> {
    if (!this.state) {
      return { error: 'User not initialized' };
    }

    // If no active session or wrong session ID, return gracefully
    if (!this.state.activeSession || this.state.activeSession.id !== sessionId) {
      return { minutesUsed: 0 };
    }

    const session = this.state.activeSession;

    // Calculate final usage (round up to nearest minute)
    const elapsedMs = Date.now() - session.startTime;
    const minutesUsed = Math.max(1, Math.ceil(elapsedMs / 60_000));

    // Add to period total
    this.state.minutesUsed += minutesUsed;
    this.state.activeSession = null;
    this.state.version++;

    await this.persist();

    // Immediate sync on session end (important for billing accuracy)
    await this.syncToDatabase();

    return { minutesUsed };
  }

  // ==========================================================================
  // STATUS & REPORTING
  // ==========================================================================

  async getStatus(): Promise<UsageStatus> {
    if (!this.state) {
      throw new Error('User not initialized');
    }

    await this.maybeResetPeriod();

    const activeMinutes = this.state.activeSession?.minutesUsed ?? 0;
    const totalUsed = this.state.minutesUsed + activeMinutes;
    const remaining = Math.max(0, this.state.minutesLimit - totalUsed);
    const percentUsed = Math.round((totalUsed / this.state.minutesLimit) * 100);

    return {
      plan: this.state.plan,
      minutesUsed: totalUsed,
      minutesRemaining: remaining,
      minutesLimit: this.state.minutesLimit,
      periodStart: this.state.periodStart,
      periodEnd: this.state.periodEnd,
      hasActiveSession: !!this.state.activeSession,
      activeSessionMinutes: activeMinutes,
      percentUsed: Math.min(100, percentUsed)
    };
  }

  // ==========================================================================
  // PLAN MANAGEMENT (called from Polar webhook or admin)
  // ==========================================================================

  async upgradePlan(newPlan: PlanType, resetUsage = false): Promise<UsageStatus> {
    if (!this.state) {
      throw new Error('User not initialized');
    }

    const oldPlan = this.state.plan;

    this.state.plan = newPlan;
    this.state.minutesLimit = PLAN_CONFIG[newPlan].minutes;

    // Optionally reset usage on upgrade (business decision)
    if (resetUsage) {
      this.state.minutesUsed = 0;
      const now = new Date();
      this.state.periodStart = this.getMonthStart(now);
      this.state.periodEnd = this.getMonthEnd(now);
    }

    this.state.version++;
    await this.persist();

    // Sync plan change to database immediately
    await this.syncToDatabase();

    console.log(`Plan upgraded: ${oldPlan} -> ${newPlan} for user ${this.state.userId}`);

    return this.getStatus();
  }

  async downgradePlan(newPlan: PlanType): Promise<UsageStatus> {
    // Downgrade takes effect immediately
    // Usage persists (user keeps their current usage count)
    return this.upgradePlan(newPlan, false);
  }

  // ==========================================================================
  // ALARM HANDLER (async database sync)
  // ==========================================================================

  async alarm(): Promise<void> {
    console.log(`[Alarm] Triggered for user ${this.state?.userId}`);

    // Sync current state to D1 database
    await this.syncToDatabase();

    // If session still active, schedule next sync
    if (this.state?.activeSession) {
      // Check for stale session (no heartbeat for 10+ minutes)
      const lastHeartbeat = this.state.activeSession.lastHeartbeat;
      const staleThreshold = 10 * 60 * 1000; // 10 minutes

      if (Date.now() - lastHeartbeat > staleThreshold) {
        // Auto-end stale session (user probably closed browser)
        console.log(`[Alarm] Auto-ending stale session for user ${this.state.userId}`);
        await this.endSession(this.state.activeSession.id);
      } else {
        // Schedule next sync in 30 seconds
        await this.ctx.storage.setAlarm(Date.now() + 30_000);
      }
    }
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private async persist(): Promise<void> {
    await this.ctx.storage.put('state', this.state);
  }

  private async maybeResetPeriod(): Promise<void> {
    if (!this.state) return;

    const now = new Date();
    const periodEnd = new Date(this.state.periodEnd);

    // If we're past the period end date, reset for new period
    if (now > periodEnd) {
      console.log(`[Period Reset] New billing period for user ${this.state.userId}`);

      // Archive old period usage before reset
      await this.archivePeriodUsage();

      this.state.minutesUsed = 0;
      this.state.periodStart = this.getMonthStart(now);
      this.state.periodEnd = this.getMonthEnd(now);
      this.state.version++;

      await this.persist();
    }
  }

  private async syncToDatabase(): Promise<void> {
    if (!this.state) return;

    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    try {
      // Upsert usage period record
      await this.env.DB.prepare(
        `
        INSERT INTO usage_periods (
          id, user_id, period_start, period_end, plan,
          minutes_used, minutes_limit, synced_at, version, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (user_id, period_start) DO UPDATE SET
          minutes_used = excluded.minutes_used,
          minutes_limit = excluded.minutes_limit,
          plan = excluded.plan,
          synced_at = excluded.synced_at,
          version = excluded.version
      `
      )
        .bind(
          id,
          this.state.userId,
          this.state.periodStart,
          this.state.periodEnd,
          this.state.plan,
          this.state.minutesUsed,
          this.state.minutesLimit,
          now,
          this.state.version,
          Date.now()
        )
        .run();

      this.state.lastSyncedAt = now;

      console.log(`[Sync] Usage synced to D1 for user ${this.state.userId}`);
    } catch (error) {
      console.error(`[Sync Error] Failed to sync for user ${this.state.userId}:`, error);
      // Don't throw - we don't want sync failures to break user experience
    }
  }

  private async archivePeriodUsage(): Promise<void> {
    if (!this.state) return;

    const id = crypto.randomUUID();

    try {
      // Final sync of the completed period with archived flag
      await this.env.DB.prepare(
        `
        INSERT INTO usage_periods (
          id, user_id, period_start, period_end, plan,
          minutes_used, minutes_limit, synced_at, version, archived, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        ON CONFLICT (user_id, period_start) DO UPDATE SET
          minutes_used = excluded.minutes_used,
          archived = 1,
          synced_at = excluded.synced_at
      `
      )
        .bind(
          id,
          this.state.userId,
          this.state.periodStart,
          this.state.periodEnd,
          this.state.plan,
          this.state.minutesUsed,
          this.state.minutesLimit,
          new Date().toISOString(),
          this.state.version,
          Date.now()
        )
        .run();
    } catch (error) {
      console.error(`[Archive Error] Failed to archive period:`, error);
    }
  }

  /**
   * Get the first day of the month in YYYY-MM-DD format (UTC)
   */
  private getMonthStart(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  }

  /**
   * Get the last day of the month in YYYY-MM-DD format (UTC)
   */
  private getMonthEnd(date: Date): string {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    // Get last day by getting day 0 of next month
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const monthStr = String(month + 1).padStart(2, '0');
    return `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
  }
}
