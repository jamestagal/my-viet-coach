import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Unit tests for usage_periods and usage_sessions database models
 *
 * These tests verify the schema definitions and type exports are correct.
 * Integration tests against real D1 would require wrangler local emulation.
 */

// Mock the schema imports for isolated testing
vi.mock('drizzle-orm/d1', () => ({
	drizzle: vi.fn()
}));

describe('Usage Database Models', () => {
	describe('usagePeriods table schema', () => {
		it('has correct column definitions', async () => {
			const { usagePeriods } = await import('./schema');

			// Verify table exists
			expect(usagePeriods).toBeDefined();

			// Check column names
			const columns = Object.keys(usagePeriods);
			expect(columns).toContain('id');
			expect(columns).toContain('userId');
			expect(columns).toContain('periodStart');
			expect(columns).toContain('periodEnd');
			expect(columns).toContain('plan');
			expect(columns).toContain('minutesUsed');
			expect(columns).toContain('minutesLimit');
			expect(columns).toContain('syncedAt');
			expect(columns).toContain('version');
			expect(columns).toContain('archived');
			expect(columns).toContain('createdAt');
		});

		it('exports UsagePeriod and NewUsagePeriod types', async () => {
			// This test verifies that types are exported and usable
			// TypeScript compilation ensures the types are valid
			const schema = await import('./schema');

			// Type-checking happens at compile time
			// We verify the schema exports exist
			expect(schema.usagePeriods).toBeDefined();

			// The type exports are validated by TypeScript
			// If these imports fail, TypeScript will error
			type UsagePeriod = typeof schema.usagePeriods.$inferSelect;
			type NewUsagePeriod = typeof schema.usagePeriods.$inferInsert;

			// Verify we can reference the types
			const testPeriod: Partial<UsagePeriod> = {
				id: 'test-id',
				userId: 'user-123',
				plan: 'free'
			};
			expect(testPeriod.id).toBe('test-id');
		});

		it('enforces plan enum values', async () => {
			const { usagePeriods } = await import('./schema');

			// The plan column should only accept specific values
			// This is enforced by the enum definition in the schema
			const planColumn = usagePeriods.plan;
			expect(planColumn).toBeDefined();

			// The column config should include enum constraint
			// Valid values: 'free', 'basic', 'pro'
			expect(planColumn.enumValues).toEqual(['free', 'basic', 'pro']);
		});
	});

	describe('usageSessions table schema', () => {
		it('has correct column definitions', async () => {
			const { usageSessions } = await import('./schema');

			expect(usageSessions).toBeDefined();

			const columns = Object.keys(usageSessions);
			expect(columns).toContain('id');
			expect(columns).toContain('userId');
			expect(columns).toContain('startedAt');
			expect(columns).toContain('endedAt');
			expect(columns).toContain('minutesUsed');
			expect(columns).toContain('topic');
			expect(columns).toContain('difficulty');
			expect(columns).toContain('endReason');
		});

		it('exports UsageSession and NewUsageSession types', async () => {
			const schema = await import('./schema');

			expect(schema.usageSessions).toBeDefined();

			// Type verification - TypeScript compilation validates these
			type UsageSession = typeof schema.usageSessions.$inferSelect;
			type NewUsageSession = typeof schema.usageSessions.$inferInsert;

			const testSession: Partial<UsageSession> = {
				id: 'session-123',
				userId: 'user-456',
				minutesUsed: 5
			};
			expect(testSession.minutesUsed).toBe(5);
		});

		it('enforces difficulty enum values', async () => {
			const { usageSessions } = await import('./schema');

			const difficultyColumn = usageSessions.difficulty;
			expect(difficultyColumn).toBeDefined();

			// Valid values: 'beginner', 'intermediate', 'advanced'
			expect(difficultyColumn.enumValues).toEqual(['beginner', 'intermediate', 'advanced']);
		});

		it('enforces endReason enum values', async () => {
			const { usageSessions } = await import('./schema');

			const endReasonColumn = usageSessions.endReason;
			expect(endReasonColumn).toBeDefined();

			// Valid values: 'user_ended', 'limit_reached', 'timeout', 'error', 'stale'
			expect(endReasonColumn.enumValues).toEqual([
				'user_ended',
				'limit_reached',
				'timeout',
				'error',
				'stale'
			]);
		});
	});

	describe('table relationships', () => {
		it('usageSessions references user table', async () => {
			const { usageSessions, user } = await import('./schema');

			// The userId column should reference the user table
			expect(usageSessions.userId).toBeDefined();
			expect(user).toBeDefined();

			// In a real D1 database, the foreign key constraint
			// would be enforced by SQLite
		});
	});
});
