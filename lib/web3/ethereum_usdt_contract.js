import * as fs from 'fs';
import fetch from 'cross-fetch';

import { appConfig } from '../app';

const address = appConfig.ethereumUSDTAddress;
//const api = 'https://api.etherscan.io/api';
//const source_query = '?module=contract&action=getsourcecode&address';
//const source_api = `${api}${source_query}`;
//const source_link = `${source_api}${address}`;
const source = JSON.parse(fs.readFileSync('ethereum_ustd_source'));
const abi = JSON.parse(source['result'][0]['ABI']);

export default web3 => {
  return { name: 'usdt', handler: new web3.eth.Contract(abi, address) };
};

