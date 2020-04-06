import 'source-map-support/register';

import './queue';
import './web3';
import './bitshares';
import './worker';
import './views';

import * as http from 'http';

import { createTerminus } from '@godaddy/terminus';

import { app, appConfig, onSignal, onStart } from './app';

const server = http.createServer(app);

createTerminus(server, {
  signal: 'SIGINT',
  onSignal: async () => {
    await Promise.all(onSignal);
  },
});

onStart.push(
  (async (): Promise<void> => {
    server.listen(appConfig.port);
  })()
);

Promise.all(onStart).then(
  () => {},
  () => {}
);
