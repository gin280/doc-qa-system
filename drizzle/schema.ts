// drizzle/schema.ts
import { pgTable, pgEnum, text, integer, bigint, timestamp, jsonb, index, unique } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'

// Enums
export const authProviderEnum = pgEnum('auth_provider', ['EMAIL', 'GOOGLE', 'GITHUB'])
export const userStatusEnum = pgEnum('user_status', ['active', 'suspended', 'deleted'])
export const documentStatusEnum = pgEnum('document_status', ['PENDING', 'PARSING', 'EMBEDDING', 'READY', 'FAILED'])
export const messageRoleEnum = pgEnum('message_role', ['USER', 'ASSISTANT'])

// Users Table
export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  authProvider: authProviderEnum('auth_provider').default('EMAIL').notNull(),
  status: userStatusEnum('status').default('active').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  emailIdx: index('users_email_idx').on(table.email)
}))

// Documents Table
export const documents = pgTable('documents', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  fileSize: integer('file_size').notNull(),
  fileType: text('file_type').notNull(),
  storagePath: text('storage_path').notNull(),
  status: documentStatusEnum('status').default('PENDING').notNull(),
  chunksCount: integer('chunks_count').default(0).notNull(),
  contentLength: integer('content_length').default(0).notNull(),
  metadata: jsonb('metadata'),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
  parsedAt: timestamp('parsed_at', { withTimezone: true })
}, (table) => ({
  userIdIdx: index('documents_user_id_idx').on(table.userId),
  statusIdx: index('documents_status_idx').on(table.status)
}))

// Document Chunks Table
export const documentChunks = pgTable('document_chunks', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  documentId: text('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  embeddingId: text('embedding_id').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  documentIdIdx: index('chunks_document_id_idx').on(table.documentId),
  uniqueChunk: unique('unique_document_chunk').on(table.documentId, table.chunkIndex)
}))

// Conversations Table
export const conversations = pgTable('conversations', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  documentId: text('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  messageCount: integer('message_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  userIdIdx: index('conversations_user_id_idx').on(table.userId),
  documentIdIdx: index('conversations_document_id_idx').on(table.documentId)
}))

// Messages Table
export const messages = pgTable('messages', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  conversationId: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  role: messageRoleEnum('role').notNull(),
  content: text('content').notNull(),
  citations: jsonb('citations'),
  tokenCount: integer('token_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  conversationIdIdx: index('messages_conversation_id_idx').on(table.conversationId)
}))

// Citations Table
export const citations = pgTable('citations', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  messageId: text('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  documentId: text('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  chunkId: text('chunk_id').notNull().references(() => documentChunks.id, { onDelete: 'cascade' }),
  pageNumber: integer('page_number'),
  quoteText: text('quote_text').notNull(),
  relevanceScore: integer('relevance_score').notNull(), // 存储为整数(乘以10000)
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  messageIdIdx: index('citations_message_id_idx').on(table.messageId)
}))

// User Usage Table
export const userUsage = pgTable('user_usage', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  documentCount: integer('document_count').default(0).notNull(),
  storageUsed: bigint('storage_used', { mode: 'number' }).default(0).notNull(),
  queryCount: integer('query_count').default(0).notNull(),
  queryResetDate: timestamp('query_reset_date', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
})

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  documents: many(documents),
  conversations: many(conversations),
  usage: one(userUsage, {
    fields: [users.id],
    references: [userUsage.userId]
  })
}))

export const documentsRelations = relations(documents, ({ one, many }) => ({
  user: one(users, {
    fields: [documents.userId],
    references: [users.id]
  }),
  chunks: many(documentChunks),
  conversations: many(conversations),
  citations: many(citations)
}))

export const documentChunksRelations = relations(documentChunks, ({ one, many }) => ({
  document: one(documents, {
    fields: [documentChunks.documentId],
    references: [documents.id]
  }),
  citations: many(citations)
}))

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id]
  }),
  document: one(documents, {
    fields: [conversations.documentId],
    references: [documents.id]
  }),
  messages: many(messages)
}))

export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id]
  }),
  citations: many(citations)
}))

export const citationsRelations = relations(citations, ({ one }) => ({
  message: one(messages, {
    fields: [citations.messageId],
    references: [messages.id]
  }),
  document: one(documents, {
    fields: [citations.documentId],
    references: [documents.id]
  }),
  chunk: one(documentChunks, {
    fields: [citations.chunkId],
    references: [documentChunks.id]
  })
}))

export const userUsageRelations = relations(userUsage, ({ one }) => ({
  user: one(users, {
    fields: [userUsage.userId],
    references: [users.id]
  })
}))

// TypeScript types
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Document = typeof documents.$inferSelect
export type NewDocument = typeof documents.$inferInsert
export type DocumentChunk = typeof documentChunks.$inferSelect
export type NewDocumentChunk = typeof documentChunks.$inferInsert
export type Conversation = typeof conversations.$inferSelect
export type NewConversation = typeof conversations.$inferInsert
export type Message = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert
export type Citation = typeof citations.$inferSelect
export type NewCitation = typeof citations.$inferInsert
export type UserUsage = typeof userUsage.$inferSelect
export type NewUserUsage = typeof userUsage.$inferInsert

