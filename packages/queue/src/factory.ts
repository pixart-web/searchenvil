import { Queue, Worker, type Processor, type WorkerOptions } from "bullmq";
import { getRedisConnection } from "./connection";
import { DEFAULT_JOB_OPTIONS, type JobDataByQueue, type QueueName } from "./queues";

export function createTypedQueue<Name extends QueueName>(
  name: Name,
  redisUrl: string,
): Queue<JobDataByQueue[Name]> {
  return new Queue<JobDataByQueue[Name]>(name, {
    connection: getRedisConnection(redisUrl),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });
}

export function createTypedWorker<Name extends QueueName>(
  name: Name,
  redisUrl: string,
  processor: Processor<JobDataByQueue[Name]>,
  options?: Omit<WorkerOptions, "connection">,
): Worker<JobDataByQueue[Name]> {
  return new Worker<JobDataByQueue[Name]>(name, processor, {
    connection: getRedisConnection(redisUrl),
    concurrency: options?.concurrency ?? 5,
    ...options,
  });
}
