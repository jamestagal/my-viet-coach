import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GOOGLE_API_KEY } from '$env/static/private';

interface TranscriptMessage {
	role: 'user' | 'coach';
	text: string;
	timestamp: number;
}

interface CorrectionRecord {
	original: string;
	correction: string;
	explanation: string;
	category: 'grammar' | 'tone' | 'vocabulary' | 'word_order' | 'pronunciation';
}

interface ExtractCorrectionsRequest {
	transcript: TranscriptMessage[];
	topic: string;
	difficulty: string;
}

/**
 * POST /api/private/extract-corrections
 *
 * Extracts corrections from a voice coaching session transcript using Gemini.
 *
 * Protected by hooks.server.ts - only authenticated users can access.
 */
export const POST: RequestHandler = async ({ request }) => {
	// Auth is enforced in hooks.server.ts for /api/private/* routes

	if (!GOOGLE_API_KEY) {
		throw error(500, 'Google API key not configured');
	}

	try {
		const body = (await request.json()) as ExtractCorrectionsRequest;
		const { transcript, topic, difficulty } = body;

		if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
			throw error(400, 'Transcript is required');
		}

		// Format transcript for the prompt
		const formattedTranscript = transcript
			.map((msg) => `[${msg.role === 'user' ? 'Learner' : 'Coach'}]: ${msg.text}`)
			.join('\n');

		const systemPrompt = `You are analyzing a Vietnamese language learning session transcript.
Your task is to extract all corrections the coach made to the learner's Vietnamese.

For each correction, identify:
1. What the learner said (original) - the Vietnamese text with the error
2. The corrected form (correction) - how it should be said correctly
3. A brief explanation in English (explanation)
4. The category: grammar, tone, vocabulary, word_order, or pronunciation

Only include actual corrections where the coach pointed out or fixed a mistake.
Do not include general teaching or explanations that weren't corrections.

Return a JSON array of corrections. If no corrections were made, return an empty array.

Example output:
[
  {
    "original": "Tôi đi học hôm qua",
    "correction": "Tôi đã đi học hôm qua",
    "explanation": "Use 'đã' for past tense actions",
    "category": "grammar"
  }
]`;

		const userPrompt = `Session Topic: ${topic}
Learner Level: ${difficulty}

Transcript:
${formattedTranscript}

Extract all corrections from this session. Return only the JSON array, no other text.`;

		// Use Gemini REST API for text generation
		const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`;

		const response = await fetch(geminiUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				contents: [
					{
						role: 'user',
						parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
					}
				],
				generationConfig: {
					temperature: 0.3,
					responseMimeType: 'application/json'
				}
			})
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			console.error('Gemini error:', errorData);
			throw error(response.status, errorData.error?.message || 'Failed to extract corrections');
		}

		const data = await response.json();
		const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

		if (!content) {
			return json({ corrections: [] });
		}

		try {
			// Parse the JSON response
			const parsed = JSON.parse(content);
			// Handle both array and object with corrections key
			const corrections: CorrectionRecord[] = Array.isArray(parsed)
				? parsed
				: parsed.corrections || [];

			return json({
				corrections,
				sessionSummary: {
					totalCorrections: corrections.length,
					categories: corrections.reduce(
						(acc, c) => {
							acc[c.category] = (acc[c.category] || 0) + 1;
							return acc;
						},
						{} as Record<string, number>
					)
				}
			});
		} catch (parseError) {
			console.error('Failed to parse corrections:', parseError);
			return json({ corrections: [] });
		}
	} catch (err) {
		console.error('Extract corrections error:', err);

		if (err && typeof err === 'object' && 'status' in err) {
			throw err; // Re-throw SvelteKit errors
		}

		throw error(500, 'Failed to extract corrections');
	}
};
