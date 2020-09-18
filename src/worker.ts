import { Job, Worker } from 'bullmq';
import IORedis from 'ioredis';

import { appConfig } from './app';
import { jobs } from './jobs';

const connection = new IORedis(
  appConfig.memoryDBPort,
  appConfig.memoryDBHost,
  {
    username: appConfig.memoryDBUsername,
    password: appConfig.memoryDBPassword
  }
);

export const worker = new Worker(
  'PaymentGateway',
  async (job: Job) => {
    await jobs[job.name](job);
  },
  { connection }
).on('failed', (job: Job, error) => {
  console.error(`Job ${job.id} failed with:`, error);
});
