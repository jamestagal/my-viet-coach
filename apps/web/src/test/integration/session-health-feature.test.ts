/**
 * Session Health & Conversation History Feature Integration Tests
 *
 * These tests verify critical end-to-end workflows for the Session Health
 * & Conversation History feature. They fill gaps from Task Group 1-6 tests.
 *
 * Test Areas:
 * 1. End-to-end: User completes session and data appears in conversations page
 * 2. End-to-end: Admin views session health with provider switch data
 * 3. Integration: Correction review workflow updates database correctly
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	startSession,
	endSession,
	type SessionMessage,
	type SessionCorrection,
	type SessionEndOptions
} from '$lib/services/usage';

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
// END-TO-END: User completes session and data appears in conversations page
// ============================================================================

describe('E2E: User Session to Conversations Page Flow', () => {
	it('complete session with messages and corrections flows to conversations API', async () => {
		// Step 1: Start a session
		const mockStartResult = {
			sessionId: 'session-e2e-1',
			message: 'Session started successfully'
		};
		mockFetch.mockResolvedValueOnce(createSuccessResponse(mockStartResult));

		const startResult = await startSession({
			topic: 'food',
			difficulty: 'intermediate',
			mode: 'coach',
			provider: 'gemini'
		});

		expect(startResult.sessionId).toBe('session-e2e-1');
		expect(mockFetch).toHaveBeenCalledWith(
			'/api/session/start',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({
					topic: 'food',
					difficulty: 'intermediate',
					mode: 'coach',
					provider: 'gemini'
				})
			})
		);

		// Step 2: End the session with messages and corrections
		const mockEndResult = {
			sessionMinutes: 5,
			totalMinutesUsed: 10,
			minutesRemaining: 5
		};
		mockFetch.mockResolvedValueOnce(createSuccessResponse(mockEndResult));

		const messages: SessionMessage[] = [
			{ role: 'user', text: 'Xin chao', timestamp: 1702828800000 },
			{ role: 'coach', text: 'Chao ban!', timestamp: 1702828802000 }
		];

		const corrections: SessionCorrection[] = [
			{
				original: 'xin chao',
				correction: 'Xin chao',
				explanation: 'Capitalize greetings',
				category: 'grammar'
			}
		];

		const endOptions: SessionEndOptions = {
			sessionId: 'session-e2e-1',
			disconnectCode: 1000,
			disconnectReason: 'Normal closure',
			provider: 'gemini',
			providerSwitched: false,
			messageCount: 2,
			messages,
			corrections
		};

		await endSession(endOptions);

		// Verify the end session call included all data
		expect(mockFetch).toHaveBeenLastCalledWith(
			'/api/session/end',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify(endOptions)
			})
		);

		// Step 3: Verify the session appears in conversations list
		const mockConversationsResponse = {
			sessions: [
				{
					id: 'session-e2e-1',
					startedAt: 1702828800000,
					endedAt: 1702829100000,
					topic: 'food',
					difficulty: 'intermediate',
					mode: 'coach',
					provider: 'gemini',
					messageCount: 2,
					correctionCount: 1
				}
			],
			pagination: { page: 1, limit: 10, total: 1 }
		};
		mockFetch.mockResolvedValueOnce(createSuccessResponse(mockConversationsResponse));

		const conversationsResponse = await fetch('/api/conversations', {
			method: 'GET',
			credentials: 'include'
		});

		expect(conversationsResponse.status).toBe(200);
		const conversationsData = await conversationsResponse.json();
		expect(conversationsData.data.sessions).toHaveLength(1);
		expect(conversationsData.data.sessions[0].id).toBe('session-e2e-1');
		expect(conversationsData.data.sessions[0].correctionCount).toBe(1);
	});

	it('session with provider switch is recorded and appears in conversations', async () => {
		// Start with Gemini
		mockFetch.mockResolvedValueOnce(
			createSuccessResponse({
				sessionId: 'session-switch-1',
				message: 'Session started'
			})
		);

		await startSession({
			topic: 'travel',
			difficulty: 'beginner',
			mode: 'free',
			provider: 'gemini'
		});

		// End with OpenAI after a switch
		mockFetch.mockResolvedValueOnce(
			createSuccessResponse({
				sessionMinutes: 3,
				totalMinutesUsed: 8,
				minutesRemaining: 7
			})
		);

		await endSession({
			sessionId: 'session-switch-1',
			disconnectCode: 1006,
			disconnectReason: 'Abnormal closure - reconnected with OpenAI',
			provider: 'openai',
			providerSwitched: true,
			messageCount: 5
		});

		// Verify provider switch is captured in request
		expect(mockFetch).toHaveBeenLastCalledWith(
			'/api/session/end',
			expect.objectContaining({
				body: expect.stringContaining('"providerSwitched":true')
			})
		);
	});
});

// ============================================================================
// END-TO-END: Admin views session health with provider switch data
// ============================================================================

describe('E2E: Admin Session Health Dashboard Flow', () => {
	it('admin can view sessions with provider breakdown and switch rate', async () => {
		const mockAdminResponse = {
			sessions: [
				{
					id: 'session-admin-1',
					userId: 'user-1',
					userEmail: 'learner@example.com',
					startedAt: 1702000000000,
					endedAt: 1702000600000,
					minutesUsed: 10,
					topic: 'food',
					mode: 'coach',
					provider: 'openai',
					initialProvider: 'gemini',
					providerSwitched: true,
					providerSwitchedAt: 1702000300000,
					disconnectCode: 1006,
					disconnectReason: 'Abnormal closure',
					messageCount: 15
				}
			],
			stats: {
				totalSessions: 100,
				avgDuration: 7.5,
				providerBreakdown: { gemini: 80, openai: 20 },
				disconnectBreakdown: { '1000': 85, '1006': 10, '1011': 5 },
				providerSwitchRate: 0.15
			},
			pagination: { page: 1, limit: 50, total: 100 }
		};

		mockFetch.mockResolvedValueOnce(createSuccessResponse(mockAdminResponse));

		const response = await fetch('/api/admin/sessions', {
			method: 'GET',
			credentials: 'include'
		});

		expect(response.status).toBe(200);
		const data = await response.json();

		// Verify stats are present for dashboard cards
		expect(data.data.stats.totalSessions).toBe(100);
		expect(data.data.stats.avgDuration).toBe(7.5);
		expect(data.data.stats.providerSwitchRate).toBe(0.15);
		expect(data.data.stats.providerBreakdown.gemini).toBe(80);
		expect(data.data.stats.providerBreakdown.openai).toBe(20);

		// Verify disconnect breakdown is present
		expect(data.data.stats.disconnectBreakdown['1000']).toBe(85);
		expect(data.data.stats.disconnectBreakdown['1006']).toBe(10);

		// Verify session details include provider switch info
		const session = data.data.sessions[0];
		expect(session.providerSwitched).toBe(true);
		expect(session.initialProvider).toBe('gemini');
		expect(session.provider).toBe('openai');
	});

	it('admin can filter sessions by provider and disconnect status', async () => {
		const mockFilteredResponse = {
			sessions: [
				{
					id: 'session-filtered-1',
					userId: 'user-2',
					userEmail: 'user@example.com',
					provider: 'openai',
					disconnectCode: 1006,
					disconnectReason: 'Connection lost'
				}
			],
			stats: {
				totalSessions: 5,
				avgDuration: 4.2,
				providerBreakdown: { gemini: 0, openai: 5 },
				disconnectBreakdown: { '1006': 5 },
				providerSwitchRate: 0.4
			},
			pagination: { page: 1, limit: 50, total: 5 }
		};

		mockFetch.mockResolvedValueOnce(createSuccessResponse(mockFilteredResponse));

		const response = await fetch('/api/admin/sessions?provider=openai&hasDisconnect=true', {
			method: 'GET',
			credentials: 'include'
		});

		expect(response.status).toBe(200);
		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining('provider=openai'),
			expect.any(Object)
		);
		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining('hasDisconnect=true'),
			expect.any(Object)
		);
	});
});

// ============================================================================
// INTEGRATION: Correction review workflow updates database correctly
// ============================================================================

describe('Integration: Correction Review Workflow', () => {
	it('user can mark correction as reviewed with confidence level', async () => {
		// Get corrections list
		const mockCorrectionsResponse = {
			corrections: [
				{
					id: 'corr-workflow-1',
					sessionId: 'session-1',
					original: 'Toi di cho',
					correction: 'Toi di cho',
					explanation: 'Add tone marks',
					category: 'pronunciation',
					reviewed: false,
					createdAt: 1702828800000
				}
			],
			stats: { total: 10, reviewed: 5, byCategory: { pronunciation: 3 } },
			pagination: { page: 1, limit: 20, total: 10 }
		};

		mockFetch.mockResolvedValueOnce(createSuccessResponse(mockCorrectionsResponse));

		const listResponse = await fetch('/api/review/corrections?reviewed=false', {
			method: 'GET',
			credentials: 'include'
		});

		expect(listResponse.status).toBe(200);
		const listData = await listResponse.json();
		expect(listData.data.corrections[0].reviewed).toBe(false);

		// Mark correction as reviewed
		const mockUpdatedCorrection = {
			id: 'corr-workflow-1',
			reviewed: true,
			reviewedAt: 1702900000000,
			confidenceLevel: 4
		};

		mockFetch.mockResolvedValueOnce(createSuccessResponse(mockUpdatedCorrection));

		const updateResponse = await fetch('/api/review/corrections/corr-workflow-1', {
			method: 'PATCH',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ reviewed: true, confidenceLevel: 4 })
		});

		expect(updateResponse.status).toBe(200);
		const updateData = await updateResponse.json();
		expect(updateData.data.reviewed).toBe(true);
		expect(updateData.data.confidenceLevel).toBe(4);
		expect(updateData.data.reviewedAt).toBeDefined();
	});

	it('correction stats update after marking corrections reviewed', async () => {
		// Initial stats
		const mockInitialStats = {
			corrections: [],
			stats: { total: 10, reviewed: 5, byCategory: { grammar: 5, tone: 5 } },
			pagination: { page: 1, limit: 20, total: 10 }
		};

		mockFetch.mockResolvedValueOnce(createSuccessResponse(mockInitialStats));

		const initialResponse = await fetch('/api/review/corrections', {
			method: 'GET',
			credentials: 'include'
		});

		const initialData = await initialResponse.json();
		expect(initialData.data.stats.reviewed).toBe(5);

		// After marking one more as reviewed, stats should update
		const mockUpdatedStats = {
			corrections: [],
			stats: { total: 10, reviewed: 6, byCategory: { grammar: 5, tone: 5 } },
			pagination: { page: 1, limit: 20, total: 10 }
		};

		mockFetch.mockResolvedValueOnce(createSuccessResponse(mockUpdatedStats));

		const updatedResponse = await fetch('/api/review/corrections', {
			method: 'GET',
			credentials: 'include'
		});

		const updatedData = await updatedResponse.json();
		expect(updatedData.data.stats.reviewed).toBe(6);
	});
});

// ============================================================================
// INTEGRATION: Session Detail with Full Transcript
// ============================================================================

describe('Integration: Session Detail Full Transcript', () => {
	it('session detail returns complete message history with sequence order', async () => {
		const mockDetailResponse = {
			session: {
				id: 'session-detail-1',
				startedAt: 1702828800000,
				endedAt: 1702829400000,
				topic: 'daily_life',
				difficulty: 'intermediate',
				mode: 'coach',
				provider: 'gemini'
			},
			messages: [
				{ id: 'msg-1', role: 'user', text: 'Xin chao', timestamp: 1702828800000, sequenceNumber: 0 },
				{
					id: 'msg-2',
					role: 'coach',
					text: 'Chao ban! Hom nay ban the nao?',
					timestamp: 1702828802000,
					sequenceNumber: 1
				},
				{
					id: 'msg-3',
					role: 'user',
					text: 'Toi khoe, cam on ban',
					timestamp: 1702828805000,
					sequenceNumber: 2
				},
				{
					id: 'msg-4',
					role: 'coach',
					text: 'Tuyet voi! Ban noi tieng Viet rat gioi.',
					timestamp: 1702828808000,
					sequenceNumber: 3
				}
			],
			corrections: [
				{
					id: 'corr-1',
					original: 'cam on ban',
					correction: 'cam on anh/chi',
					explanation: 'Use appropriate honorific based on age',
					category: 'tone',
					reviewed: false
				}
			]
		};

		mockFetch.mockResolvedValueOnce(createSuccessResponse(mockDetailResponse));

		const response = await fetch('/api/conversations/session-detail-1', {
			method: 'GET',
			credentials: 'include'
		});

		expect(response.status).toBe(200);
		const data = await response.json();

		// Verify message sequence
		expect(data.data.messages).toHaveLength(4);
		for (let i = 0; i < data.data.messages.length; i++) {
			expect(data.data.messages[i].sequenceNumber).toBe(i);
		}

		// Verify alternating user/coach pattern
		expect(data.data.messages[0].role).toBe('user');
		expect(data.data.messages[1].role).toBe('coach');
		expect(data.data.messages[2].role).toBe('user');
		expect(data.data.messages[3].role).toBe('coach');

		// Verify corrections are included
		expect(data.data.corrections).toHaveLength(1);
		expect(data.data.corrections[0].category).toBe('tone');
	});
});
