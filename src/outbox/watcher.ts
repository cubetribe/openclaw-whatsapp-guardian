import chokidar from "chokidar";
import path from "path";
import logger from "../utils/logger";
import type { Config } from "../config/schema";
import { MessageProcessor } from "./processor";

export class OutboxWatcher {
  private watcher?: chokidar.FSWatcher;
  private messageProcessor: MessageProcessor;
  private config: Config;

  constructor(messageProcessor: MessageProcessor, config: Config) {
    this.messageProcessor = messageProcessor;
    this.config = config;
  }

  start(): void {
    this.watcher = chokidar.watch(this.config.paths.outbox, {
      ignored: [
        /^\./,
        "**/sent/**",
        "**/failed/**",
      ],
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100,
      },
    });

    this.watcher
      .on("add", async (filePath) => {
        if (!this.shouldProcessFile(filePath)) {
          return;
        }

        logger.info({ filePath }, "New outbox file detected");

        try {
          await this.messageProcessor.processMessage(filePath);
        } catch (error) {
          logger.error({ error, filePath }, "Error processing outbox message");
        }
      })
      .on("error", (error) => {
        logger.error({ error }, "Outbox watcher error");
      });

    logger.info({ outboxDir: this.config.paths.outbox }, "Outbox watcher started");
  }

  private shouldProcessFile(filePath: string): boolean {
    if (filePath.includes("/sent/") || filePath.includes("/failed/")) {
      logger.debug({ filePath }, "Ignoring file in sent/failed directory");
      return false;
    }
    
    if (path.extname(filePath) !== ".md") {
      logger.debug({ filePath }, "Ignoring non-markdown file");
      return false;
    }
    
    return true;
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      logger.info("Outbox watcher stopped");
    }
  }
}
