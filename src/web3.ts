import { Job } from 'bullmq';
import { Op as SequelizeOp } from 'sequelize';
import Web3 from 'web3';
import { Transaction, TransactionReceipt } from 'web3-core';
import { Contract, EventData } from 'web3-eth-contract';
import { AbiType, StateMutabilityType } from 'web3-utils';
import { Decimal } from 'decimal.js';

import { appConfig } from './app';
import {
  sequelize, StatusInitial, Transactions as TransactionsModel,
  TransactionsStatus as TransactionsModelStatus,
  TransactionsCommitPrefix as TransactionsModelCommitPrefix
} from './models';
import { TaskState, toCamelCase, range, resolveAny } from './utils';

class UnknownTicker extends Error {};

class UnknownTickerFrom extends UnknownTicker {};

class UnknownTickerTo extends UnknownTicker {};

class TransferEventDeclDoesntExist extends Error {};

const erc20 = [{
  constant: true,
  inputs: [],
  name: 'name',
  outputs: [{
    name: 'name',
    type: 'string'
  }],
  payable: false,
  stateMutability: 'view' as StateMutabilityType,
  type: 'function' as AbiType
}, {
  constant: true,
  inputs: [],
  name: 'symbol',
  outputs: [{
    name: 'symbol',
    type: 'string'
  }],
  payable: false,
  stateMutability: 'view' as StateMutabilityType,
  type: 'function' as AbiType
}, {
  constant: true,
  inputs: [],
  name: 'decimals',
  outputs: [{
    name: 'decimals',
    type: 'uint256'
  }],
  payable: false,
  stateMutability: 'view' as StateMutabilityType,
  type: 'function' as AbiType
}, {
  constant: true,
  inputs: [],
  name: 'totalSupply',
  outputs: [{
    name: 'totalSupply',
    type: 'uint256'
  }],
  payable: false,
  stateMutability: 'view' as StateMutabilityType,
  type: 'function' as AbiType
}, {
  constant: true,
  inputs: [{
    name: 'owner',
    type: 'address'
  }],
  name: 'balanceOf',
  outputs: [{
    name: 'balance',
    type: 'uint256'
  }],
  payable: false,
  stateMutability: 'view' as StateMutabilityType,
  type: 'function' as AbiType
}, {
  constant: false,
  inputs: [{
    name: 'to',
    type: 'address'
  }, {
    name: 'amount',
    type: 'uint256'
  }],
  name: 'transfer',
  outputs: [],
  payable: false,
  stateMutability: 'nonpayable' as StateMutabilityType,
  type: 'function' as AbiType
}, {
  constant: false,
  inputs: [{
    name: 'from',
    type: 'address'
  }, {
    name: 'to',
    type: 'address'
  }, {
    name: 'amount',
    type: 'uint256'
  }],
  name: 'transferFrom',
  outputs: [],
  payable: false,
  stateMutability: 'nonpayable' as StateMutabilityType,
  type: 'function' as AbiType
}, {
  constant: false,
  inputs: [{
    name: 'spender',
    type: 'address'
  }, {
    name: 'amount',
    type: 'uint256'
  }],
  name: 'approve',
  outputs: [],
  payable: false,
  stateMutability: 'nonpayable' as StateMutabilityType,
  type: 'function' as AbiType
}, {
  constant: true,
  inputs: [{
    name: 'owner',
    type: 'address'
  }, {
    name: 'spender',
    type: 'address'
  }],
  name: 'allowance',
  outputs: [{
    name: 'remaining',
    type: 'uint256'
  }],
  payable: false,
  stateMutability: 'view' as StateMutabilityType,
  type: 'function' as AbiType
}, {
  'anonymous': false,
  inputs: [{
    'indexed': true,
    name: 'from',
    type: 'address'
  }, {
    'indexed': true,
    name: 'to',
    type: 'address'
  }, {
    'indexed': false,
    name: 'amount',
    type: 'uint256'
  }],
  name: 'Transfer',
  type: 'event' as AbiType
}, {
  'anonymous': false,
  inputs: [{
    'indexed': true,
    name: 'owner',
    type: 'address'
  }, {
    'indexed': true,
    name: 'spender',
    type: 'address'
  }, {
    'indexed': false,
    name: 'value',
    type: 'uint256'
  }],
  name: 'Approval',
  type: 'event' as AbiType
}];
const web3 = new Web3(appConfig.web3Provider);
const contracts = {
  //https://api.etherscan.io/api?module=contract&action=getsourcecode&address=
  USDT: new web3.eth.Contract(erc20, appConfig.ethereumUSDTAddress)
};

export async function txTransferTo(
  job: Job, tr: TransactionsModel, previousStatus: StatusInitial,
  commitPrefix: TransactionsModelCommitPrefix
): Promise {
  let txPrefix = toCamelCase(commitPrefix);

  txPrefix = 'tx' + (txPrefix.charAt(0).toUpperCase() ?? '')
           + txPrefix.substring(1);

  const txCreatedAtPrefix = txPrefix + 'CreatedAt';
  const okStatus = `${commitPrefix}_commit_ok` as TransactionsModelStatus;
  const errStatus = `${commitPrefix}_commit_err` as TransactionsModelStatus;
  let tx;

  if(tr.status === previousStatus || tr.status === errStatus) {
    if(tr.tickerFrom !== 'FINTEH.USDT') {
      throw new UnknownTickerFrom();
    }

    if(tr.tickerTo !== 'USDT') {
      throw new UnknownTickerTo();
    }

    const contract = contracts[tr.tickerTo];
    const assetDecimals = new Decimal(await contract.methods.decimals().call());
    const amountTo = Decimal
      .mul(tr.amountFrom!, Decimal.pow(10, assetDecimals)).toString();
    const callData = contract.methods.transfer(tr.derivedWallet!.invoice,
                                               amountTo);
    tx = await web3.eth.accounts.signTransaction({
      to: contract._address, gas: (await callData.estimateGas()) * 4,
      data: callData.encodeABI()
    }, appConfig.ethereumSignKey);

    await sequelize.transaction(async transaction => {
      const txCommited = tr[txPrefix] ?? {};

      if(tx[txCreatedAtPrefix] === null) {
        tx[txCreatedAtPrefix] = new Date();
      }

      if(typeof txCommited.tx === 'undefined' || txCommited.tx === null) {
        txCommited.tx = tx;
        txCommited.txId = tx.transactionHash;
        txCommited.txIndex = 0;
        tr[txPrefix] = txCommited;

        if(amountTo !== null) {
          tr.amountTo = amountTo.toString();
        }
      }

      tr.status = okStatus;

      await tr.save({ transaction });
    });
  } else {
    tx = tr[txPrefix].tx;
  }

  return tx;
}

export async function processTx(
  job: Job, tr: TransactionsModel, tx: Transaction,
  previousStatus: StatusInitial, commitPrefix: TransactionsModelCommitPrefix
): Promise<boolean> {
  let txPrefix = toCamelCase(commitPrefix);

  txPrefix = 'tx' + (txPrefix.charAt(0).toUpperCase() ?? '')
           + txPrefix.substring(1);

  const txCreatedAtPrefix = txPrefix + 'CreatedAt';
  const pendingStatus = `${commitPrefix}_pending` as TransactionsModelStatus;
  const okStatus = `${commitPrefix}_ok` as TransactionsModelStatus;
  const errStatus = `${commitPrefix}_err` as TransactionsModelStatus;
  const contract = commitPrefix === 'receive' ? contracts[tr.tickerFrom]
                                              : contracts[tr.tickerTo];
  const txHash = tx.hash ?? tx.transactionHash;
  const txRaw = tx.raw ?? tx.rawTransaction;
  let transferDecl = null;

  for(const decl of contract._jsonInterface) {
    if(decl.name === 'Transfer' && decl.anonymous === false) {
      transferDecl = decl;

      break;
    }
  }

  if(transferDecl === null) {
    throw new TransferEventDeclDoesntExist();
  }

  do {
    let currentBlock: number;
    let txStatus: TransactionReceipt | null = null;
    let transferEvent = null;
    let tryFetchNumber = 0;

    do {
      currentBlock = await web3.eth.getBlockNumber();

      try {
        txStatus = await web3.eth.getTransactionReceipt(txHash);
      } catch {
        await web3.eth.sendSignedTransaction(txRaw);

        continue;
      }

      let multipleTransferEvent = false;

      if(txStatus !== null && txStatus.status === true) {
        for(const log of txStatus.logs) {
          if(transferEvent !== null) {
            multipleTransferEvent = true;
          }

          if(log.topics.length > 0 &&
             log.topics[0] === transferDecl!.signature) {
            transferEvent = web3.eth.abi.decodeLog(transferDecl!.inputs,
                                                   log.data,
                                                   log.topics.slice(1));
          }
        }
      }

      if(txStatus === null || txStatus.status === false ||
         transferEvent === null || multipleTransferEvent === true ||
         transferEvent.to !== tr.derivedWallet!.invoice) {
        if(++tryFetchNumber >= appConfig.ethereumBlockTryCheckNumber) {
          console.error(`Job ${job.id} skipped transaction ${txHash}: ` +
                        `unknown, pending, reverted, Transfer event doesn't ` +
                        `exist, multiple Transfer event, recipient's address ` +
                        `doesn't match`);

          return false;
        }

        if(await web3.eth.getTransaction(txHash) === null) {
          await web3.eth.sendSignedTransaction(txRaw);
        } else {
          await new Promise((resolve, reject) => {
            setTimeout(() => resolve(), appConfig.ethereumBlockCheckTime);
          });
        }
      }
    } while(txStatus === null);

    let txInit = false;
    const assetDecimals = new Decimal(await contract.methods.decimals().call());
    const amountFrom = new Decimal(transferEvent!.amount)
      .div(Decimal.pow(10, assetDecimals)).toString();
    const confirmations = currentBlock - txStatus.blockNumber + 1;
    const status = confirmations >= appConfig.ethereumRequiredConfirmations
                 ? okStatus : pendingStatus;
    const result = await sequelize.transaction(async transaction => {
      const txCommited = tr[txPrefix] ?? {};

      if(tr.status === previousStatus || tr.status === errStatus) {
        const existing_tx = await TransactionsModel.findOne({
          attributes: ['id'], where: { id: { [SequelizeOp.ne]: tr.id },
            [txPrefix]: { tx: { hash: txHash } }
          }, transaction
        });

        if(existing_tx !== null) {
          return false;
        }

        if(tr[txCreatedAtPrefix] === null) {
          tr[txCreatedAtPrefix] = new Date();
        }

        if(typeof txCommited.tx === 'undefined' || txCommited.tx == null) {
          txCommited.tx = tx;
          txCommited.txId = txHash;
          txCommited.txIndex = 0;
          txInit = true;
        }
      }

      let txStatusChanged = false;

      if(tr.status === previousStatus || tr.status === pendingStatus ||
         tr.status === errStatus &&
         (confirmations < appConfig.ethereumRequiredConfirmations ||
          typeof txCommited.txStatus === 'undefined' &&
          txCommited.txStatus === null)) {
        txCommited.txStatus = txStatus;
        txStatusChanged = true;
      }

      if(txInit === true || txStatusChanged === true ||
         txCommited.confirmations !== confirmations) {
        txCommited.confirmations = confirmations;
        tr[txPrefix] = txCommited;
      }

      if(tr.status === previousStatus || tr.status === pendingStatus ||
         tr.status === errStatus) {
        if(commitPrefix === 'receive' && tr.amountFrom !== amountFrom) {
          tr.amountFrom = amountFrom;
        }

        tr.status = status;
      }

      await tr.save({ transaction });

      return true;
    });

    if(result === false) {
      return false;
    }

    if(tr.status !== okStatus) {
      await new Promise((resolve, reject) => {
        setTimeout(() => resolve(), appConfig.ethereumBlockCheckTime);
      });
    }
  } while(tr.status !== okStatus);

  return true;
};

async function fetchAndProcessTx(
  job: Job, tr: TransactionsModel, event: EventData,
  previousStatus: StatusInitial, commitPrefix: TransactionsModelCommitPrefix
): Promise<boolean> {
  let tx;
  let tryFetchNumber = 0;

  do {
    tx = await web3.eth.getTransaction(event.transactionHash);

    if(tx === null) {
      if(++tryFetchNumber >= appConfig.ethereumBlockTryCheckNumber) {
        console.error(`Job ${job.id} skipped event ${event.transactionHash}: ` +
                      `unknown or pending`);

        return false;
      }

      await new Promise((resolve, reject) => {
        setTimeout(() => resolve(), appConfig.ethereumBlockCheckTime);
      });
    }
  } while(tx === null);

  return await processTx(job, tr, tx, previousStatus, commitPrefix);
};

async function fetchAllHistoricalBlock(
  job: Job, tr: TransactionsModel, previousStatus: StatusInitial,
  commitPrefix: TransactionsModelCommitPrefix, resolveState: TaskState
): Promise<boolean> {
  const contract = contracts[tr.tickerFrom];
  const currentBlock = await web3.eth.getBlockNumber();
  let last_error = null;

  for(const rightBlock of range(currentBlock, 0, -appConfig.web3BatchSize)) {
    if(resolveState.resolved === true) {
      return false;
    }

    let leftBlock = rightBlock - appConfig.web3BatchSize + 1;

    leftBlock = leftBlock > 0 ? leftBlock : 0;

    let events = null;

    try {
      events = await contract.getPastEvents('Transfer', { filter: {
        to: tr.derivedWallet!.invoice
      }, fromBlock: leftBlock, toBlock: rightBlock });
    } catch(error) {
      console.error(
        `Job ${job.id} skipped blocks from ${leftBlock} to ${rightBlock}`, error
      );
      last_error = error;
    }

    if(events !== null) {
      for(const event of events) {
        const result = await fetchAndProcessTx(job, tr, event, previousStatus,
                                               commitPrefix);

        if(result === true) {
          return true;
        }
      }
    }
  }

  if(last_error !== null) {
    throw last_error;
  }

  return false;
};

async function fetchAllNewBlock(job: Job, tr: TransactionsModel,
                                previousStatus: StatusInitial,
                                commitPrefix: TransactionsModelCommitPrefix,
                                resolveState: TaskState): Promise<boolean> {
  return await new Promise((resolve, reject) => {
    const contract = contracts[tr.tickerFrom];

    contract.once('Transfer', { filter: {
      to: tr.derivedWallet!.invoice
    } }, (error, event) => {
      if(resolveState.resolved === true) {
        resolve(false);
      }

      if(error !== null) {
        reject(error);
      }

      fetchAndProcessTx(job, tr, event, previousStatus, commitPrefix).then(
        result => resolve(result), error => reject(error)
      );
    });
  });
};

export async function fetchBlockUntilTxFound(
  job: Job, tr: TransactionsModel, previousStatus: StatusInitial,
  commitPrefix: TransactionsModelCommitPrefix
): Promise<boolean> {
  if(tr.tickerFrom !== 'USDT') {
    throw new UnknownTickerFrom();
  }

  return await resolveAny(job, [
    { task: async state => {
        return await fetchAllHistoricalBlock(job, tr, previousStatus,
                                             commitPrefix, state);
      }, skip: true },
    { task: async state => { return await fetchAllNewBlock(
        job, tr, previousStatus, commitPrefix, state
      ); }, skip: false }
  ]);
};
