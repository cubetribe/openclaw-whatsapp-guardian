import logger from '../utils/logger';
import type { ConversationStore } from './store';

export function scheduleCleanup(store: ConversationStore, retentionDays: number = 30): NodeJS.Timeout {
  const cleanupJob = () => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    logger.info({ retentionDays, cutoffDate }, 'Running conversation cleanup job');

    try {
      const deletedCount = store.deleteInactiveConversations(cutoffDate);
      logger.info({ deletedCount }, 'Cleanup job completed');
    } catch (error) {
      logger.error({ error }, 'Cleanup job failed');
    }
  };

  const DAILY_MS = 24 * 60 * 60 * 1000;
  const interval = setInterval(cleanupJob, DAILY_MS);

  cleanupJob();

  logger.info({ retentionDays, intervalMs: DAILY_MS }, 'Cleanup job scheduled');

  return interval;
}
