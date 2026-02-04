export interface Conversation {
  id: string;
  phoneNumber: string;
  state: 'active' | 'escalated' | 'resolved';
  escalationReason?: string;
  lastInboxFile?: string;
  createdAt: Date;
  lastMessageAt: Date;
}

export interface StoredMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokenCount?: number;
  source: 'guardian' | 'agent';
  createdAt: Date;
}

export interface ConversationHistory {
  conversation: Conversation;
  messages: StoredMessage[];
}
