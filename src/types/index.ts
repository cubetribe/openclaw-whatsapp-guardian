// Guardian Intent Types (Extended)
export type IntentType =
  // SELF_HANDLE - Guardian responds directly
  | 'GREETING'
  | 'FAQ_GENERAL'
  | 'BUSINESS_HOURS'
  | 'LOCATION'
  | 'OUT_OF_SCOPE'
  // ESCALATE - Forward to AI Agent
  | 'APPOINTMENT'
  | 'PRICE_QUOTE'
  | 'COMPLAINT'
  | 'COMPLEX_QUERY'
  | 'CALLBACK_REQUEST'
  | 'UNCERTAINTY';

export type Priority = 'normal' | 'urgent';

export interface InboxMetadata {
  version: string;
  timestamp: string;
  source: string;
  sender_phone: string;
  sender_name: string;
  sender_known?: boolean;
  type: 'appointment' | 'price_quote' | 'complaint' | 'complex_query' | 'callback_request' | 'uncertainty';
  priority: Priority;
  guardian_confidence?: number;
  guardian_reason?: string;
}

export interface OutboxMetadata {
  version: string;
  timestamp: string;
  recipient_phone: string;
  recipient_name: string;
  reply_to_inbox?: string;
  priority: Priority;
}

export interface ClassificationResult {
  intent: IntentType;
  confidence: number;
  requiresEscalation: boolean;
  reasoning?: string;
}

export interface MessageContext {
  phoneNumber: string;
  senderName?: string;
  message: string;
  timestamp: Date;
}
