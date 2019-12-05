import Web3 from 'web3';

import { appConfig } from '../app';
import { importModules } from '../utils';

const contracts = {};
const web3 = new Web3(appConfig.web3Provider);

importModules(__dirname, __filename, module => {
  let contract = module.default(web3);

  contracts[contract.name] = contract.handler;
});

export { web3 };

export default contracts;
