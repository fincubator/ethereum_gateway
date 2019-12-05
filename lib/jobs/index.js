import Queue from 'bull';

import { importModules } from '../utils';

const queue = new Queue('payment gateway');

queue.on('failed', (job, error) => {
  console.error(`Job ${job.id} failed with:`, error);
});

importModules(__dirname, __filename, module => module.default(queue));

export { queue };
