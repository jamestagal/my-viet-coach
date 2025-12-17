/**
 * Conversations & Corrections API Tests
 *
 * Tests for the new API endpoints:
 * - GET /api/conversations - paginated user sessions
 * - GET /api/conversations/:id - full session details
 * - GET /api/review/corrections - filtered corrections with stats
 * - PATCH /api/review/corrections/:id - update reviewed status
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
// GET /api/conversations TESTS
// ============================================================================

describe('GET /api/conversations', () => {
	const mockConversationsResponse = {
		sessions: [
			{
				id: 'session-1',
				startedAt: 1702000000000,
				endedAt: 1702000600000,
				topic: 'food',
				difficulty: 'intermediate',
				mode: 'coach',
				provider: 'gemini',
				messageCount: 12,
				correctionCount: 3
			},
			{
				id: 'session-2',
				startedAt: 1701900000000,
				endedAt: 1701900300000,
				topic: 'travel',
				difficulty: 'beginner',
				mode: 'free',
				provider: 'openai',
				messageCount: 8,
				correctionCount: 0
			}
		],
		pagination: {
			page: 1,
			limit: 10,
			total: 2
		}
	};

	it('returns paginated user sessions with correction counts', async () => {
		mockFetch.mockResolvedValueOnce(createSuccessResponse(mockConversationsResponse));

		const response = await fetch('/api/conversations?page=1&limit=10', {
			method: 'GET',
			credentials: 'include'
		});

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.success).toBe(true);
		expect(data.data.sessions).toHaveLength(2);
		expect(data.data.sessions[0]).toHaveProperty('correctionCount');
		expect(data.data.pagination).toEqual({ page: 1, limit: 10, total: 2 });
	});

	it('returns 401 when not authenticated', async () => {
		mockFetch.mockResolvedValueOnce(createErrorResponse('Unauthorized', 401));

		const response = await fetch('/api/conversations', {
			method: 'GET'
		});

		expect(response.status).toBe(401);
	});
});

// ============================================================================
// GET /api/conversations/:id TESTS
// ============================================================================

describe('GET /api/conversations/:id', () => {
	const mockSessionDetail = {
		session: {
			id: 'session-1',
			startedAt: 1702000000000,
			endedAt: 1702000600000,
			topic: 'food',
			difficulty: 'intermediate',
			mode: 'coach',
			provider: 'gemini',
			messageCount: 3
		},
		messages: [
			{ id: 'msg-1', role: 'user', text: 'Xin chao', timestamp: 1702000000000, sequenceNumber: 0 },
			{
				id: 'msg-2',
				role: 'coach',
				text: 'Chao ban! Ban khoe khong?',
				timestamp: 1702000005000,
				sequenceNumber: 1
			},
			{ id: 'msg-3', role: 'user', text: 'Toi khoe', timestamp: 1702000010000, sequenceNumber: 2 }
		],
		corrections: [
			{
				id: 'corr-1',
				original: 'Xin chao',
				correction: 'Xin chao anh/chi',
				explanation: 'Add honorific for politeness',
				category: 'tone',
				reviewed: false
			}
		]
	};

	it('returns full session with messages and corrections', async () => {
		mockFetch.mockResolvedValueOnce(createSuccessResponse(mockSessionDetail));

		const response = await fetch('/api/conversations/session-1', {
			method: 'GET',
			credentials: 'include'
		});

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.success).toBe(true);
		expect(data.data.session.id).toBe('session-1');
		expect(data.data.messages).toHaveLength(3);
		expect(data.data.messages[0].sequenceNumber).toBe(0);
		expect(data.data.corrections).toHaveLength(1);
	});

	it('returns 404 when session not found or belongs to another user', async () => {
		mockFetch.mockResolvedValueOnce(createErrorResponse('Session not found', 404));

		const response = await fetch('/api/conversations/invalid-session', {
			method: 'GET',
			credentials: 'include'
		});

		expect(response.status).toBe(404);
	});
});

// ============================================================================
// GET /api/review/corrections TESTS
// ============================================================================

describe('GET /api/review/corrections', () => {
	const mockCorrectionsResponse = {
		corrections: [
			{
				id: 'corr-1',
				sessionId: 'session-1',
				original: 'Toi muon an pho',
				correction: 'Em muon an pho',
				explanation: "Use 'em' when speaking to someone older",
				category: 'tone',
				reviewed: false,
				createdAt: 1702000000000
			},
			{
				id: 'corr-2',
				sessionId: 'session-1',
				original: 'Ban di dau?',
				correction: 'Anh di dau?',
				explanation: 'Use appropriate pronoun for older male',
				category: 'tone',
				reviewed: true,
				reviewedAt: 1702100000000,
				confidenceLevel: 4,
				createdAt: 1701900000000
			}
		],
		stats: {
			total: 10,
			reviewed: 5,
			byCategory: {
				grammar: 2,
				tone: 5,
				vocabulary: 2,
				word_order: 1,
				pronunciation: 0
			}
		},
		pagination: {
			page: 1,
			limit: 20,
			total: 10
		}
	};

	it('returns filtered corrections with stats', async () => {
		mockFetch.mockResolvedValueOnce(createSuccessResponse(mockCorrectionsResponse));

		const response = await fetch('/api/review/corrections?reviewed=false&category=tone&limit=20', {
			method: 'GET',
			credentials: 'include'
		});

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.success).toBe(true);
		expect(data.data.corrections).toHaveLength(2);
		expect(data.data.stats).toHaveProperty('total');
		expect(data.data.stats).toHaveProperty('reviewed');
		expect(data.data.stats).toHaveProperty('byCategory');
	});

	it('returns 401 when not authenticated', async () => {
		mockFetch.mockResolvedValueOnce(createErrorResponse('Unauthorized', 401));

		const response = await fetch('/api/review/corrections', {
			method: 'GET'
		});

		expect(response.status).toBe(401);
	});
});

// ============================================================================
// PATCH /api/review/corrections/:id TESTS
// ============================================================================

describe('PATCH /api/review/corrections/:id', () => {
	const mockUpdatedCorrection = {
		id: 'corr-1',
		reviewed: true,
		reviewedAt: 1702200000000,
		confidenceLevel: 4
	};

	it('updates reviewed status and returns updated correction', async () => {
		mockFetch.mockResolvedValueOnce(createSuccessResponse(mockUpdatedCorrection));

		const response = await fetch('/api/review/corrections/corr-1', {
			method: 'PATCH',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ reviewed: true, confidenceLevel: 4 })
		});

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.success).toBe(true);
		expect(data.data.reviewed).toBe(true);
		expect(data.data.reviewedAt).toBeDefined();
		expect(data.data.confidenceLevel).toBe(4);
	});

	it('returns 404 when correction not found or belongs to another user', async () => {
		mockFetch.mockResolvedValueOnce(createErrorResponse('Correction not found', 404));

		const response = await fetch('/api/review/corrections/invalid-corr', {
			method: 'PATCH',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ reviewed: true })
		});

		expect(response.status).toBe(404);
	});

	it('returns 400 when confidenceLevel is out of range', async () => {
		mockFetch.mockResolvedValueOnce(
			createErrorResponse('confidenceLevel must be between 0 and 5', 400)
		);

		const response = await fetch('/api/review/corrections/corr-1', {
			method: 'PATCH',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ reviewed: true, confidenceLevel: 10 })
		});

		expect(response.status).toBe(400);
	});
});
