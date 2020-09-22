import 'source-map-support/register';

import './queue';
import './web3';
import './worker';

import * as http from 'http';

import { createTerminus } from '@godaddy/terminus';
import { Server as WebSocketServer } from 'rpc-websockets';

import { app, appConfig, onSignal, onStart } from './app';
import { getDepositAddress, newInTx, validateAddressRequest } from './rpc';

const server = http.createServer(app);
const rpc = new WebSocketServer({ server, path: '/ws-rpc' });

rpc.register('init_new_tx', newInTx, '/ws-rpc');
rpc.register('get_deposit_address', getDepositAddress, '/ws-rpc');
rpc.register('validate_address_request', validateAddressRequest, '/ws-rpc');


createTerminus(server, {
  signal: 'SIGINT',
  onSignal: async () => {
    await Promise.all(onSignal);
  },
});

onStart.push(
  (async (): Promise<void> => {
    server.listen(appConfig.port);

    return Promise.resolve();
  })()
);

Promise.all(onStart).then(
  () => {},
  () => {}
);
