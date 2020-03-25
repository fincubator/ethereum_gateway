import IORedis from 'ioredis';
import { Worker } from 'bullmq';

import { jobs } from './jobs';

const connection = new IORedis(6379, 'memory_db');

export const worker = new Worker(
  'PaymentGateway',
  async (job) => {
    await jobs[job.name](job);
  },
  { connection }
).on('failed', (job, error) => {
  console.error(`Job ${job.id} failed with:`, error);
});
