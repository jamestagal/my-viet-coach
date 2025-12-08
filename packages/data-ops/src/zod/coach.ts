import { z } from "zod";

// Difficulty levels
export const difficultySchema = z.enum(["beginner", "intermediate", "advanced"]);
export type Difficulty = z.infer<typeof difficultySchema>;

// Available conversation topics
export const topicSchema = z.enum([
  "general",
  "food",
  "travel",
  "family",
  "work",
  "hobbies",
  "shopping",
  "weather",
  "culture",
]);
export type Topic = z.infer<typeof topicSchema>;

// Message roles
export const messageRoleSchema = z.enum(["user", "assistant"]);
export type MessageRole = z.infer<typeof messageRoleSchema>;

// Conversation schemas
export const createConversationSchema = z.object({
  topic: topicSchema.default("general"),
  difficulty: difficultySchema.default("intermediate"),
});
export type CreateConversation = z.infer<typeof createConversationSchema>;

export const conversationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  topic: topicSchema,
  difficulty: difficultySchema,
  startedAt: z.date(),
  endedAt: z.date().nullable(),
  messageCount: z.number(),
});
export type Conversation = z.infer<typeof conversationSchema>;

// Message schemas
export const sendMessageSchema = z.object({
  conversationId: z.string(),
  content: z.string().min(1).max(2000),
});
export type SendMessage = z.infer<typeof sendMessageSchema>;

export const correctionDataSchema = z.object({
  original: z.string(),
  corrected: z.string(),
  explanation: z.string(),
});
export type CorrectionData = z.infer<typeof correctionDataSchema>;

export const messageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  role: messageRoleSchema,
  content: z.string(),
  timestamp: z.date(),
  hadCorrection: z.boolean(),
  correctionData: correctionDataSchema.nullable(),
});
export type Message = z.infer<typeof messageSchema>;

// Coach request schemas
export const coachRequestSchema = z.object({
  conversationId: z.string(),
  userMessage: z.string().min(1),
});
export type CoachRequest = z.infer<typeof coachRequestSchema>;

export const correctionRequestSchema = z.object({
  text: z.string().min(1),
});
export type CorrectionRequest = z.infer<typeof correctionRequestSchema>;

export const correctionResponseSchema = z.object({
  hasErrors: z.boolean(),
  original: z.string(),
  corrected: z.string(),
  explanation: z.string(),
});
export type CorrectionResponse = z.infer<typeof correctionResponseSchema>;

// Learning progress schemas
export const progressSchema = z.object({
  id: z.string(),
  userId: z.string(),
  date: z.string(), // YYYY-MM-DD
  minutesPracticed: z.number(),
  messagesExchanged: z.number(),
  correctionsReceived: z.number(),
  topicsPracticed: z.array(topicSchema),
});
export type Progress = z.infer<typeof progressSchema>;

export const progressSummarySchema = z.object({
  totalMinutes: z.number(),
  totalMessages: z.number(),
  totalCorrections: z.number(),
  streak: z.number(), // consecutive days
  lastPracticeDate: z.string().nullable(),
});
export type ProgressSummary = z.infer<typeof progressSummarySchema>;
