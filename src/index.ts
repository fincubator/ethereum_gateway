import 'source-map-support/register';
import * as http from 'http';
import { createTerminus } from '@godaddy/terminus';

import { appConfig, app, onStart, onSignal } from './app';
import './queue';
import './web3';
import './bitshares';
import './worker';
import './views';

const server = http.createServer(app);

createTerminus(server, {
  signal: 'SIGINT',
  onSignal: async () => {
    await Promise.all(onSignal);
  },
});

onStart.push((async () => server.listen(appConfig.port))());

Promise.all(onStart);
