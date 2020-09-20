import os from 'os';

import type { Job } from 'bullmq';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';

import { appConfig } from './app';
import { jobs } from './jobs';
import { inspect } from './utils';

const connection = new IORedis(appConfig.memoryDBPort, appConfig.memoryDBHost);

export default new Worker(
  'PaymentGateway',
  async (job: Job) => {
    await jobs[job.name](job);
  },
  { connection }
).on('failed', (job: Job, error) => {
  console.error(
    `Job ${inspect(job.id)} failed with:${os.EOL}${inspect(error)}`
  );
});