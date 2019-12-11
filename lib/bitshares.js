import { PrivateKey, ChainStore, FetchChain,
         TransactionBuilder } from 'bitsharesjs';
import { Apis } from 'bitsharesjs-ws';

import { appConfig } from './app';

const wif = PrivateKey.fromWif(appConfig.bitsharesSignKey);
const wifPublicKey = wif.toPublicKey().toPublicKeyString();

Apis.setAutoReconnect(true);

let bitshares;

const bitsharesReconnect = async () => {
  while(true) {
    try {
      await new Promise((resolve, reject) => {
        bitshares = Apis.instance(appConfig.bitsharesProvider, true,
                                  appConfig.bitsharesConnectionTimeout,
                                  undefined, () => resolve())
          .init_promise.then(() => { return ChainStore.init(); })
          .catch(error => reject(error));
      });
    } catch(error) {
      console.error(error);
    }
  }
};

bitsharesReconnect();

export { Apis, ChainStore, FetchChain, TransactionBuilder, wif, wifPublicKey,
         bitshares };
