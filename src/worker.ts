import { Job, Worker } from 'bullmq';
import IORedis from 'ioredis';

import { jobs } from './jobs';

const connection = new IORedis(6379, 'memory_db');

export const worker = new Worker(
  'PaymentGateway',
  async (job: Job) => {
    await jobs[job.name](job);
  },
  { connection }
).on('failed', (job: Job, error) => {
  console.error(`Job ${job.id} failed with:`, error);
});
