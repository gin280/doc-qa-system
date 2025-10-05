// Mock for @/drizzle/schema - used in Jest tests
import { pgTable, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core'

export const documents = pgTable('documents', {
  id: text('id'),
  userId: text('user_id'),
  filename: text('filename'),
  fileSize: integer('file_size'),
  fileType: text('file_type'),
  storagePath: text('storage_path'),
  status: text('status'),
  contentLength: integer('content_length'),
  parsedAt: timestamp('parsed_at'),
  metadata: jsonb('metadata'),
  uploadedAt: timestamp('uploaded_at'),
})

export const users = pgTable('users', {
  id: text('id'),
  email: text('email'),
  name: text('name'),
})

export const userUsage = pgTable('user_usage', {
  id: text('id'),
  userId: text('user_id'),
})

export const documentStatusEnum = () => 'status'
