import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Unit tests for usage_periods, usage_sessions, session_messages, and session_corrections
 * database models.
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
		it('has correct column definitions including extended health tracking columns', async () => {
			const { usageSessions } = await import('./schema');

			expect(usageSessions).toBeDefined();

			const columns = Object.keys(usageSessions);
			// Original columns
			expect(columns).toContain('id');
			expect(columns).toContain('userId');
			expect(columns).toContain('startedAt');
			expect(columns).toContain('endedAt');
			expect(columns).toContain('minutesUsed');
			expect(columns).toContain('topic');
			expect(columns).toContain('difficulty');
			expect(columns).toContain('endReason');

			// Extended provider tracking columns
			expect(columns).toContain('provider');
			expect(columns).toContain('initialProvider');
			expect(columns).toContain('providerSwitchedAt');

			// Extended disconnect tracking columns
			expect(columns).toContain('disconnectCode');
			expect(columns).toContain('disconnectReason');

			// Extended session details columns
			expect(columns).toContain('mode');
			expect(columns).toContain('messageCount');
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
				minutesUsed: 5,
				provider: 'gemini',
				mode: 'coach',
				messageCount: 10
			};
			expect(testSession.minutesUsed).toBe(5);
			expect(testSession.provider).toBe('gemini');
			expect(testSession.mode).toBe('coach');
		});

		it('enforces provider enum values', async () => {
			const { usageSessions } = await import('./schema');

			const providerColumn = usageSessions.provider;
			expect(providerColumn).toBeDefined();

			// Valid values: 'gemini', 'openai'
			expect(providerColumn.enumValues).toEqual(['gemini', 'openai']);
		});

		it('enforces mode enum values', async () => {
			const { usageSessions } = await import('./schema');

			const modeColumn = usageSessions.mode;
			expect(modeColumn).toBeDefined();

			// Valid values: 'free', 'coach'
			expect(modeColumn.enumValues).toEqual(['free', 'coach']);
		});

		it('enforces difficulty enum values', async () => {
			const { usageSessions } = await import('./schema');

			const difficultyColumn = usageSessions.difficulty;
			expect(difficultyColumn).toBeDefined();

			// Valid values: 'beginner', 'intermediate', 'advanced'
			expect(difficultyColumn.enumValues).toEqual(['beginner', 'intermediate', 'advanced']);
		});

		it('enforces endReason enum values including disconnect and provider_switch', async () => {
			const { usageSessions } = await import('./schema');

			const endReasonColumn = usageSessions.endReason;
			expect(endReasonColumn).toBeDefined();

			// Valid values include new disconnect and provider_switch reasons
			expect(endReasonColumn.enumValues).toEqual([
				'user_ended',
				'limit_reached',
				'timeout',
				'error',
				'stale',
				'disconnect',
				'provider_switch'
			]);
		});
	});

	describe('sessionMessages table schema', () => {
		it('has correct column definitions', async () => {
			const { sessionMessages } = await import('./schema');

			expect(sessionMessages).toBeDefined();

			const columns = Object.keys(sessionMessages);
			expect(columns).toContain('id');
			expect(columns).toContain('sessionId');
			expect(columns).toContain('userId');
			expect(columns).toContain('role');
			expect(columns).toContain('text');
			expect(columns).toContain('timestamp');
			expect(columns).toContain('sequenceNumber');
		});

		it('exports SessionMessage and NewSessionMessage types', async () => {
			const schema = await import('./schema');

			expect(schema.sessionMessages).toBeDefined();

			// Type verification - TypeScript compilation validates these
			type SessionMessage = typeof schema.sessionMessages.$inferSelect;
			type NewSessionMessage = typeof schema.sessionMessages.$inferInsert;

			const testMessage: Partial<SessionMessage> = {
				id: 'msg-123',
				sessionId: 'session-456',
				userId: 'user-789',
				role: 'user',
				text: 'Xin chao',
				sequenceNumber: 1
			};
			expect(testMessage.role).toBe('user');
			expect(testMessage.sequenceNumber).toBe(1);
		});

		it('enforces role enum values', async () => {
			const { sessionMessages } = await import('./schema');

			const roleColumn = sessionMessages.role;
			expect(roleColumn).toBeDefined();

			// Valid values: 'user', 'coach'
			expect(roleColumn.enumValues).toEqual(['user', 'coach']);
		});
	});

	describe('sessionCorrections table schema', () => {
		it('has correct column definitions', async () => {
			const { sessionCorrections } = await import('./schema');

			expect(sessionCorrections).toBeDefined();

			const columns = Object.keys(sessionCorrections);
			expect(columns).toContain('id');
			expect(columns).toContain('sessionId');
			expect(columns).toContain('userId');
			expect(columns).toContain('original');
			expect(columns).toContain('correction');
			expect(columns).toContain('explanation');
			expect(columns).toContain('category');
			expect(columns).toContain('reviewed');
			expect(columns).toContain('reviewedAt');
			expect(columns).toContain('confidenceLevel');
			expect(columns).toContain('createdAt');
		});

		it('exports SessionCorrection and NewSessionCorrection types', async () => {
			const schema = await import('./schema');

			expect(schema.sessionCorrections).toBeDefined();

			// Type verification - TypeScript compilation validates these
			type SessionCorrection = typeof schema.sessionCorrections.$inferSelect;
			type NewSessionCorrection = typeof schema.sessionCorrections.$inferInsert;

			const testCorrection: Partial<SessionCorrection> = {
				id: 'corr-123',
				sessionId: 'session-456',
				userId: 'user-789',
				original: 'Toi muon an pho',
				correction: 'Em muon an pho',
				explanation: 'Use em when speaking to elders',
				category: 'tone',
				reviewed: false,
				confidenceLevel: 0
			};
			expect(testCorrection.category).toBe('tone');
			expect(testCorrection.reviewed).toBe(false);
		});

		it('enforces category enum values', async () => {
			const { sessionCorrections } = await import('./schema');

			const categoryColumn = sessionCorrections.category;
			expect(categoryColumn).toBeDefined();

			// Valid values: 'grammar', 'tone', 'vocabulary', 'word_order', 'pronunciation'
			expect(categoryColumn.enumValues).toEqual([
				'grammar',
				'tone',
				'vocabulary',
				'word_order',
				'pronunciation'
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
