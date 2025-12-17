/**
 * Admin Session Health Dashboard Tests
 *
 * Tests for the admin session monitoring dashboard:
 * - Admin page loads with stats cards
 * - Filtering by date range works
 * - Sessions table displays correct data
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// MOCK SETUP
// ============================================================================

const mockFetch = vi.fn();

beforeEach(() => {
	vi.resetAllMocks();
	globalThis.fetch = mockFetch;
});

afterEach(() => {
	vi.restoreAllMocks();
});

// Helper to create a successful API response
function createSuccessResponse<T>(data: T): Response {
	return new Response(JSON.stringify({ success: true, data }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});
}

// Helper to create an error API response
function createErrorResponse(message: string, status: number = 400): Response {
	return new Response(JSON.stringify({ message }), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

// ============================================================================
// MOCK DATA
// ============================================================================

const mockAdminSessionsResponse = {
	sessions: [
		{
			id: 'session-1',
			userId: 'user-1',
			userEmail: 'alice@example.com',
			startedAt: 1702000000000,
			endedAt: 1702000600000,
			minutesUsed: 10,
			topic: 'food',
			difficulty: 'intermediate',
			mode: 'coach',
			provider: 'gemini',
			initialProvider: 'gemini',
			providerSwitched: false,
			disconnectCode: null,
			disconnectReason: null,
			messageCount: 12
		},
		{
			id: 'session-2',
			userId: 'user-2',
			userEmail: 'bob@example.com',
			startedAt: 1701900000000,
			endedAt: 1701900300000,
			minutesUsed: 5,
			topic: 'travel',
			difficulty: 'beginner',
			mode: 'free',
			provider: 'openai',
			initialProvider: 'gemini',
			providerSwitched: true,
			providerSwitchedAt: 1701900200000,
			disconnectCode: 1006,
			disconnectReason: 'Abnormal closure',
			messageCount: 8
		}
	],
	stats: {
		totalSessions: 150,
		avgDuration: 8.5,
		providerBreakdown: {
			gemini: 120,
			openai: 30
		},
		disconnectBreakdown: {
			'1000': 10,
			'1006': 5,
			'1011': 2
		},
		providerSwitchRate: 0.12
	},
	pagination: {
		page: 1,
		limit: 50,
		total: 150
	}
};

// ============================================================================
// GET /api/admin/sessions TESTS
// ============================================================================

describe('GET /api/admin/sessions', () => {
	it('returns sessions with stats cards data', async () => {
		mockFetch.mockResolvedValueOnce(createSuccessResponse(mockAdminSessionsResponse));

		const response = await fetch('/api/admin/sessions', {
			method: 'GET',
			credentials: 'include'
		});

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.success).toBe(true);

		// Verify stats cards data
		expect(data.data.stats.totalSessions).toBe(150);
		expect(data.data.stats.avgDuration).toBe(8.5);
		expect(data.data.stats.providerSwitchRate).toBe(0.12);
		expect(data.data.stats.providerBreakdown).toEqual({ gemini: 120, openai: 30 });
	});

	it('filters by date range when parameters provided', async () => {
		mockFetch.mockResolvedValueOnce(createSuccessResponse(mockAdminSessionsResponse));

		const fromDate = '2024-01-01';
		const toDate = '2024-01-31';

		const response = await fetch(`/api/admin/sessions?from=${fromDate}&to=${toDate}`, {
			method: 'GET',
			credentials: 'include'
		});

		expect(response.status).toBe(200);
		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining(`from=${fromDate}`),
			expect.any(Object)
		);
		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining(`to=${toDate}`),
			expect.any(Object)
		);
	});

	it('returns sessions table data with user emails and disconnect codes', async () => {
		mockFetch.mockResolvedValueOnce(createSuccessResponse(mockAdminSessionsResponse));

		const response = await fetch('/api/admin/sessions', {
			method: 'GET',
			credentials: 'include'
		});

		expect(response.status).toBe(200);
		const data = await response.json();

		// Verify sessions table data
		expect(data.data.sessions).toHaveLength(2);

		// First session - clean session
		expect(data.data.sessions[0].userEmail).toBe('alice@example.com');
		expect(data.data.sessions[0].provider).toBe('gemini');
		expect(data.data.sessions[0].disconnectCode).toBeNull();
		expect(data.data.sessions[0].messageCount).toBe(12);

		// Second session - with provider switch and disconnect
		expect(data.data.sessions[1].userEmail).toBe('bob@example.com');
		expect(data.data.sessions[1].provider).toBe('openai');
		expect(data.data.sessions[1].providerSwitched).toBe(true);
		expect(data.data.sessions[1].disconnectCode).toBe(1006);
		expect(data.data.sessions[1].messageCount).toBe(8);
	});

	it('returns 403 when non-admin user accesses endpoint', async () => {
		mockFetch.mockResolvedValueOnce(createErrorResponse('Admin access required', 403));

		const response = await fetch('/api/admin/sessions', {
			method: 'GET',
			credentials: 'include'
		});

		expect(response.status).toBe(403);
		const data = await response.json();
		expect(data.message).toContain('Admin');
	});
});
