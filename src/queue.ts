import { Queue } from 'bullmq';

import { onStart, onSignal } from './app';

export const queue = new Queue('PaymentGateway');

//onStart.push((async () => await queue.resume())());
//onSignal.push((async () => await queue.pause())());
