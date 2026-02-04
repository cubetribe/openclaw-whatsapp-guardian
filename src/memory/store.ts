import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import type { Conversation, StoredMessage, ConversationHistory } from '../types/memory';
import { countTokens } from './tokenizer';

export class ConversationStore {
  private db: Database.Database;

  constructor(dbPath: string = './data/guardian.db') {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initializeTables();
  }

  private initializeTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        phone_number TEXT UNIQUE NOT NULL,
        state TEXT DEFAULT 'active',
        escalation_reason TEXT,
        last_inbox_file TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_message_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_conv_phone ON conversations(phone_number);
      CREATE INDEX IF NOT EXISTS idx_conv_last_msg ON conversations(last_message_at);

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        token_count INTEGER,
        source TEXT DEFAULT 'guardian',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_msg_created ON messages(created_at);
    `);

    logger.info('ConversationStore tables initialized');
  }

  getOrCreateConversation(phoneNumber: string): Conversation {
    const existing = this.db
      .prepare('SELECT * FROM conversations WHERE phone_number = ?')
      .get(phoneNumber) as any;

    if (existing) {
      return this.rowToConversation(existing);
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO conversations (id, phone_number, state, created_at, last_message_at)
         VALUES (?, ?, 'active', ?, ?)`
      )
      .run(id, phoneNumber, now, now);

    logger.info({ phoneNumber, conversationId: id }, 'New conversation created');

    return {
      id,
      phoneNumber,
      state: 'active',
      createdAt: new Date(now),
      lastMessageAt: new Date(now),
    };
  }

  addMessage(
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    source: 'guardian' | 'agent' = 'guardian'
  ): StoredMessage {
    const id = uuidv4();
    const now = new Date().toISOString();
    const tokenCount = countTokens(content);

    this.db
      .prepare(
        `INSERT INTO messages (id, conversation_id, role, content, token_count, source, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, conversationId, role, content, tokenCount, source, now);

    this.db
      .prepare('UPDATE conversations SET last_message_at = ? WHERE id = ?')
      .run(now, conversationId);

    logger.debug({ conversationId, role, tokenCount, source }, 'Message added to conversation');

    return {
      id,
      conversationId,
      role,
      content,
      tokenCount,
      source,
      createdAt: new Date(now),
    };
  }

  getHistory(conversationId: string, limit: number = 15): StoredMessage[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM messages
         WHERE conversation_id = ?
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .all(conversationId, limit) as any[];

    const messages = rows.reverse().map(this.rowToMessage);

    logger.debug({ conversationId, messageCount: messages.length }, 'Retrieved conversation history');

    return messages;
  }

  getConversationHistory(conversationId: string, limit: number = 15): ConversationHistory | null {
    const convRow = this.db
      .prepare('SELECT * FROM conversations WHERE id = ?')
      .get(conversationId) as any;

    if (!convRow) {
      return null;
    }

    const conversation = this.rowToConversation(convRow);
    const messages = this.getHistory(conversationId, limit);

    return { conversation, messages };
  }

  markEscalated(conversationId: string, reason: string, inboxFile?: string): void {
    this.db
      .prepare(
        `UPDATE conversations
         SET state = 'escalated', escalation_reason = ?, last_inbox_file = ?
         WHERE id = ?`
      )
      .run(reason, inboxFile || null, conversationId);

    logger.info({ conversationId, reason }, 'Conversation marked as escalated');
  }

  markResolved(conversationId: string): void {
    this.db
      .prepare('UPDATE conversations SET state = ? WHERE id = ?')
      .run('resolved', conversationId);

    logger.info({ conversationId }, 'Conversation marked as resolved');
  }

  deleteInactiveConversations(cutoffDate: Date): number {
    const result = this.db
      .prepare(
        `DELETE FROM conversations
         WHERE last_message_at < ?
         AND state NOT IN ('escalated')`
      )
      .run(cutoffDate.toISOString());

    logger.info({ deletedCount: result.changes, cutoffDate }, 'Inactive conversations cleaned up');

    return result.changes;
  }

  private rowToConversation(row: any): Conversation {
    return {
      id: row.id,
      phoneNumber: row.phone_number,
      state: row.state,
      escalationReason: row.escalation_reason || undefined,
      lastInboxFile: row.last_inbox_file || undefined,
      createdAt: new Date(row.created_at),
      lastMessageAt: new Date(row.last_message_at),
    };
  }

  private rowToMessage(row: any): StoredMessage {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role,
      content: row.content,
      tokenCount: row.token_count || undefined,
      source: row.source,
      createdAt: new Date(row.created_at),
    };
  }

  close(): void {
    this.db.close();
    logger.info('ConversationStore closed');
  }
}
