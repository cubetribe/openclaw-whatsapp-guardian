# WhatsApp Guardian - Security

This document describes security considerations, implemented protections, and best practices for deploying WhatsApp Guardian.

## Threat Model

### Assets to Protect

1. **WhatsApp Session** - Authentication credentials
2. **Customer Data** - Phone numbers, messages, names
3. **API Keys** - OpenAI, webhooks
4. **Conversation History** - Sensitive business communications

### Threat Actors

1. **Malicious Users** - Prompt injection, spam, abuse
2. **External Attackers** - Network interception, credential theft
3. **Insider Threats** - Unauthorized access to logs/data

## Implemented Protections

### 1. Input Sanitization

**Prompt Injection Detection:**
```typescript
const INJECTION_PATTERNS = [
  /ignore\s+(previous|all|above|system)\s+(instructions?|prompts?)/i,
  /forget\s+(everything|all|previous)/i,
  /you\s+are\s+(now|a)\s+(jailbreak|dan|assistant)/i,
  /new\s+instructions?:/i,
  /system\s+message:/i,
  /\[SYSTEM\]/i,
  /\{OVERRIDE\}/i,
  /<\|im_start\|>/i,
  /<\|system\|>/i,
];
```

**Suspicious Encoding Detection:**
- Base64 strings (100+ characters)
- Hex-encoded data

**Input Limits:**
- Maximum message length (configurable, default 4000 chars)
- Control character stripping

### 2. Sender Blocklist

Block specific phone numbers via environment variable:
```env
BLOCKED_SENDERS=1234567890,9876543210
```

Blocked senders:
- Receive no response
- Are logged (with redacted number)
- Cannot trigger any processing

### 3. PII Redaction in Logs

All logs automatically redact:
- Phone numbers: `+1234567890` → `[PHONE_REDACTED]`
- Email addresses: `user@example.com` → `[EMAIL_REDACTED]`

```typescript
const PHONE_PATTERN = /\+?\d{10,15}/g;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
```

### 4. Credential Security

**Never Logged:**
- OpenAI API keys
- WhatsApp session data
- Webhook URLs with auth tokens

**Stored Separately:**
- Environment variables (`.env`)
- Session files (`data/auth/`)
- Both excluded from git via `.gitignore`

### 5. File System Security

**Data Directories:**
```
data/
├── auth/       # WhatsApp session (SENSITIVE)
├── inbox/      # Escalation files
├── outbox/     # Outgoing messages
└── guardian.db # Conversation database
```

**Recommendations:**
- Set restrictive permissions: `chmod 700 data/`
- Run as non-root user
- Don't expose data directory publicly

### 6. Network Security

**WhatsApp Connection:**
- Uses Baileys' built-in encryption
- Reconnects automatically on disconnect
- Handles logout gracefully

**Webhook:**
- Configurable timeout
- Retry with exponential backoff
- Fails gracefully (non-blocking)

## Security Best Practices

### Deployment

1. **Use Environment Variables**
   ```bash
   # Don't hardcode secrets
   export OPENAI_API_KEY=sk-...
   ```

2. **Restrict File Permissions**
   ```bash
   chmod 600 .env
   chmod 700 data/
   chmod 700 data/auth/
   ```

3. **Run as Non-Root**
   ```bash
   # Create dedicated user
   useradd -r -s /bin/false guardian
   chown -R guardian:guardian /app
   ```

4. **Use Process Manager**
   ```bash
   # systemd, PM2, or similar
   # Ensures restart on crash
   # Limits resource usage
   ```

5. **Enable Firewall**
   ```bash
   # Only expose necessary ports
   ufw allow 3333/tcp  # QR web server (if needed)
   ```

### Configuration

1. **Rotate API Keys Regularly**
   - OpenAI: Every 90 days
   - Webhooks: Use per-deployment tokens

2. **Set Reasonable Limits**
   ```env
   MESSAGE_MAX_LENGTH=4000
   MEMORY_MAX_MESSAGES=15
   MEMORY_MAX_TOKENS=50000
   ```

3. **Use Blocklist Proactively**
   ```env
   # Block known spam numbers
   BLOCKED_SENDERS=...
   ```

4. **Configure Retention**
   ```env
   # Delete old conversations
   MEMORY_RETENTION_DAYS=30
   ```

### Monitoring

1. **Log Analysis**
   - Monitor for injection attempts
   - Track blocked senders
   - Watch for error spikes

2. **Alerting**
   - Set up alerts for:
     - Repeated injection attempts
     - High error rates
     - Memory growth

3. **Audit Trail**
   - Inbox files provide natural audit log
   - Database tracks conversation state

## Known Limitations

### Not Protected Against

1. **Sophisticated Prompt Injection**
   - Advanced jailbreaks may bypass detection
   - Mitigation: Use conservative escalation

2. **DoS via Message Volume**
   - No rate limiting implemented
   - Mitigation: Use blocklist, consider adding rate limits

3. **WhatsApp ToS**
   - Using unofficial API (Baileys)
   - Risk: Account ban
   - Mitigation: Use dedicated number, follow best practices

### Recommendations for High-Security Deployments

1. **Add Rate Limiting**
   - Implement per-sender message limits
   - Consider Redis-based sliding window

2. **Use WAF**
   - If exposing webhook, add web application firewall
   - Filter malicious requests

3. **Enable Encryption at Rest**
   - Encrypt data directory
   - Use encrypted SQLite

4. **Implement Audit Logging**
   - Log all actions to separate audit log
   - Consider immutable storage

5. **Regular Security Reviews**
   - Update dependencies monthly
   - Review injection patterns quarterly

## Incident Response

### If API Key is Compromised

1. Immediately rotate the key
2. Check OpenAI usage logs
3. Review access logs for unauthorized use

### If WhatsApp Session is Compromised

1. Log out all sessions via WhatsApp app
2. Delete `data/auth/` directory
3. Re-authenticate with new QR code
4. Review sent messages for abuse

### If Customer Data is Exposed

1. Identify scope of exposure
2. Notify affected customers
3. Review and strengthen access controls
4. Document incident

## Compliance Considerations

### GDPR

- **Data Minimization**: Only store necessary data
- **Retention**: Automatic deletion after configured period
- **Access**: Provide data export capability
- **Deletion**: Support right to be forgotten

### CCPA

- Similar to GDPR requirements
- Disclose data collection in privacy policy
- Honor opt-out requests

### Industry-Specific

- **Healthcare (HIPAA)**: Additional encryption, audit requirements
- **Finance (PCI-DSS)**: Don't store payment data via WhatsApp
- **Legal**: Verify local messaging regulations

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do NOT** create a public GitHub issue
2. Email security concerns to maintainers privately
3. Allow time for fix before disclosure
4. We appreciate responsible disclosure

---

*Last updated: 2024-02-04*
