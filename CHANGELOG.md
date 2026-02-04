# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-02-04

### Added

- 🎉 **Initial Open Source Release**

#### Core Features
- WhatsApp connection via Baileys library
- AI-powered message classification using OpenAI GPT
- Intelligent routing: self-handle vs escalate decisions
- File-based Inbox/Outbox communication system

#### Conversation Memory
- SQLite-based conversation storage with WAL mode
- Automatic token-aware history trimming
- Configurable retention period (default: 30 days)
- Daily cleanup job for inactive conversations

#### Security
- Prompt injection pattern detection
- Input sanitization and length limits
- PII redaction in logs
- Phone number blocklist support

#### Web Interface
- QR code login page with real-time updates
- WebSocket-based status notifications
- Pairing code authentication support

#### Webhook Integration
- Optional HTTP notifications on escalation
- Configurable retry with exponential backoff
- Customizable timeout settings

#### Developer Experience
- Full TypeScript support
- Comprehensive type definitions
- Structured logging with pino
- Development mode with nodemon

### Configuration

- `.env.example` with all available options
- Customizable system prompts via markdown files
- Business info and FAQ templates
- Flexible classification rules

---

## [Unreleased]

### Planned

- [ ] Multi-language support
- [ ] Redis-based session storage option
- [ ] Message queue integration (RabbitMQ/Redis)
- [ ] Admin dashboard
- [ ] Analytics and metrics
- [ ] Rate limiting
- [ ] Custom classifier models

---

## How to Update This File

When making changes, add your modifications under the `[Unreleased]` section in one of these categories:

- **Added** - New features
- **Changed** - Changes in existing functionality
- **Deprecated** - Soon-to-be removed features
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Security fixes

When releasing a new version:
1. Change `[Unreleased]` to `[X.Y.Z] - YYYY-MM-DD`
2. Create a new `[Unreleased]` section at the top
3. Update version in `package.json`
4. Create a git tag: `git tag v1.0.0`
