import type { EventEmitter } from 'events';

import type { Job } from 'bullmq';
import { Decimal } from 'decimal.js';
import hdwallet, { hdkey } from 'ethereumjs-wallet';
import type { Transaction } from 'sequelize';
import {
  Op,
  OptimisticLockError,
  Sequelize,
  UniqueConstraintError
} from 'sequelize';
import Web3 from 'web3';
import type { EventLog, PromiEvent, TransactionReceipt } from 'web3-core';
import type { EventData } from 'web3-eth-contract';
import { Contract, ContractOptions } from 'web3-eth-contract';
import type { AbiType, StateMutabilityType } from 'web3-utils';

import { appConfig } from './app';
import type { TxRaw, Wallets } from './models';
import { Orders, Txs, sequelize } from './models';
import { getBookerProvider } from './rpc';
import type { TaskStatus } from './utils';
import { inspect, range, resolveAny } from './utils';

export class OrderNotFound extends Error {}

export class OrderUnknownType extends Error {}

export class TxSignError extends Error {}

export class OrderUnknownInTx extends Error {}

export class OrderUnknownOutTx extends Error {}

export class OrderTxUnknownCoin extends Error {}

export class OrderTxUnknownCoinFrom extends Error {}

export class OrderTxUnknownCoinTo extends Error {}

export class OrderTxUnknownTxId extends Error {}

export class OrderTxUnknownAmount extends Error {}

export class OrderTxUnknownToAddress extends Error {}

export class OrderTxUnknownConfirmations extends Error {}

export class OrderTxUnknownMaxConfirmations extends Error {}

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
        type: 'string'
      }
    ],
    payable: false,
    stateMutability: 'view' as StateMutabilityType,
    type: 'function' as AbiType
  },
  {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [
      {
        name: 'symbol',
        type: 'string'
      }
    ],
    payable: false,
    stateMutability: 'view' as StateMutabilityType,
    type: 'function' as AbiType
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [
      {
        name: 'decimals',
        type: 'uint256'
      }
    ],
    payable: false,
    stateMutability: 'view' as StateMutabilityType,
    type: 'function' as AbiType
  },
  {
    constant: true,
    inputs: [],
    name: 'totalSupply',
    outputs: [
      {
        name: 'totalSupply',
        type: 'uint256'
      }
    ],
    payable: false,
    stateMutability: 'view' as StateMutabilityType,
    type: 'function' as AbiType
  },
  {
    constant: true,
    inputs: [
      {
        name: 'owner',
        type: 'address'
      }
    ],
    name: 'balanceOf',
    outputs: [
      {
        name: 'balance',
        type: 'uint256'
      }
    ],
    payable: false,
    stateMutability: 'view' as StateMutabilityType,
    type: 'function' as AbiType
  },
  {
    constant: false,
    inputs: [
      {
        name: 'to',
        type: 'address'
      },
      {
        name: 'amount',
        type: 'uint256'
      }
    ],
    name: 'transfer',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable' as StateMutabilityType,
    type: 'function' as AbiType
  },
  {
    constant: false,
    inputs: [
      {
        name: 'from',
        type: 'address'
      },
      {
        name: 'to',
        type: 'address'
      },
      {
        name: 'amount',
        type: 'uint256'
      }
    ],
    name: 'transferFrom',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable' as StateMutabilityType,
    type: 'function' as AbiType
  },
  {
    constant: false,
    inputs: [
      {
        name: 'spender',
        type: 'address'
      },
      {
        name: 'amount',
        type: 'uint256'
      }
    ],
    name: 'approve',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable' as StateMutabilityType,
    type: 'function' as AbiType
  },
  {
    constant: true,
    inputs: [
      {
        name: 'owner',
        type: 'address'
      },
      {
        name: 'spender',
        type: 'address'
      }
    ],
    name: 'allowance',
    outputs: [
      {
        name: 'remaining',
        type: 'uint256'
      }
    ],
    payable: false,
    stateMutability: 'view' as StateMutabilityType,
    type: 'function' as AbiType
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: 'from',
        type: 'address'
      },
      {
        indexed: true,
        name: 'to',
        type: 'address'
      },
      {
        indexed: false,
        name: 'amount',
        type: 'uint256'
      }
    ],
    name: 'Transfer',
    type: 'event' as AbiType
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: 'owner',
        type: 'address'
      },
      {
        indexed: true,
        name: 'spender',
        type: 'address'
      },
      {
        indexed: false,
        name: 'value',
        type: 'uint256'
      }
    ],
    name: 'Approval',
    type: 'event' as AbiType
  }
];

export interface ERC20Contracts {
  [key: string]: any;
}

const web3 = new Web3(appConfig.web3Provider);

export function toChecksumAddress(address: string): string {
  return web3.utils.toChecksumAddress(address);
}

export function getHotAddress(): string {
  return hdwallet
    .fromPrivateKey(Buffer.from(appConfig.ethereumSignKey, 'hex'))
    .getChecksumAddressString();
}

export function getColdAddress(wallet: Wallets): string {
  return hdkey
    .fromExtendedKey(appConfig.ethereumColdKey)
    .derivePath(`m/0/${wallet.id}`)
    .getWallet()
    .getChecksumAddressString();
}

export const erc20Contracts: ERC20Contracts = {
  // https://api.etherscan.io/api?module=contract&action=getsourcecode&address=
  USDT: new web3.eth.Contract(erc20Abi, appConfig.ethereumUSDTAddress)
};

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
    order.inTx.coin !== `${appConfig.exchangePrefix}.USDT`
  ) {
    throw new OrderTxUnknownCoinFrom();
  }

  if (typeof order.outTx.coin === 'undefined' || order.outTx.coin !== 'USDT') {
    throw new OrderTxUnknownCoinTo();
  }

  if (typeof order.inTx.txId === 'undefined') {
    throw new OrderTxUnknownTxId();
  }

  if (
    typeof order.outTx.toAddress === 'undefined' ||
    order.outTx.toAddress === null
  ) {
    throw new OrderTxUnknownToAddress();
  }

  if (typeof order.inTx.amount === 'undefined') {
    throw new OrderTxUnknownAmount();
  }

  if (typeof order.inTx.confirmations === 'undefined') {
    throw new OrderTxUnknownConfirmations();
  }

  if (typeof order.inTx.maxConfirmations === 'undefined') {
    throw new OrderTxUnknownMaxConfirmations();
  }

  let tx: TxRaw | null = null;
  const fromAdress = getHotAddress();

  if (
    order.inTx.txId !== null &&
    order.inTx.confirmations >= order.inTx.maxConfirmations
  ) {
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

    while (true) {
      const estimatedGas = await callData.estimateGas({ from: fromAdress });

      tx = await web3.eth.accounts.signTransaction(
        {
          to: erc20Contract._address,
          gas: estimatedGas * 4,
          data: callData.encodeABI()
        },
        appConfig.ethereumSignKey
      );

      try {
        const result = await sequelize.transaction(
          async (transaction: Transaction) => {
            const txsCount = await Txs.count({
              where: {
                txId: { [Op.ne]: null },
                error: 'NO_ERROR',
                confirmations: { [Op.lt]: Sequelize.col('maxConfirmations') }
              },
              transaction
            });

            if (txsCount > 0) {
              return false;
            }

            order.outTx.txId = tx!.transactionHash;
            order.outTx.fromAddress = fromAdress;
            order.outTx.amount = order.inTx.amount;
            order.outTx.txCreatedAt = new Date();
            order.outTx.maxConfirmations =
              appConfig.ethereumRequiredConfirmations;
            order.outTx.tx = tx;

            await order.outTx.save({ transaction });

            return true;
          }
        );

        if (!result) {
          await new Promise((resolve, _reject) => {
            setTimeout(() => resolve(), appConfig.ethereumBlockCheckTime);
          });

          continue;
        }

        break;
      } catch (error) {
        if (error instanceof UniqueConstraintError) {
          await new Promise((resolve, _reject) => {
            setTimeout(() => resolve(), appConfig.ethereumBlockCheckTime);
          });
        } else {
          throw error;
        }
      }
    }

    const booker = await getBookerProvider();

    await booker.call('update_order', {
      order_id: order.id,
      out_tx: {
        coin: order.outTx.coin,
        tx_id: order.outTx.txId,
        from_address: order.outTx.fromAddress,
        to_address: order.outTx.toAddress,
        amount: order.outTx.amount,
        error: order.outTx.error,
        created_at: order.outTx.txCreatedAt,
        confirmations: order.outTx.confirmations,
        max_confirmations: order.outTx.maxConfirmations,
      }
    });
  }

  return tx;
}

export async function processTx(
  job: Job,
  order: Orders,
  tx: any
): Promise<boolean> {
  if (typeof order.inTx === 'undefined') {
    throw new OrderUnknownInTx();
  }

  if (typeof order.outTx === 'undefined') {
    throw new OrderUnknownOutTx();
  }

  const txInOut =
    order.flow === 'IN'
      ? order.inTx
      : order.flow === 'OUT'
      ? order.outTx
      : null;

  if (txInOut === null) {
    throw new OrderUnknownType();
  }

  const txUpdateType =
    order.flow === 'IN' ? 'in_tx' : order.flow === 'OUT' ? 'out_tx' : null;

  if (txUpdateType === null) {
    throw new OrderUnknownType();
  }

  if (typeof txInOut.coin === 'undefined') {
    throw new OrderTxUnknownCoin();
  }

  if (typeof txInOut.txId === 'undefined') {
    throw new OrderTxUnknownTxId();
  }

  if (typeof txInOut.toAddress === 'undefined' || txInOut.toAddress === null) {
    throw new OrderTxUnknownToAddress();
  }

  if (typeof txInOut.confirmations === 'undefined') {
    throw new OrderTxUnknownConfirmations();
  }

  if (typeof txInOut.maxConfirmations === 'undefined') {
    throw new OrderTxUnknownMaxConfirmations();
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

  const booker = await getBookerProvider();

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

      if (txStatus === null) {
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
        toChecksumAddress(transferEvent.to) !==
          toChecksumAddress(txInOut.toAddress) ||
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

          if (
            txInOut.txId !== null &&
            txInOut.confirmations < txInOut.maxConfirmations
          ) {
            await sequelize.transaction(async (transaction: Transaction) => {
              txInOut.error = 'UNKNOWN_ERROR';

              await txInOut.save({ transaction });
            });

            await booker.call('update_order', {
              order_id: order.id,
              [txUpdateType]: {
                coin: txInOut.coin,
                tx_id: txInOut.txId,
                from_address: txInOut.fromAddress,
                to_address: txInOut.toAddress,
                amount: txInOut.amount,
                error: txInOut.error,
                created_at: txInOut.txCreatedAt,
                confirmations: txInOut.confirmations,
                max_confirmations: txInOut.maxConfirmations,
              },
            });
          }

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

    const assetDecimals = new Decimal(
      await erc20Contract.methods.decimals().call()
    );
    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    const amountFrom = new Decimal(transferEvent!.amount)
      .div(Decimal.pow(10, assetDecimals))
      .toString();
    const confirmations = currentBlock - txStatus!.blockNumber + 1;
    /* eslint-enable @typescript-eslint/no-non-null-assertion */

    if (confirmations < 0) {
      await new Promise((resolve, _reject) => {
        setTimeout(() => resolve(), appConfig.ethereumBlockCheckTime);
      });

      continue;
    }

    if (
      txInOut.txId !== null &&
      txInOut.confirmations >= txInOut.maxConfirmations
    ) {
      return true;
    }

    const txCommited = await sequelize.transaction(
      async (transaction: Transaction) => {
        if (txInOut.txId !== txHash) {
          const existingTx = await Txs.findOne({
            attributes: ['txId'],
            where: { txId: txHash },
            transaction
          });

          if (existingTx !== null) {
            return false;
          }
        }

        if (txInOut.txId === null) {
          txInOut.txId = txHash;
          txInOut.fromAddress = toChecksumAddress(transferEvent.from);
          txInOut.amount = amountFrom;
          txInOut.txCreatedAt = new Date();
          txInOut.maxConfirmations = appConfig.ethereumRequiredConfirmations;
          txInOut.tx = tx;
        }

        txInOut.confirmations = confirmations;

        await txInOut.save({ transaction });

        return true;
      }
    );

    if (!txCommited) {
      return false;
    }

    await booker.call('update_order', {
      order_id: order.id,
      [txUpdateType]: {
        coin: txInOut.coin,
        tx_id: txInOut.txId,
        from_address: txInOut.fromAddress,
        to_address: txInOut.toAddress,
        amount: txInOut.amount,
        error: txInOut.error,
        created_at: txInOut.txCreatedAt,
        confirmations: txInOut.confirmations,
        max_confirmations: txInOut.maxConfirmations,
      },
    });

    if (txInOut.confirmations < txInOut.maxConfirmations) {
      await new Promise((resolve, _reject) => {
        setTimeout(() => resolve(), appConfig.ethereumBlockCheckTime);
      });
    }
  } while (txInOut.confirmations < txInOut.maxConfirmations);

  return true;
}

export async function tryProcessTx(
  job: Job,
  order: Orders,
  tx: any
): Promise<boolean> {
  while (true) {
    try {
      return await processTx(job, order, tx);
    } catch (error) {
      if (error instanceof OptimisticLockError) {
        await sequelize.transaction(async (transaction: Transaction) => {
          await order.reload({ transaction });
        });
      } else {
        throw error;
      }
    }
  }
}

export async function fetchAndProcessTx(
  job: Job,
  order: Orders,
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

  return tryProcessTx(job, order, tx);
}

export async function fetchAllHistoricalBlock(
  job: Job,
  order: Orders,
  taskStatus: TaskStatus
): Promise<boolean> {
  if (typeof order.inTx === 'undefined') {
    throw new OrderUnknownInTx();
  }

  if (typeof order.outTx === 'undefined') {
    throw new OrderUnknownOutTx();
  }

  const txInOut =
    order.flow === 'IN'
      ? order.inTx
      : order.flow === 'OUT'
      ? order.outTx
      : null;

  if (txInOut === null) {
    throw new OrderUnknownType();
  }

  if (typeof txInOut.coin === 'undefined') {
    throw new OrderTxUnknownCoin();
  }

  if (typeof txInOut.txId === 'undefined') {
    throw new OrderTxUnknownTxId();
  }

  if (typeof txInOut.toAddress === 'undefined' || txInOut.toAddress === null) {
    throw new OrderTxUnknownToAddress();
  }

  if (typeof txInOut.confirmations === 'undefined') {
    throw new OrderTxUnknownConfirmations();
  }

  if (typeof txInOut.maxConfirmations === 'undefined') {
    throw new OrderTxUnknownMaxConfirmations();
  }

  if (
    txInOut.txId !== null &&
    txInOut.confirmations >= txInOut.maxConfirmations
  ) {
    return true;
  }

  const erc20Contract = erc20Contracts[txInOut.coin];
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
          to: txInOut.toAddress
        },
        fromBlock: leftBlock,
        toBlock: rightBlock
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
        const processed = await fetchAndProcessTx(job, order, event);

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
      order.flow === 'IN'
        ? order.inTx
        : order.flow === 'OUT'
        ? order.outTx
        : null;

    if (txInOut === null) {
      throw new OrderUnknownType();
    }

    if (typeof txInOut.coin === 'undefined') {
      throw new OrderTxUnknownCoin();
    }

    if (typeof txInOut.txId === 'undefined') {
      throw new OrderTxUnknownTxId();
    }

    if (
      typeof txInOut.toAddress === 'undefined' ||
      txInOut.toAddress === null
    ) {
      throw new OrderTxUnknownToAddress();
    }

    if (typeof txInOut.confirmations === 'undefined') {
      throw new OrderTxUnknownConfirmations();
    }

    if (typeof txInOut.maxConfirmations === 'undefined') {
      throw new OrderTxUnknownMaxConfirmations();
    }

    if (
      txInOut.txId !== null &&
      txInOut.confirmations >= txInOut.maxConfirmations
    ) {
      return true;
    }

    const erc20Contract = erc20Contracts[txInOut.coin];

    erc20Contract.once(
      'Transfer',
      {
        filter: {
          to: txInOut.toAddress
        }
      },
      (eventError: Error, event: EventData) => {
        if (taskStatus.resolved()) {
          resolve(false);
        }

        if (eventError !== null) {
          reject(eventError);
        }

        fetchAndProcessTx(job, order, event).then(
          (processed: boolean) => resolve(processed),
          (processError) => reject(processError)
        );
      }
    );
  });
}

export async function fetchBlockUntilTxFound(
  job: Job,
  order: Orders
): Promise<boolean> {
  const orderCloned = await sequelize.transaction(
    async (transaction: Transaction) => {
      const maybeOrderCloned = await Orders.findByPk(order.id, {
        include: [
          { model: Txs, as: 'inTx' },
          { model: Txs, as: 'outTx' }
        ],
        transaction
      });

      if (maybeOrderCloned === null) {
        throw new OrderNotFound();
      }

      return maybeOrderCloned;
    }
  );

  if (typeof order.inTx === 'undefined') {
    throw new OrderUnknownInTx();
  }

  if (typeof order.outTx === 'undefined') {
    throw new OrderUnknownOutTx();
  }

  const txInOut =
    order.flow === 'IN'
      ? order.inTx
      : order.flow === 'OUT'
      ? order.outTx
      : null;

  if (txInOut === null) {
    throw new OrderUnknownType();
  }

  if (typeof txInOut.txId === 'undefined') {
    throw new OrderTxUnknownTxId();
  }

  if (typeof txInOut.confirmations === 'undefined') {
    throw new OrderTxUnknownConfirmations();
  }

  if (typeof txInOut.maxConfirmations === 'undefined') {
    throw new OrderTxUnknownMaxConfirmations();
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
        return fetchAllHistoricalBlock(job, orderCloned, taskStatus);
      },
      skip: true
    },
    {
      handler: async (taskStatus: TaskStatus): Promise<boolean> => {
        return fetchAllNewBlock(job, order, taskStatus);
      },
      skip: false
    }
  ]);
}
