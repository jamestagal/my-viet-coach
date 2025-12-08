import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// Conversations table - tracks each coaching session
export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  topic: text("topic").notNull().default("general"),
  difficulty: text("difficulty", {
    enum: ["beginner", "intermediate", "advanced"],
  })
    .notNull()
    .default("intermediate"),
  startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
  endedAt: integer("ended_at", { mode: "timestamp" }),
  messageCount: integer("message_count").notNull().default(0),
});

// Conversation messages - individual messages in a conversation
export const conversationMessages = sqliteTable("conversation_messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
  hadCorrection: integer("had_correction", { mode: "boolean" })
    .notNull()
    .default(false),
  correctionData: text("correction_data"), // JSON: { original, corrected, explanation }
});

// Learning progress - daily aggregated stats
export const learningProgress = sqliteTable("learning_progress", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD format
  minutesPracticed: integer("minutes_practiced").notNull().default(0),
  messagesExchanged: integer("messages_exchanged").notNull().default(0),
  correctionsReceived: integer("corrections_received").notNull().default(0),
  topicsPracticed: text("topics_practiced"), // JSON array of topics
});

// Types
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;

export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type NewConversationMessage = typeof conversationMessages.$inferInsert;

export type LearningProgress = typeof learningProgress.$inferSelect;
export type NewLearningProgress = typeof learningProgress.$inferInsert;
