import { PrivateKey, ChainStore, FetchChain,
         TransactionBuilder } from 'bitsharesjs';
import { Apis } from 'bitsharesjs-ws';

import { appConfig } from './app';

const wif = PrivateKey.fromWif(appConfig.bitsharesSignKey);
const bitshares = Apis.instance(appConfig.bitsharesProvider, true)
  .init_promise.then(rs => { return ChainStore.init(); });

export { ChainStore, FetchChain, TransactionBuilder, bitshares };
