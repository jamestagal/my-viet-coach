import { t } from "../trpc-instance";
import { z } from "zod";

// Vietnamese coaching system prompt
const COACH_SYSTEM_PROMPT = `Bạn là một gia sư tiếng Việt thân thiện và kiên nhẫn. (You are a friendly and patient Vietnamese language tutor.)

Guidelines:
1. Respond primarily in Vietnamese, matching the student's level
2. Keep responses concise (2-4 sentences) for natural conversation flow
3. Gently correct major errors but don't interrupt flow for minor ones
4. Ask follow-up questions to keep the conversation going
5. Be encouraging and supportive
6. If the student seems stuck, offer helpful prompts or vocabulary

Remember: Your responses will be spoken aloud via TTS, so:
- Avoid special characters, URLs, or formatting
- Use natural spoken Vietnamese
- Include appropriate conversational particles (à, nhé, nhỉ, etc.)`;

const DIFFICULTY_INSTRUCTIONS = {
  beginner: `
- Use simple vocabulary and short sentences
- Speak slowly and clearly
- Repeat key phrases
- Use basic grammar structures
- Provide English translations for new words`,
  intermediate: `
- Use a mix of simple and complex sentences
- Introduce idiomatic expressions occasionally
- Correct errors gently with explanations
- Discuss topics with moderate depth
- Use Vietnamese mostly, with occasional English clarification`,
  advanced: `
- Use natural, native-like speech patterns
- Include idioms, proverbs, and cultural references
- Discuss abstract topics in depth
- Only use English for nuanced grammar explanations
- Challenge the learner with complex structures`,
};

const CORRECTION_PROMPT = `You are a Vietnamese language expert. Analyze the following Vietnamese text for grammatical errors, incorrect tones/diacritics, and unnatural phrasing.

Respond in JSON format:
{
  "hasErrors": boolean,
  "original": "the original text",
  "corrected": "the corrected text with proper diacritics",
  "explanation": "Brief explanation in English of what was wrong and why"
}

Pay special attention to:
- Correct diacritics: sắc (´), huyền (\`), hỏi (?), ngã (~), nặng (.)
- Proper word order (Subject-Verb-Object but with modifiers after nouns)
- Correct classifiers (cái, con, chiếc, etc.)
- Register-appropriate pronouns (tôi/mình/em/anh/chị)
- Common learner mistakes with similar-sounding words`;

export const coachTrpcRoutes = t.router({
  // Send a message and get a coaching response
  chat: t.procedure
    .input(
      z.object({
        message: z.string().min(1).max(2000),
        conversationHistory: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string(),
            })
          )
          .default([]),
        difficulty: z
          .enum(["beginner", "intermediate", "advanced"])
          .default("intermediate"),
        topic: z.string().default("general conversation"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { message, conversationHistory, difficulty, topic } = input;

      // Build the system prompt with difficulty and topic
      const systemPrompt = `${COACH_SYSTEM_PROMPT}

Current conversation topic: ${topic}
Student level: ${difficulty}

${DIFFICULTY_INSTRUCTIONS[difficulty]}`;

      // Build messages array for Claude
      const messages = [
        ...conversationHistory.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user" as const, content: message },
      ];

      // Call Anthropic API
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ctx.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: systemPrompt,
          messages,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Claude API error: ${error}`);
      }

      const data = (await response.json()) as {
        content: Array<{ type: string; text: string }>;
      };
      const assistantMessage = data.content[0]?.text || "";

      return {
        response: assistantMessage,
        role: "assistant" as const,
      };
    }),

  // Get a grammar correction for Vietnamese text
  correct: t.procedure
    .input(
      z.object({
        text: z.string().min(1).max(2000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ctx.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: CORRECTION_PROMPT,
          messages: [{ role: "user", content: input.text }],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Claude API error: ${error}`);
      }

      const data = (await response.json()) as {
        content: Array<{ type: string; text: string }>;
      };
      const content = data.content[0]?.text || "";

      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const correction = JSON.parse(jsonMatch[0]);
          return {
            hasErrors: correction.hasErrors ?? false,
            original: correction.original ?? input.text,
            corrected: correction.corrected ?? input.text,
            explanation: correction.explanation ?? "",
          };
        } catch {
          // If JSON parsing fails, return no errors
        }
      }

      return {
        hasErrors: false,
        original: input.text,
        corrected: input.text,
        explanation: "",
      };
    }),

  // Get available topics
  topics: t.procedure.query(() => {
    return [
      { value: "general", label: "Trò chuyện chung", labelEn: "General conversation" },
      { value: "food", label: "Đồ ăn và nhà hàng", labelEn: "Food and restaurants" },
      { value: "travel", label: "Du lịch Việt Nam", labelEn: "Travel in Vietnam" },
      { value: "family", label: "Gia đình và mối quan hệ", labelEn: "Family and relationships" },
      { value: "work", label: "Công việc và sự nghiệp", labelEn: "Work and career" },
      { value: "hobbies", label: "Sở thích", labelEn: "Hobbies and interests" },
      { value: "shopping", label: "Mua sắm", labelEn: "Shopping" },
      { value: "weather", label: "Thời tiết", labelEn: "Weather" },
      { value: "culture", label: "Văn hóa Việt Nam", labelEn: "Vietnamese culture" },
    ];
  }),

  // Health check for the coach API
  health: t.procedure.query(() => {
    return { status: "ok", timestamp: new Date().toISOString() };
  }),
});
