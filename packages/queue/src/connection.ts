import IORedis, { type Redis } from "ioredis";

let sharedConnection: Redis | undefined;

/**
 * BullMQ requires maxRetriesPerRequest: null on the connection it drives,
 * otherwise blocking commands (used by Workers/QueueEvents) throw.
 */
export function getRedisConnection(redisUrl: string): Redis {
  if (!sharedConnection) {
    sharedConnection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  }
  return sharedConnection;
}
