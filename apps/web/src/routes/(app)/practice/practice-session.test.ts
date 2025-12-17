/**
 * Practice Page Session Flow Tests
 *
 * Tests for the practice page session data flow, specifically:
 * - Session end sends messages array in correct format
 * - Session end sends corrections array in correct format
 * - Session end sends disconnect info (code, reason, provider)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  endSession,
  type SessionEndOptions,
  type SessionMessage,
  type SessionCorrection
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

const mockEndResult = {
  sessionMinutes: 5,
  totalMinutesUsed: 10,
  minutesRemaining: 5
};

// ============================================================================
// TEST: endSession sends messages array in correct format
// ============================================================================

describe('Practice Page Session End - Messages Format', () => {
  it('sends messages array with role, text, and timestamp', async () => {
    mockFetch.mockResolvedValueOnce(createSuccessResponse(mockEndResult));

    const messages: SessionMessage[] = [
      { role: 'user', text: 'Xin chao', timestamp: 1702828800000 },
      { role: 'coach', text: 'Xin chao! Ban khoe khong?', timestamp: 1702828802000 },
      { role: 'user', text: 'Toi khoe, cam on.', timestamp: 1702828805000 }
    ];

    const options: SessionEndOptions = {
      sessionId: 'session-123',
      messages,
      messageCount: 3
    };

    await endSession(options);

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/session/end',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          sessionId: 'session-123',
          messages: [
            { role: 'user', text: 'Xin chao', timestamp: 1702828800000 },
            { role: 'coach', text: 'Xin chao! Ban khoe khong?', timestamp: 1702828802000 },
            { role: 'user', text: 'Toi khoe, cam on.', timestamp: 1702828805000 }
          ],
          messageCount: 3
        })
      })
    );
  });
});

// ============================================================================
// TEST: endSession sends corrections array in correct format
// ============================================================================

describe('Practice Page Session End - Corrections Format', () => {
  it('sends corrections array with original, correction, explanation, and category', async () => {
    mockFetch.mockResolvedValueOnce(createSuccessResponse(mockEndResult));

    const corrections: SessionCorrection[] = [
      {
        original: 'Toi di cho',
        correction: 'Toi di cho',
        explanation: 'Add the correct tone marks for "cho" (market)',
        category: 'pronunciation'
      },
      {
        original: 'Toi thich an pho',
        correction: 'Toi thich an pho',
        explanation: 'Correct usage of "thich" (like)',
        category: 'vocabulary'
      }
    ];

    const options: SessionEndOptions = {
      sessionId: 'session-456',
      corrections
    };

    await endSession(options);

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/session/end',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          sessionId: 'session-456',
          corrections: [
            {
              original: 'Toi di cho',
              correction: 'Toi di cho',
              explanation: 'Add the correct tone marks for "cho" (market)',
              category: 'pronunciation'
            },
            {
              original: 'Toi thich an pho',
              correction: 'Toi thich an pho',
              explanation: 'Correct usage of "thich" (like)',
              category: 'vocabulary'
            }
          ]
        })
      })
    );
  });
});

// ============================================================================
// TEST: endSession sends disconnect info (code, reason, provider)
// ============================================================================

describe('Practice Page Session End - Disconnect Info', () => {
  it('sends disconnect code, reason, provider, and providerSwitched', async () => {
    mockFetch.mockResolvedValueOnce(createSuccessResponse(mockEndResult));

    const options: SessionEndOptions = {
      sessionId: 'session-789',
      disconnectCode: 1006,
      disconnectReason: 'Connection lost unexpectedly',
      provider: 'openai',
      providerSwitched: true,
      messageCount: 10
    };

    await endSession(options);

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/session/end',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          sessionId: 'session-789',
          disconnectCode: 1006,
          disconnectReason: 'Connection lost unexpectedly',
          provider: 'openai',
          providerSwitched: true,
          messageCount: 10
        })
      })
    );
  });

  it('sends complete session data with messages, corrections, and disconnect info', async () => {
    mockFetch.mockResolvedValueOnce(createSuccessResponse(mockEndResult));

    const messages: SessionMessage[] = [
      { role: 'user', text: 'Xin chao', timestamp: 1702828800000 },
      { role: 'coach', text: 'Chao ban!', timestamp: 1702828802000 }
    ];

    const corrections: SessionCorrection[] = [
      {
        original: 'xin chao',
        correction: 'Xin chao',
        explanation: 'Capitalize the first word',
        category: 'grammar'
      }
    ];

    const options: SessionEndOptions = {
      sessionId: 'session-complete',
      disconnectCode: 1000,
      disconnectReason: 'Normal closure',
      provider: 'gemini',
      providerSwitched: false,
      messageCount: 2,
      messages,
      corrections
    };

    await endSession(options);

    const call = mockFetch.mock.calls[0];
    const body = JSON.parse(call[1].body);

    expect(body).toEqual({
      sessionId: 'session-complete',
      disconnectCode: 1000,
      disconnectReason: 'Normal closure',
      provider: 'gemini',
      providerSwitched: false,
      messageCount: 2,
      messages: [
        { role: 'user', text: 'Xin chao', timestamp: 1702828800000 },
        { role: 'coach', text: 'Chao ban!', timestamp: 1702828802000 }
      ],
      corrections: [
        {
          original: 'xin chao',
          correction: 'Xin chao',
          explanation: 'Capitalize the first word',
          category: 'grammar'
        }
      ]
    });
  });
});
