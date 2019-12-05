import Web3 from 'web3';

export const development = {
  port: process.env.PORT || 8080,
  //Test key, dont use in production
  rootKey: 'xpub6FnCn6nSzZAw5Tw7cgR9bi15UV96gLZhjDstkXXxvCLsUXBGXPdSnLFbdpq8p9H'
         + 'mGsApME5hQTZ3emM2rnY5agb9rXpVGyy3bdW6EEgAtqt',
  bitsharesSignKey: process.env.BITSHARES_SIGN_KEY,
  web3Provider: process.env.WEB3_PROVIDER || Web3.givenProvider ||
                'wss://main-rpc.linkpool.io/ws',
  ethereumUSDTAddress: process.env.ETHEREUM_USDT_ADDRESS ||
                       '0xdac17f958d2ee523a2206206994597c13d831ec7',
  bitsharesProvider: process.env.BITSHARES_PROVIDER ||
                     'wss://eu.nodes.bitshares.ws'
};
