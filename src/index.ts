import { mkdir } from "fs/promises";
import { writeFileSync, existsSync, readFileSync, unlinkSync } from "fs";
import logger from "./utils/logger";
import { loadConfig } from "./config/index";
import { Config } from "./config/schema";
import { WhatsAppSession } from "./whatsapp/session";
import { WhatsAppClient } from "./whatsapp/client";
import { WhatsAppHandlers } from "./whatsapp/handlers";
import { InputSanitizer } from "./sanitizer/input";
import { OpenAIClient } from "./ai/client";
import { PromptBuilder } from "./ai/prompt";
import { MessageClassifier } from "./ai/classifier";
import { InboxWriter } from "./inbox/writer";
import { MessageProcessor } from "./outbox/processor";
import { OutboxWatcher } from "./outbox/watcher";
import { ConversationStore, scheduleCleanup, trimToTokenLimit } from "./memory";
import type { MessageContext } from "./types";

const PID_FILE = "./data/guardian.pid";

const args = process.argv.slice(2);
const webMode = args.includes("--mode=web") || args.includes("--web");

if (webMode) {
  import("./web/index").then(({ startWebMode }) => {
    startWebMode().catch((error) => {
      logger.error({ error }, "Web mode failed to start");
      process.exit(1);
    });
  });
} else {
  main();
}

function checkAndWritePid(): void {
  if (existsSync(PID_FILE)) {
    const oldPid = readFileSync(PID_FILE, "utf-8").trim();
    try {
      process.kill(parseInt(oldPid), 0);
      logger.error({ oldPid }, "Another instance is already running");
      process.exit(1);
    } catch {
      logger.info({ oldPid }, "Removing stale PID file");
      unlinkSync(PID_FILE);
    }
  }
  writeFileSync(PID_FILE, process.pid.toString());
  logger.info({ pid: process.pid }, "PID file created");
}

async function main(): Promise<void> {
  try {
    logger.info("Starting WhatsApp Guardian...");

    checkAndWritePid();

    const config = loadConfig();
    logger.info({ config: { model: config.openai.model, logLevel: config.logging.level } }, "Configuration loaded");

    await ensureDirectories(config);

    const session = new WhatsAppSession(config);
    await session.initialize();

    const whatsappClient = new WhatsAppClient(session, config);
    
    logger.info("Connecting to WhatsApp...");
    const socket = await whatsappClient.connect();

    await new Promise<void>((resolve) => {
      if (socket.user) {
        logger.info("WhatsApp already connected");
        resolve();
      } else {
        logger.info("Waiting for WhatsApp connection...");
        socket.ev.on("connection.update", (update) => {
          if (update.connection === "open") {
            logger.info("WhatsApp connection established");
            resolve();
          }
        });
      }
    });

    logger.info("WhatsApp fully connected, initializing message handlers...");

    logger.info("Initializing conversation memory store...");
    const memoryStore = new ConversationStore('./data/guardian.db');
    scheduleCleanup(memoryStore, config.memory.retentionDays);

    const sanitizer = new InputSanitizer(config);
    const aiClient = new OpenAIClient(config);
    const promptBuilder = new PromptBuilder(config);
    await promptBuilder.initialize();

    const classifier = new MessageClassifier(aiClient, promptBuilder);
    const inboxWriter = new InboxWriter(config);

    const handlers = new WhatsAppHandlers(socket);
    handlers.setMessageHandler(async (context: MessageContext) => {
      await handleIncomingMessage(
        context,
        sanitizer,
        classifier,
        aiClient,
        promptBuilder,
        inboxWriter,
        whatsappClient,
        memoryStore,
        config
      );
    });
    await handlers.setupHandlers();

    logger.info("Starting outbox watcher...");
    const messageProcessor = new MessageProcessor(whatsappClient, config, memoryStore);
    const outboxWatcher = new OutboxWatcher(messageProcessor, config);
    outboxWatcher.start();

    logger.info("WhatsApp Guardian started successfully");

    setupGracefulShutdown(whatsappClient, outboxWatcher, memoryStore);
  } catch (error) {
    logger.error({ error }, "Startup failed");
    if (existsSync(PID_FILE)) {
      unlinkSync(PID_FILE);
    }
    process.exit(1);
  }
}

async function handleIncomingMessage(
  context: MessageContext,
  sanitizer: InputSanitizer,
  classifier: MessageClassifier,
  aiClient: OpenAIClient,
  promptBuilder: PromptBuilder,
  inboxWriter: InboxWriter,
  whatsappClient: WhatsAppClient,
  memoryStore: ConversationStore,
  config: Config
): Promise<void> {
  try {
    const conversation = memoryStore.getOrCreateConversation(context.phoneNumber);

    const sanitizationResult = sanitizer.sanitize(context.message);

    if (sanitizationResult.blocked) {
      logger.warn({ phoneNumber: context.phoneNumber }, "Message blocked due to security concerns");
      await whatsappClient.sendMessage(
        context.phoneNumber,
        "Your message could not be processed. Please contact us directly."
      );
      return;
    }

    if (sanitizationResult.warnings.length > 0) {
      logger.info({ warnings: sanitizationResult.warnings }, "Sanitization warnings");
    }

    memoryStore.addMessage(conversation.id, 'user', sanitizationResult.sanitized, 'guardian');

    const classification = await classifier.classify(sanitizationResult.sanitized);

    if (classification.requiresEscalation) {
      logger.info({ intent: classification.intent }, "Message requires escalation");

      const history = memoryStore.getHistory(conversation.id, config.memory.maxMessages);
      const trimmedHistory = trimToTokenLimit(history, config.memory.maxTokens);

      const filename = await inboxWriter.writeEscalation(
        context,
        classification.intent,
        classification.reasoning || "",
        classification.confidence,
        conversation.id,
        'escalated',
        trimmedHistory
      );

      memoryStore.markEscalated(conversation.id, classification.intent, filename);

      const acknowledgment = getAcknowledgmentMessage(classification.intent);
      await whatsappClient.sendMessage(context.phoneNumber, acknowledgment);

      memoryStore.addMessage(conversation.id, 'assistant', acknowledgment, 'guardian');
    } else {
      logger.info({ intent: classification.intent }, "Generating direct response");

      const history = memoryStore.getHistory(conversation.id, config.memory.maxMessages);
      const trimmedHistory = trimToTokenLimit(history, config.memory.maxTokens);

      const systemPrompt = promptBuilder.buildSystemPrompt();
      const response = await aiClient.generateResponseWithHistory(
        systemPrompt,
        trimmedHistory,
        sanitizationResult.sanitized
      );

      await whatsappClient.sendMessage(context.phoneNumber, response);

      memoryStore.addMessage(conversation.id, 'assistant', response, 'guardian');
    }
  } catch (error) {
    logger.error({ error, context }, "Error handling incoming message");

    await whatsappClient.sendMessage(
      context.phoneNumber,
      "Sorry, there was a technical error. Please try again later."
    );
  }
}

function getAcknowledgmentMessage(intent: string): string {
  switch (intent) {
    case "APPOINTMENT":
      return "Thank you for your appointment request. I'm forwarding this and you'll receive a response with available times shortly.";
    case "CALLBACK_REQUEST":
      return "Thank you for your message. We will get back to you soon.";
    case "COMPLAINT":
      return "Thank you for bringing this to our attention. Your complaint will be handled promptly.";
    default:
      return "Thank you for your message. I'm forwarding this to a colleague who will get back to you soon.";
  }
}

async function ensureDirectories(config: Config): Promise<void> {
  await mkdir(config.paths.inbox, { recursive: true });
  await mkdir(config.paths.outbox, { recursive: true });
  await mkdir(config.whatsapp.authDir, { recursive: true });
  await mkdir("./data", { recursive: true });
  logger.info("Data directories initialized");
}

function setupGracefulShutdown(
  whatsappClient: WhatsAppClient,
  outboxWatcher: OutboxWatcher,
  memoryStore: ConversationStore
): void {
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutdown signal received");
    await outboxWatcher.stop();
    await whatsappClient.disconnect();
    memoryStore.close();
    if (existsSync(PID_FILE)) {
      unlinkSync(PID_FILE);
      logger.info("PID file removed");
    }
    logger.info("Shutdown complete");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("exit", () => {
    if (existsSync(PID_FILE)) {
      unlinkSync(PID_FILE);
    }
  });
}
