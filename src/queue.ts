import { Queue } from 'bullmq';
import IORedis from 'ioredis';

import { appConfig } from './app';
// import { onStart, onSignal } from './app';

const connection = new IORedis(
  appConfig.memoryDBPort,
  appConfig.memoryDBHost,
  {
    username: appConfig.memoryDBUsername,
    password: appConfig.memoryDBPassword
  }
);

export default new Queue('PaymentGateway', { connection });

/*
onStart.push(
  (async () => {
    await queue.resume();
  })()
);
onSignal.push(
  (async () => {
    await queue.pause();
  })()
);
*/
