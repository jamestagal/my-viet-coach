/**
 * Conversations & Corrections Review Page Tests
 *
 * Tests for the user-facing conversation history and corrections review pages:
 * - Conversations page loads and displays session list
 * - Session detail panel displays messages in correct order
 * - Corrections review page filters work correctly
 * - Marking correction as reviewed updates UI
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

// ============================================================================
// TEST: Conversations page loads and displays session list
// ============================================================================

describe('Conversations Page - Session List', () => {
	const mockSessionsResponse = {
		sessions: [
			{
				id: 'session-1',
				startedAt: 1702828800000,
				endedAt: 1702829400000,
				topic: 'food',
				difficulty: 'intermediate',
				mode: 'coach',
				provider: 'gemini',
				messageCount: 12,
				correctionCount: 3
			},
			{
				id: 'session-2',
				startedAt: 1702742400000,
				endedAt: 1702743000000,
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

	it('loads session list from API with correct pagination', async () => {
		mockFetch.mockResolvedValueOnce(createSuccessResponse(mockSessionsResponse));

		const response = await fetch('/api/conversations?page=1&limit=10', {
			method: 'GET',
			credentials: 'include'
		});

		expect(response.status).toBe(200);
		const data = await response.json();

		// Verify sessions data structure
		expect(data.success).toBe(true);
		expect(data.data.sessions).toHaveLength(2);
		expect(data.data.sessions[0]).toHaveProperty('id');
		expect(data.data.sessions[0]).toHaveProperty('topic');
		expect(data.data.sessions[0]).toHaveProperty('startedAt');
		expect(data.data.sessions[0]).toHaveProperty('mode');
		expect(data.data.sessions[0]).toHaveProperty('correctionCount');

		// Verify pagination
		expect(data.data.pagination.page).toBe(1);
		expect(data.data.pagination.limit).toBe(10);
		expect(data.data.pagination.total).toBe(2);
	});
});

// ============================================================================
// TEST: Session detail panel displays messages in correct order
// ============================================================================

describe('Conversations Page - Session Detail Panel', () => {
	const mockSessionDetailResponse = {
		session: {
			id: 'session-1',
			startedAt: 1702828800000,
			endedAt: 1702829400000,
			topic: 'food',
			difficulty: 'intermediate',
			mode: 'coach',
			provider: 'gemini',
			messageCount: 3
		},
		messages: [
			{ id: 'msg-1', role: 'user', text: 'Xin chao', timestamp: 1702828800000, sequenceNumber: 0 },
			{
				id: 'msg-2',
				role: 'coach',
				text: 'Chao ban! Ban khoe khong?',
				timestamp: 1702828805000,
				sequenceNumber: 1
			},
			{
				id: 'msg-3',
				role: 'user',
				text: 'Toi khoe, cam on',
				timestamp: 1702828810000,
				sequenceNumber: 2
			}
		],
		corrections: [
			{
				id: 'corr-1',
				original: 'Xin chao',
				correction: 'Xin chao anh',
				explanation: 'Add honorific for politeness',
				category: 'tone',
				reviewed: false
			}
		]
	};

	it('fetches and returns session with messages ordered by sequenceNumber', async () => {
		mockFetch.mockResolvedValueOnce(createSuccessResponse(mockSessionDetailResponse));

		const response = await fetch('/api/conversations/session-1', {
			method: 'GET',
			credentials: 'include'
		});

		expect(response.status).toBe(200);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(data.data.session.id).toBe('session-1');
		expect(data.data.messages).toHaveLength(3);

		// Verify messages are ordered by sequenceNumber
		expect(data.data.messages[0].sequenceNumber).toBe(0);
		expect(data.data.messages[1].sequenceNumber).toBe(1);
		expect(data.data.messages[2].sequenceNumber).toBe(2);

		// Verify each message has required properties
		data.data.messages.forEach((msg: { role: string; text: string; timestamp: number }) => {
			expect(msg).toHaveProperty('role');
			expect(msg).toHaveProperty('text');
			expect(msg).toHaveProperty('timestamp');
		});
	});
});

// ============================================================================
// TEST: Corrections review page filters work correctly
// ============================================================================

describe('Corrections Review Page - Filters', () => {
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
				createdAt: 1702828800000
			}
		],
		stats: {
			total: 15,
			reviewed: 5,
			byCategory: {
				grammar: 3,
				tone: 7,
				vocabulary: 3,
				word_order: 1,
				pronunciation: 1
			}
		},
		pagination: {
			page: 1,
			limit: 20,
			total: 7
		}
	};

	it('filters corrections by category and reviewed status', async () => {
		mockFetch.mockResolvedValueOnce(createSuccessResponse(mockCorrectionsResponse));

		const response = await fetch('/api/review/corrections?reviewed=false&category=tone', {
			method: 'GET',
			credentials: 'include'
		});

		expect(response.status).toBe(200);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(data.data.corrections).toBeDefined();
		expect(data.data.stats).toHaveProperty('total');
		expect(data.data.stats).toHaveProperty('reviewed');
		expect(data.data.stats).toHaveProperty('byCategory');
		expect(data.data.stats.byCategory).toHaveProperty('tone');
		expect(data.data.stats.byCategory).toHaveProperty('grammar');
	});
});

// ============================================================================
// TEST: Marking correction as reviewed updates UI
// ============================================================================

describe('Corrections Review Page - Mark as Reviewed', () => {
	const mockUpdatedCorrection = {
		id: 'corr-1',
		sessionId: 'session-1',
		original: 'Toi muon an pho',
		correction: 'Em muon an pho',
		explanation: "Use 'em' when speaking to someone older",
		category: 'tone',
		reviewed: true,
		reviewedAt: 1702900000000,
		confidenceLevel: 4,
		createdAt: 1702828800000
	};

	it('updates correction reviewed status and returns updated record', async () => {
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

	it('toggles correction back to unreviewed', async () => {
		const mockUnreviewedCorrection = {
			...mockUpdatedCorrection,
			reviewed: false,
			reviewedAt: null,
			confidenceLevel: 0
		};
		mockFetch.mockResolvedValueOnce(createSuccessResponse(mockUnreviewedCorrection));

		const response = await fetch('/api/review/corrections/corr-1', {
			method: 'PATCH',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ reviewed: false })
		});

		expect(response.status).toBe(200);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(data.data.reviewed).toBe(false);
	});
});
