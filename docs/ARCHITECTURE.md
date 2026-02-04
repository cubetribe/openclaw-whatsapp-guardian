# WhatsApp Guardian - Architecture

This document describes the architecture and design decisions behind WhatsApp Guardian.

## Overview

WhatsApp Guardian is designed as a **filter layer** between WhatsApp and your AI agent. It follows these core principles:

1. **Security First** - Sanitize inputs, detect attacks, redact PII
2. **Simple Integration** - File-based communication, no complex APIs
3. **Stateful Conversations** - Full context preservation
4. **Efficient Processing** - Handle routine requests locally

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           WhatsApp Guardian                             │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                        Inbound Pipeline                           │  │
│  │                                                                   │  │
│  │  WhatsApp ──▶ Baileys ──▶ Handler ──▶ Sanitizer ──▶ Classifier   │  │
│  │     │                                      │            │         │  │
│  │     │                                      │            │         │  │
│  │     │                                 [blocked]   [escalate/handle]│  │
│  │     │                                      │            │         │  │
│  │     │                                      ▼            ▼         │  │
│  │     │                                  Dropped    Decision Router │  │
│  │     │                                                   │         │  │
│  │     │                                    ┌──────────────┴─────┐   │  │
│  │     │                                    │                    │   │  │
│  │     │                                    ▼                    ▼   │  │
│  │     │                            [Self-Handle]         [Escalate] │  │
│  │     │                                    │                    │   │  │
│  │     │                                    ▼                    ▼   │  │
│  │     │                              GPT Response        Inbox Writer│  │
│  │     │                                    │                    │   │  │
│  │     │                                    │                    │   │  │
│  │     ▼                                    ▼                    ▼   │  │
│  │   Memory ◀────────────────────────── Store ◀──────────── Store   │  │
│  │   (SQLite)                                                        │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                        Outbound Pipeline                          │  │
│  │                                                                   │  │
│  │   Outbox Dir ──▶ Watcher ──▶ Processor ──▶ Validator ──▶ Sender  │  │
│  │                                    │                        │     │  │
│  │                                    ▼                        ▼     │  │
│  │                              Memory Store              WhatsApp   │  │
│  │                                                                   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                        Supporting Services                        │  │
│  │                                                                   │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │  │
│  │  │  Logger  │  │ Webhook  │  │ Cleanup  │  │    Web Server    │  │  │
│  │  │ (PII-    │  │ Notifier │  │   Job    │  │   (QR Login)     │  │  │
│  │  │ Redacted)│  │          │  │  (Daily) │  │                  │  │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘  │  │
│  │                                                                   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. WhatsApp Client (`src/whatsapp/`)

**Responsibility:** Connect to WhatsApp and handle low-level message events.

- Uses Baileys library for WhatsApp Web protocol
- Handles authentication (QR code / pairing code)
- Manages reconnection on disconnect
- Sends outgoing messages

**Key Files:**
- `client.ts` - Main WhatsApp connection
- `handlers.ts` - Message event handlers
- `session.ts` - Session persistence

### 2. Input Sanitizer (`src/sanitizer/`)

**Responsibility:** Clean and validate incoming messages for security.

Features:
- Length truncation (configurable max)
- Prompt injection detection
- Control character removal
- Suspicious pattern detection (base64, hex encoding)

**Key Files:**
- `input.ts` - Main sanitizer class
- `patterns.ts` - Detection patterns

### 3. Message Classifier (`src/ai/`)

**Responsibility:** Determine message intent and routing decision.

Uses OpenAI GPT to classify messages into intents:
- `GREETING` - Simple greetings → Self-handle
- `FAQ_GENERAL` - Common questions → Self-handle
- `APPOINTMENT` - Scheduling requests → Escalate
- `COMPLAINT` - Customer issues → Escalate
- `COMPLEX_QUERY` - Multi-part questions → Escalate
- `UNCERTAINTY` - Unknown intent → Escalate (safe default)

**Key Files:**
- `client.ts` - OpenAI API wrapper
- `classifier.ts` - Classification logic
- `prompt.ts` - Prompt template builder

### 4. Conversation Memory (`src/memory/`)

**Responsibility:** Store and manage conversation history.

Features:
- SQLite with WAL mode for performance
- Automatic token counting
- History trimming to token limit
- State tracking (active/escalated/resolved)
- Automatic cleanup of old conversations

**Schema:**
```sql
conversations (
  id TEXT PRIMARY KEY,
  phone_number TEXT UNIQUE,
  state TEXT,           -- active, escalated, resolved
  escalation_reason TEXT,
  last_inbox_file TEXT,
  created_at TEXT,
  last_message_at TEXT
)

messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT,
  role TEXT,            -- user, assistant, system
  content TEXT,
  token_count INTEGER,
  source TEXT,          -- guardian, agent
  created_at TEXT
)
```

**Key Files:**
- `store.ts` - SQLite operations
- `tokenizer.ts` - Token counting (tiktoken)
- `trimmer.ts` - History trimming
- `cleanup.ts` - Scheduled cleanup

### 5. Inbox Writer (`src/inbox/`)

**Responsibility:** Create escalation files for the AI agent.

Format: YAML frontmatter + Markdown body

```yaml
---
version: "1.2"
timestamp: "2024-01-15T10:30:00Z"
source: whatsapp-guardian
sender_phone: "1234567890"
sender_name: "John Doe"
type: appointment
priority: normal
conversation_id: "abc-123"
conversation_state: escalated
guardian_confidence: 0.85
guardian_reason: "Customer requesting appointment scheduling"
---

# Summary
Customer wants to schedule a consultation.

## Original Message
> I'd like to book an appointment.

## Conversation History
- [User 10:28]: Hello!
- [Assistant 10:28]: Hi! How can I help?
- [User 10:30]: I'd like to book an appointment.
```

### 6. Outbox Processor (`src/outbox/`)

**Responsibility:** Watch for and send outgoing messages.

Features:
- File system watcher (chokidar)
- Message validation
- Retry with backoff
- Sent/failed archival
- Memory store integration

### 7. Webhook Notifier (`src/webhook/`)

**Responsibility:** HTTP notifications for real-time integrations.

Features:
- Configurable endpoint
- Exponential backoff retry
- Timeout handling
- Fire-and-forget (non-blocking)

## Data Flow

### Incoming Message Flow

```
1. WhatsApp message received
2. Handler extracts text, sender info
3. Check blocklist
4. Sanitizer validates input
   - If blocked → Drop message
5. Memory: Get/create conversation
6. Memory: Store user message
7. Classifier determines intent
   - If self-handle → Generate GPT response
   - If escalate → Write inbox file, notify webhook
8. Memory: Store assistant message
9. Send response to WhatsApp
```

### Outgoing Message Flow

```
1. File created in outbox directory
2. Watcher detects new file
3. Processor reads and validates
4. Verify recipient on WhatsApp
5. Send message
6. Memory: Store message (if conversation_id present)
7. Move file to sent/ or failed/
```

## Design Decisions

### Why File-Based Communication?

1. **Simplicity** - No database dependencies for the AI agent
2. **Debugging** - Easy to inspect, modify, replay messages
3. **Flexibility** - Works with any language/framework
4. **Reliability** - Files persist through restarts
5. **Decoupling** - Guardian and agent are fully independent

### Why SQLite for Memory?

1. **Zero dependencies** - No separate database server
2. **Fast** - WAL mode for concurrent reads
3. **Portable** - Single file, easy backup
4. **Reliable** - ACID transactions
5. **Sufficient** - Memory is per-instance, not distributed

### Why OpenAI for Classification?

1. **Accuracy** - Best-in-class language understanding
2. **Flexibility** - Easy to customize via prompts
3. **Speed** - Low latency for real-time chat
4. **Reliability** - Stable API with good uptime

## Scaling Considerations

### Current Limitations

- Single WhatsApp number per instance
- In-process memory (SQLite)
- Single-server deployment

### Future Scaling Options

1. **Multiple Numbers** - Run multiple Guardian instances
2. **Redis Memory** - Replace SQLite for distributed state
3. **Message Queue** - Add RabbitMQ/Redis for async processing
4. **Kubernetes** - Containerize for orchestration

## Error Handling

### Levels of Recovery

1. **Retry** - Transient failures (network, API)
2. **Fallback** - Classification errors → Escalate
3. **Graceful Degradation** - Memory failures → Continue without history
4. **Circuit Breaker** - Repeated failures → Stop retrying

### Logging Strategy

- Structured JSON logs (pino)
- PII redaction (phone, email patterns)
- Separate log levels per module
- Pretty printing in development

## Testing Strategy

### Unit Tests
- Sanitizer patterns
- Token counting
- History trimming
- Classification parsing

### Integration Tests
- File system operations
- SQLite transactions
- OpenAI API mocking

### End-to-End Tests
- Full message flow
- Error scenarios
- Reconnection handling
