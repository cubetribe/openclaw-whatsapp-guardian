# 🛡️ WhatsApp Guardian

> **AI-Powered Message Filter for WhatsApp** - Protect your AI agent from spam and noise. Let the Guardian handle routine inquiries while escalating important conversations.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

---

## 🎯 The Problem

Building AI agents that handle WhatsApp messages? You'll quickly discover:

- 📨 **Too much noise** - Spam, greetings, and trivial messages flood your agent
- 💸 **Expensive API calls** - Every message hits your LLM, burning through tokens
- ⚡ **Slow responses** - Complex agent logic adds latency to simple questions
- 🔒 **Security risks** - Prompt injection and malicious inputs target your agent

## 💡 The Solution

**WhatsApp Guardian** acts as an intelligent filter layer between WhatsApp and your AI agent:

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│  WhatsApp   │────▶│    Guardian     │────▶│  Your AI    │
│   Users     │     │  (Filter Layer) │     │   Agent     │
└─────────────┘     └─────────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   Direct    │
                    │  Responses  │
                    └─────────────┘
```

The Guardian:
- ✅ **Handles routine inquiries** - FAQs, greetings, business hours
- ✅ **Escalates important messages** - Appointments, complaints, complex queries
- ✅ **Blocks malicious input** - Prompt injection detection built-in
- ✅ **Maintains conversation context** - Full history available when escalating

---

## ✨ Features

### 🧠 Intelligent Message Classification
- AI-powered intent detection (OpenAI GPT)
- Configurable escalation rules
- Confidence scoring

### 💬 Conversation Memory
- SQLite-based conversation storage
- Automatic token-aware history trimming
- 30-day retention with auto-cleanup

### 📥 File-Based Integration (Inbox/Outbox)
- Simple markdown files for message passing
- No complex APIs needed
- Works with any AI agent framework

### 🔔 Real-Time Webhooks
- Optional HTTP notifications on escalation
- Configurable retry with exponential backoff

### 🛡️ Security First
- Prompt injection pattern detection
- Input sanitization
- PII redaction in logs
- Phone number blocklist

### 🖥️ Web-Based QR Login
- Beautiful QR code page
- Real-time status via WebSocket
- Pairing code support

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- OpenAI API key

### Installation

```bash
# Clone the repository
git clone https://github.com/openclaw/whatsapp-guardian.git
cd whatsapp-guardian

# Install dependencies
npm install

# Copy example config
cp .env.example .env

# Edit .env with your settings
nano .env

# Copy config templates
cp config/business-info.example.md config/business-info.md
cp config/faqs.example.md config/faqs.md
cp config/system-prompt.example.md config/system-prompt.md

# Build the project
npm run build

# Start the QR web server for first-time setup
npm run start:web
```

### First-Time Setup

1. Open `http://localhost:3333` in your browser
2. Scan the QR code with WhatsApp (Settings → Linked Devices)
3. Once connected, stop the web server
4. Start the Guardian: `npm start`

---

## 📁 Project Structure

```
whatsapp-guardian/
├── src/
│   ├── ai/           # OpenAI integration & classification
│   ├── config/       # Configuration loading
│   ├── inbox/        # Escalation file writer
│   ├── memory/       # SQLite conversation store
│   ├── outbox/       # Outgoing message processor
│   ├── sanitizer/    # Input sanitization & security
│   ├── types/        # TypeScript types
│   ├── utils/        # Logger with PII redaction
│   ├── web/          # QR code web interface
│   ├── webhook/      # HTTP notifications
│   └── whatsapp/     # Baileys WhatsApp client
├── config/           # Business info, FAQs, prompts
├── data/             # Runtime data (auth, messages, db)
└── docs/             # Documentation
```

---

## 🔧 Configuration

### Environment Variables

See `.env.example` for all options. Key settings:

```env
# Required
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o

# Security
BLOCKED_SENDERS=1234567890,9876543210

# Webhook (optional)
WEBHOOK_ENABLED=true
WEBHOOK_URL=http://your-agent/webhook
```

### Customizing the Guardian

Edit files in `config/`:

- **`business-info.md`** - Your company details
- **`faqs.md`** - Common questions and answers
- **`system-prompt.md`** - Guardian's personality and rules

---

## 📨 Inbox/Outbox Format

### Inbox Files (Guardian → Your Agent)

When the Guardian escalates a message, it creates a markdown file:

```markdown
---
version: "1.2"
timestamp: "2024-01-15T10:30:00Z"
source: whatsapp-guardian
sender_phone: "1234567890"
sender_name: "John Doe"
type: appointment
priority: normal
conversation_id: "abc-123-def"
---

# Summary
Customer wants to schedule a consultation for next week.

## Original Message
> Hi, I'd like to book an appointment for next Tuesday.

## Conversation History
- [User 10:28]: Hello!
- [Assistant 10:28]: Hi! How can I help you today?
- [User 10:30]: I'd like to book an appointment for next Tuesday.
```

### Outbox Files (Your Agent → Guardian)

To send a response, create a markdown file in the outbox:

```markdown
---
version: "1.1"
timestamp: "2024-01-15T10:35:00Z"
recipient_phone: "1234567890"
recipient_name: "John Doe"
conversation_id: "abc-123-def"
priority: normal
---

Great! I have availability on Tuesday at 2 PM or 4 PM. Which works better for you?
```

---

## 🔌 Integration Examples

### OpenClaw Integration

The Guardian is designed to work seamlessly with [OpenClaw](https://github.com/openclaw):

```typescript
// In your OpenClaw agent
const inboxWatcher = new InboxWatcher('./data/inbox');

inboxWatcher.on('escalation', async (message) => {
  const response = await processWithAgent(message);
  await writeOutboxFile(response);
});
```

### Custom Integration

Use the webhook for real-time notifications:

```javascript
// Your webhook endpoint
app.post('/webhook/guardian', (req, res) => {
  const { conversation_id, summary, sender_name } = req.body;
  
  // Process the escalation
  notifyAgent(conversation_id, summary);
  
  res.status(200).send('OK');
});
```

---

## 🏗️ Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed system design.

```
┌───────────────────────────────────────────────────────────────┐
│                     WhatsApp Guardian                         │
├───────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌──────────┐  ┌─────────────┐  ┌────────────┐  │
│  │ Baileys │─▶│ Sanitizer│─▶│ Classifier  │─▶│  Handler   │  │
│  │ Client  │  │          │  │   (GPT)     │  │            │  │
│  └─────────┘  └──────────┘  └─────────────┘  └─────┬──────┘  │
│                                                     │         │
│        ┌────────────────────────────────────────────┼─────┐   │
│        │                                            ▼     │   │
│        │  ┌──────────┐                      ┌───────────┐ │   │
│        │  │  Inbox   │◀─────Escalate────────│   GPT     │ │   │
│        │  │  Writer  │                      │ Response  │ │   │
│        │  └──────────┘                      └───────────┘ │   │
│        │        │                                 │       │   │
│        │        ▼                                 ▼       │   │
│        │  ┌──────────┐                      ┌───────────┐ │   │
│        │  │ Webhook  │                      │  Direct   │ │   │
│        │  │ Notify   │                      │  Reply    │ │   │
│        │  └──────────┘                      └───────────┘ │   │
│        │                                                  │   │
│        │  ┌──────────────────────────────────────────┐    │   │
│        │  │           Conversation Memory            │    │   │
│        │  │              (SQLite)                    │    │   │
│        │  └──────────────────────────────────────────┘    │   │
│        └──────────────────────────────────────────────────┘   │
│                                                               │
│  ┌────────────┐              ┌────────────────────────────┐   │
│  │  Outbox    │──────────────│      Your AI Agent         │   │
│  │  Watcher   │◀─────────────│   (reads inbox, writes     │   │
│  └────────────┘              │    outbox)                 │   │
│        │                     └────────────────────────────┘   │
│        ▼                                                      │
│  ┌────────────┐                                               │
│  │  Message   │                                               │
│  │ Processor  │───────────────▶ WhatsApp                      │
│  └────────────┘                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## 🔒 Security

See [docs/SECURITY.md](docs/SECURITY.md) for security considerations.

Key security features:
- Prompt injection detection
- Input length limits
- PII redaction in logs
- Sender blocklist
- No credentials in logs

---

## 🤝 Contributing

We're actively looking for contributors! See [CONTRIBUTING.md](CONTRIBUTING.md).

**Ways to contribute:**
- 🐛 Bug reports
- ✨ Feature requests
- 📖 Documentation improvements
- 🌐 Translations
- 💻 Code contributions

---

## 📜 License

MIT License - see [LICENSE](LICENSE)

---

## 🙏 Acknowledgments

- [Baileys](https://github.com/WhiskeySockets/Baileys) - WhatsApp Web API
- [OpenAI](https://openai.com) - GPT models
- [OpenClaw](https://github.com/openclaw) - AI agent framework

---

## ⭐ Star History

If you find this project useful, please give it a star! ⭐

---

**Built with ❤️ for the AI agent community**
