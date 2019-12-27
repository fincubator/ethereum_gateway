import { Worker } from 'bullmq';

import { jobs } from './jobs';

export const worker = new Worker('PaymentGateway', async job => {
  await jobs[job.name](job);
}).on('failed', (job, error) => {
  console.error(`Job ${job.id} failed with:`, error);
});
