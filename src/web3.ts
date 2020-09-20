import type { EventEmitter } from 'events';

import type { Job } from 'bullmq';
import { Decimal } from 'decimal.js';
import type { Transaction } from 'sequelize';
import Web3 from 'web3';
import type { EventLog, PromiEvent, TransactionReceipt } from 'web3-core';
import type { EventData } from 'web3-eth-contract';
import { Contract, ContractOptions } from 'web3-eth-contract';
import type { AbiType, StateMutabilityType } from 'web3-utils';

import { appConfig } from './app';
import type { TxRaw } from './models';
import { Orders, Txs, sequelize } from './models';
import { bookerProvider } from './rpc';
import type { TaskStatus } from './utils';
import { inspect, range, resolveAny } from './utils';

export class OrderNotFound extends Error {}

export class OrderUnknownType extends Error {}

export class TxSignError extends Error {}

export class OrderUnknownInTx extends Error {}

export class OrderUnknownOutTx extends Error {}

export class OrderTxUnknownCoinFrom extends Error {}

export class OrderTxUnknownCoinTo extends Error {}

export class OrderTxUnknownToAddress extends Error {}

export class TransferEventDeclDoesntExist extends Error {}

export interface Tx {
  nonce?: string | number;
  chainId?: string | number;
  from?: string;
  to?: string;
  data?: string;
  value?: string | number;
  gas?: string | number;
  gasPrice?: string | number;
}

export interface TxObject<T> {
  arguments: any[];
  call: (tx?: Tx) => Promise<T>;
  send: (tx?: Tx) => PromiEvent<T>;
  estimateGas: (tx?: Tx) => Promise<number>;
  encodeABI: () => string;
}

export interface EventOptions {
  filter?: Record<string, unknown>;
  fromBlock?: 'latest' | 'pending' | 'genesis' | number;
  topics?: string[];
}

export interface CallbackEvent<T> {
  (error: Error, result: T): void;
}

export interface ContractEventLog<T> extends EventLog {
  returnValues: T;
}

export interface ContractEventOn<E, T> {
  (event: 'connected', listener: (subscriptionId: string) => void): E;
  (
    event: 'data' | 'changed',
    listener: (event: ContractEventLog<T>) => void
  ): this;
  (event: 'error', listener: (error: Error) => void): E;
}

export interface ContractEventEmitter<T> extends EventEmitter {
  on: ContractEventOn<this, T>;
}

export interface ContractEvent<T> {
  (
    options?: EventOptions,
    cb?: CallbackEvent<ContractEventLog<T>>
  ): ContractEventEmitter<T>;
}

export interface TransferEvent {
  from: string;
  to: string;
  amount: string;
  0: string;
  1: string;
  2: string;
}

export interface ApprovalEvent {
  owner: string;
  spender: string;
  value: string;
  0: string;
  1: string;
  2: string;
}

/*
export class ERC20Contract extends Contract {
  public methods: {
    name: () => TxObject<string>;

    symbol: () => TxObject<string>;

    decimals: () => TxObject<string>;

    totalSupply: () => TxObject<string>;

    balanceOf: (owner: string) => TxObject<string>;

    transfer: (to: string, amount: number | string) => TxObject<void>;

    transferFrom: (
      from: string,
      to: string,
      amount: number | string
    ) => TxObject<void>;

    approve: (spender: string, amount: number | string) => TxObject<void>;

    allowance: (owner: string, spender: string) => TxObject<string>;
  };

  public events: {
    Transfer: ContractEvent<TransferEvent>;
    Approval: ContractEvent<ApprovalEvent>;
    allEvents: (
      options?: EventOptions,
      cb?: CallbackEvent<EventLog>
    ) => EventEmitter;
  };

  public constructor(
    jsonInterface: any[],
    address?: string,
    options?: ContractOptions
  );

  public clone(): this;
}
*/

export const erc20Abi = [
  {
    constant: true,
    inputs: [],
    name: 'name',
    outputs: [
      {
        name: 'name',
        type: 'string',
      },
    ],
    payable: false,
    stateMutability: 'view' as StateMutabilityType,
    type: 'function' as AbiType,
  },
  {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [
      {
        name: 'symbol',
        type: 'string',
      },
    ],
    payable: false,
    stateMutability: 'view' as StateMutabilityType,
    type: 'function' as AbiType,
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [
      {
        name: 'decimals',
        type: 'uint256',
      },
    ],
    payable: false,
    stateMutability: 'view' as StateMutabilityType,
    type: 'function' as AbiType,
  },
  {
    constant: true,
    inputs: [],
    name: 'totalSupply',
    outputs: [
      {
        name: 'totalSupply',
        type: 'uint256',
      },
    ],
    payable: false,
    stateMutability: 'view' as StateMutabilityType,
    type: 'function' as AbiType,
  },
  {
    constant: true,
    inputs: [
      {
        name: 'owner',
        type: 'address',
      },
    ],
    name: 'balanceOf',
    outputs: [
      {
        name: 'balance',
        type: 'uint256',
      },
    ],
    payable: false,
    stateMutability: 'view' as StateMutabilityType,
    type: 'function' as AbiType,
  },
  {
    constant: false,
    inputs: [
      {
        name: 'to',
        type: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
      },
    ],
    name: 'transfer',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable' as StateMutabilityType,
    type: 'function' as AbiType,
  },
  {
    constant: false,
    inputs: [
      {
        name: 'from',
        type: 'address',
      },
      {
        name: 'to',
        type: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
      },
    ],
    name: 'transferFrom',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable' as StateMutabilityType,
    type: 'function' as AbiType,
  },
  {
    constant: false,
    inputs: [
      {
        name: 'spender',
        type: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
      },
    ],
    name: 'approve',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable' as StateMutabilityType,
    type: 'function' as AbiType,
  },
  {
    constant: true,
    inputs: [
      {
        name: 'owner',
        type: 'address',
      },
      {
        name: 'spender',
        type: 'address',
      },
    ],
    name: 'allowance',
    outputs: [
      {
        name: 'remaining',
        type: 'uint256',
      },
    ],
    payable: false,
    stateMutability: 'view' as StateMutabilityType,
    type: 'function' as AbiType,
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: 'from',
        type: 'address',
      },
      {
        indexed: true,
        name: 'to',
        type: 'address',
      },
      {
        indexed: false,
        name: 'amount',
        type: 'uint256',
      },
    ],
    name: 'Transfer',
    type: 'event' as AbiType,
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: 'owner',
        type: 'address',
      },
      {
        indexed: true,
        name: 'spender',
        type: 'address',
      },
      {
        indexed: false,
        name: 'value',
        type: 'uint256',
      },
    ],
    name: 'Approval',
    type: 'event' as AbiType,
  },
];

export interface ERC20Contracts {
  [key: string]: any;
}

const web3 = new Web3(appConfig.web3Provider);

export const erc20Contracts: ERC20Contracts = {
  // https://api.etherscan.io/api?module=contract&action=getsourcecode&address=
  USDT: new web3.eth.Contract(erc20Abi, appConfig.ethereumUSDTAddress),
};

type TxType = 'in' | 'out';

export async function txTransferTo(
  _job: Job,
  order: Orders
): Promise<TxRaw | null> {
  if (order.type !== 'WITHDRAWAL') {
    throw new OrderUnknownType();
  }

  if (typeof order.inTx === 'undefined') {
    throw new OrderUnknownInTx();
  }

  if (typeof order.outTx === 'undefined') {
    throw new OrderUnknownOutTx();
  }

  if (
    typeof order.inTx.coin === 'undefined' ||
    order.inTx.coin !== 'FINTEH.USDT'
  ) {
    throw new OrderTxUnknownCoinFrom();
  }

  if (typeof order.outTx.coin === 'undefined' || order.outTx.coin !== 'USDT') {
    throw new OrderTxUnknownCoinTo();
  }

  if (
    typeof order.outTx.toAddress === 'undefined' ||
    order.outTx.toAddress === null
  ) {
    throw new OrderTxUnknownToAddress();
  }

  let tx: TxRaw | null = null;

  if (order.inTx.confirmations >= order.inTx.maxConfirmations) {
    const erc20Contract = erc20Contracts[order.outTx.coin];
    const assetDecimals = new Decimal(
      await erc20Contract.methods.decimals().call()
    );
    const amountTo = Decimal.mul(
      order.inTx.amount,
      Decimal.pow(10, assetDecimals)
    ).toString();
    const callData = erc20Contract.methods.transfer(
      order.outTx.toAddress,
      amountTo
    );
    tx = await web3.eth.accounts.signTransaction(
      {
        to: erc20Contract._address,
        gas: (await callData.estimateGas()) * 4,
        data: callData.encodeABI(),
      },
      appConfig.ethereumSignKey
    );

    await sequelize.transaction(async (transaction: Transaction) => {
      order.outTx.txId = tx!.transactionHash;
      // TODO: fill fromAddress
      order.outTx.amount = amountTo.toString();
      order.outTx.txCreatedAt = new Date();
      order.outTx.maxConfirmations = appConfig.ethereumRequiredConfirmations;
      order.outTx.tx = tx;

      await order.save({ transaction });
    });
    await bookerRPC.call('update_tx', {
      coin: order.outTx.coin,
      tx_id: order.outTx.txId,
      from_address: order.outTx.fromAddress,
      to_address: order.outTx.toAddress,
      amount: order.outTx.amount,
      created_at: order.outTx.txCreatedAt,
      confirmations: order.outTx.confirmations,
      max_confirmations: order.outTx.maxConfirmations,
    });
  }

  return tx;
}

export async function processTx(
  job: Job,
  order: Orders,
  txType: TxType,
  tx: any
): Promise<boolean> {
  if (typeof order.inTx === 'undefined') {
    throw new OrderUnknownInTx();
  }

  if (typeof order.outTx === 'undefined') {
    throw new OrderUnknownOutTx();
  }

  const txInOut =
    txType === 'in' ? order.inTx : txType === 'out' ? order.outTx : null;

  if (txInOut === null) {
    throw new OrderUnknownType();
  }

  if (typeof txInOut.coin === 'undefined' || txInOut.coin !== 'USDT') {
    throw new OrderTxUnknownCoinTo();
  }

  if (typeof txInOut.toAddress === 'undefined' || txInOut.toAddress === null) {
    throw new OrderTxUnknownToAddress();
  }

  const erc20Contract = erc20Contracts[txInOut.coin];

  const txHash = tx.hash ?? tx.transactionHash;
  const txRaw = tx.raw ?? tx.rawTransaction;
  let transferDecl = null;

  for (const decl of erc20Contract._jsonInterface) {
    if (decl.name === 'Transfer' && decl.anonymous === false) {
      transferDecl = decl;

      break;
    }
  }

  if (transferDecl === null) {
    throw new TransferEventDeclDoesntExist();
  }

  do {
    let txNotFetched = true;
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

      if (txStatus.status) {
        for (const log of txStatus.logs) {
          if (transferEvent !== null) {
            multipleTransferEvent = true;
          }

          if (
            log.topics.length > 0 &&
            log.topics[0] === transferDecl.signature
          ) {
            transferEvent = web3.eth.abi.decodeLog(
              transferDecl.inputs,
              log.data,
              log.topics.slice(1)
            );
          }
        }
      }

      txNotFetched =
        txStatus === null ||
        !txStatus.status ||
        transferEvent === null ||
        multipleTransferEvent ||
        transferEvent.to !== txInOut.toAddress ||
        transferEvent.amount === null;

      if (txNotFetched) {
        tryFetchNumber += 1;

        if (tryFetchNumber >= appConfig.ethereumBlockTryCheckNumber) {
          console.error(
            `Job ${inspect(job.id)} skipped transaction ${inspect(txHash)}: ` +
              `unknown, pending, reverted, Transfer event doesn't ` +
              `exist, multiple Transfer event, recipient's address ` +
              `doesn't match`
          );

          return false;
        }

        if ((await web3.eth.getTransaction(txHash)) === null) {
          await web3.eth.sendSignedTransaction(txRaw);
        } else {
          await new Promise((resolve, _reject) => {
            setTimeout(() => resolve(), appConfig.ethereumBlockCheckTime);
          });
        }
      }
    } while (txNotFetched);

    const txInitial = false;
    const assetDecimals = new Decimal(
      await erc20Contract.methods.decimals().call()
    );
    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    const amountFrom = new Decimal(transferEvent!.amount)
      .div(Decimal.pow(10, assetDecimals))
      .toString();
    const confirmations = currentBlock - txStatus!.blockNumber + 1;
    /* eslint-enable @typescript-eslint/no-non-null-assertion */

    if (txInOut.confirmations >= txInOut.maxConfirmations) {
      return true;
    }

    await sequelize.transaction(async (transaction: Transaction) => {
      if (txInOut.txId === null) {
        txInOut.txId = txHash;
        txInOut.fromAddress = transferEvent.from;
        txInOut.amount = amountFrom;
        txInOut.txCreatedAt = new Date();
        txInOut.maxConfirmations = appConfig.ethereumRequiredConfirmations;
        txInOut.tx = tx;
      }

      txInOut.confirmations = confirmations;

      await order.save({ transaction });

      return true;
    });
    await bookerRPC.call('update_tx', {
      coin: txInOut.coin,
      tx_id: txInOut.txId,
      from_address: txInOut.fromAddress,
      to_address: txInOut.toAddress,
      amount: txInOut.amount,
      created_at: txInOut.txCreatedAt,
      confirmations: txInOut.confirmations,
      max_confirmations: txInOut.maxConfirmations,
    });

    if (txInOut.confirmations < txInOut.maxConfirmations) {
      await new Promise((resolve, _reject) => {
        setTimeout(() => resolve(), appConfig.ethereumBlockCheckTime);
      });
    }
  } while (txInOut.confirmations < txInOut.maxConfirmations);

  return true;
}

export async function fetchAndProcessTx(
  job: Job,
  order: Orders,
  txType: TxType,
  event: EventData
): Promise<boolean> {
  let tx;
  let tryFetchNumber = 0;

  do {
    tx = await web3.eth.getTransaction(event.transactionHash);

    if (tx === null) {
      tryFetchNumber += 1;

      if (tryFetchNumber >= appConfig.ethereumBlockTryCheckNumber) {
        console.error(
          `Job ${inspect(job.id)} skipped event ${inspect(
            event.transactionHash
          )}: unknown or pending`
        );

        return false;
      }

      await new Promise((resolve, _reject) => {
        setTimeout(() => resolve(), appConfig.ethereumBlockCheckTime);
      });
    }
  } while (tx === null);

  return processTx(job, order, txType, tx);
}

export async function fetchAllHistoricalBlock(
  job: Job,
  order: Orders,
  txType: TxType,
  taskStatus: TaskStatus
): Promise<boolean> {
  if (typeof order.inTx === 'undefined') {
    throw new OrderUnknownInTx();
  }

  if (typeof order.outTx === 'undefined') {
    throw new OrderUnknownOutTx();
  }

  const txInOut =
    txType === 'in' ? order.inTx : txType === 'out' ? order.outTx : null;

  if (txInOut === null) {
    throw new OrderUnknownType();
  }

  if (typeof txInOut.toAddress === 'undefined' || txInOut.toAddress === null) {
    throw new OrderTxUnknownToAddress();
  }

  const erc20Contract = erc20Contracts[order.outTx.coin];
  const currentBlock = await web3.eth.getBlockNumber();
  let lastError = null;

  for (const rightBlock of range(currentBlock, 0, -appConfig.web3BatchSize)) {
    if (taskStatus.resolved()) {
      return false;
    }

    let leftBlock = rightBlock - appConfig.web3BatchSize + 1;

    leftBlock = leftBlock > 0 ? leftBlock : 0;

    let events = null;

    try {
      events = await erc20Contract.getPastEvents('Transfer', {
        filter: {
          to: txInOut.toAddress,
        },
        fromBlock: leftBlock,
        toBlock: rightBlock,
      });
    } catch (error) {
      console.error(
        `Job ${inspect(job.id)} skipped blocks from ${inspect(
          leftBlock
        )} to ${inspect(rightBlock)}`,
        error
      );
      lastError = error;
    }

    if (events !== null) {
      for (const event of events) {
        const processed = await fetchAndProcessTx(job, order, txType, event);

        if (processed) {
          return true;
        }
      }
    }
  }

  if (lastError !== null) {
    throw lastError;
  }

  return false;
}

export async function fetchAllNewBlock(
  job: Job,
  order: Orders,
  txType: TxType,
  taskStatus: TaskStatus
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    if (typeof order.inTx === 'undefined') {
      throw new OrderUnknownInTx();
    }

    if (typeof order.outTx === 'undefined') {
      throw new OrderUnknownOutTx();
    }

    const txInOut =
      txType === 'in' ? order.inTx : txType === 'out' ? order.outTx : null;

    if (txInOut === null) {
      throw new OrderUnknownType();
    }

    if (
      typeof txInOut.toAddress === 'undefined' ||
      txInOut.toAddress === null
    ) {
      throw new OrderTxUnknownToAddress();
    }

    const erc20Contract = erc20Contracts[order.outTx.coin];

    erc20Contract.once(
      'Transfer',
      {
        filter: {
          to: txInOut.toAddress,
        },
      },
      (eventError: Error, event: EventData) => {
        if (taskStatus.resolved()) {
          resolve(false);
        }

        if (eventError !== null) {
          reject(eventError);
        }

        fetchAndProcessTx(job, order, txType, event).then(
          (processed: boolean) => resolve(processed),
          (processError) => reject(processError)
        );
      }
    );
  });
}

export async function fetchBlockUntilTxFound(
  job: Job,
  order: Orders,
  txType: TxType
): Promise<boolean> {
  const orderCloned = await sequelize.transaction(
    async (transaction: Transaction) => {
      const maybeOrderCloned = await Orders.findByPk(order.id, {
        include: [
          { model: Txs, as: 'inTx' },
          { model: Txs, as: 'outTx' },
        ],
        transaction,
      });

      if (maybeOrderCloned === null) {
        throw new OrderNotFound();
      }

      return maybeOrderCloned;
    }
  );

  const txInOut =
    txType === 'in' ? order.inTx : txType === 'out' ? order.outTx : null;

  if (typeof txInOut === 'undefined' || txInOut === null) {
    throw new OrderUnknownType();
  }

  if (
    txInOut.txId !== null &&
    txInOut.confirmations >= txInOut.maxConfirmations
  ) {
    return true;
  }

  return resolveAny(job, [
    {
      handler: async (taskStatus: TaskStatus): Promise<boolean> => {
        return fetchAllHistoricalBlock(job, orderCloned, txType, taskStatus);
      },
      skip: true,
    },
    {
      handler: async (taskStatus: TaskStatus): Promise<boolean> => {
        return fetchAllNewBlock(job, order, txType, taskStatus);
      },
      skip: false,
    },
  ]);
}