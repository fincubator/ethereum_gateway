import {
  Aes,
  ChainStore,
  ChainTypes,
  FetchChain,
  PrivateKey,
  TransactionBuilder,
} from 'bitsharesjs';
import { Apis } from 'bitsharesjs-ws';
import { Job } from 'bullmq';
import { Decimal } from 'decimal.js';
import { Op as SequelizeOp } from 'sequelize';

import { appConfig, onStart } from './app';
import {
  DerivedWallets as DerivedWalletsModel,
  Transactions as TransactionsModel,
  TransactionsCommitPrefix as TransactionsModelCommitPrefix,
  TransactionsStatus as TransactionsModelStatus,
  TransactionsStatusInitial as TransactionsModelStatusInitial,
  TransactionsTx as TransactionsModelTx,
  TransactionsTxRaw as TransactionsModelTxRaw,
  Wallets as WalletsModel,
  sequelize,
} from './models';
import { TaskStatus, resolveAny, toCamelCase } from './utils';

export class TrNotFound extends Error {}

export class UnknownTicker extends Error {}

export class UnknownTickerFee extends UnknownTicker {}

export class UnknownTickerFrom extends UnknownTicker {}

export class UnknownTickerTo extends UnknownTicker {}

export class UnknownAccount extends Error {}

export class UnknownAccountFrom extends UnknownAccount {}

export class UnknownAccountTo extends UnknownAccount {}

export class UnknownStatus extends Error {}

const wif = PrivateKey.fromWif(appConfig.bitsharesSignKey);
let wifPublicKey;
const wifMemo = PrivateKey.fromWif(appConfig.bitsharesMemoKey);

let bitshares;

onStart.push(
  (async () => {
    Apis.setAutoReconnect(true);

    while (true) {
      try {
        await new Promise((resolve, reject) => {
          bitshares = Apis.instance(
            appConfig.bitsharesProvider,
            true,
            appConfig.bitsharesConnectionTimeout,
            undefined,
            () => resolve()
          )
            .init_promise.then(() => {
              wifPublicKey = wif.toPublicKey().toPublicKeyString();

              return ChainStore.init();
            })
            .catch((error) => reject(error));
        });
      } catch (error) {
        console.error(error);
      }
    }
  })()
);

export interface TxCreate {
  (
    job: Job,
    tr: TransactionsModel,
    tx: TransactionsModelTxRaw
  ): Promise<Decimal | null>;
}

export async function txIssue(
  _job: Job,
  tr: TransactionsModel,
  tx: TransactionsModelTxRaw
): Promise<Decimal> {
  if (tr.tickerFrom !== 'USDT') {
    throw new UnknownTickerFrom();
  }

  if (tr.tickerTo !== 'FINTEH.USDT') {
    throw new UnknownTickerTo();
  }

  const assetFee = await FetchChain('getAsset', appConfig.bitsharesAssetFee);
  const assetTo = await FetchChain('getAsset', tr.tickerTo);
  const accountTo = await FetchChain(
    'getAccount',
    tr.derivedWallet!.wallet!.invoice
  );

  if (assetFee === null) {
    throw new UnknownTickerFee();
  }

  if (assetTo === null) {
    throw new UnknownTickerTo();
  }

  if (accountTo === null) {
    throw new UnknownAccountTo();
  }

  const amountTo = Decimal.mul(
    tr.amountFrom!,
    Decimal.pow(10, assetTo.get('precision'))
  );

  tx.add_type_operation('asset_issue', {
    issuer: assetTo.get('issuer'),
    asset_to_issue: {
      amount: amountTo.toNumber(),
      asset_id: assetTo.get('id'),
    },
    issue_to_account: accountTo.get('id'),
    fee: { amount: 0, asset_id: assetFee.get('id') },
  });

  return amountTo;
}

export async function txBurn(
  _job: Job,
  tr: TransactionsModel,
  tx: TransactionsModelTxRaw
): Promise<null> {
  if (tr.tickerFrom !== 'FINTEH.USDT') {
    throw new UnknownTickerFrom();
  }

  const assetFee = await FetchChain('getAsset', appConfig.bitsharesAssetFee);
  const assetFrom = await FetchChain('getAsset', tr.tickerFrom);

  if (assetFee === null) {
    throw new UnknownTickerFee();
  }

  if (assetFrom === null) {
    throw new UnknownTickerFrom();
  }

  const amountFrom = Decimal.mul(
    tr.amountFrom!,
    Decimal.pow(10, assetFrom.get('precision'))
  );

  tx.add_type_operation('asset_reserve', {
    amount_to_reserve: {
      amount: amountFrom.toNumber(),
      asset_id: assetFrom.get('id'),
    },
    payer: assetFrom.get('issuer'),
    fee: { amount: 0, asset_id: assetFee.get('id') },
  });

  return null;
}

export async function txCommit(
  job: Job,
  tr: TransactionsModel,
  txCreate: TxCreate,
  previousStatus: TransactionsModelStatusInitial,
  commitPrefix: TransactionsModelCommitPrefix
): Promise<any> {
  let txPrefix = toCamelCase(commitPrefix);

  txPrefix = `tx${txPrefix.charAt(0).toUpperCase()}${txPrefix.substring(1)}`;

  const txCreatedAtPrefix = `${txPrefix}CreatedAt`;
  const okStatus = `${commitPrefix}_commit_ok` as TransactionsModelStatus;
  const errStatus = `${commitPrefix}_commit_err` as TransactionsModelStatus;
  let tx;

  if (tr.status === previousStatus || tr.status === errStatus) {
    tx = new TransactionBuilder();

    const amountTo = await txCreate(job, tr, tx);

    await tx.update_head_block();

    const chainProperties = await Apis.instance()
      .db_api()
      .exec('get_global_properties', []);
    const dynamicChainProperties = await Apis.instance()
      .db_api()
      .exec('get_dynamic_global_properties', []);

    tx.set_expire_seconds(
      chainProperties.parameters.maximum_time_until_expiration - 60
    );
    await tx.set_required_fees();
    tx.add_signer(wif, wifPublicKey);

    await tx.finalize();

    const txId = tx.id();
    const txRaw = tx.serialize();
    const blockFrom = dynamicChainProperties.last_irreversible_block_num + 1;

    await sequelize.transaction(async (transaction) => {
      const txCommited = tr[txPrefix] ?? {};

      if (tx[txCreatedAtPrefix] === null) {
        tx[txCreatedAtPrefix] = new Date();
      }

      if (typeof txCommited.tx === 'undefined' || txCommited.tx === null) {
        txCommited.tx = txRaw;
        txCommited.txId = txId;
        txCommited.txIndex = 0;
        txCommited.blockFrom = blockFrom;
        tr[txPrefix] = txCommited;

        if (amountTo !== null) {
          tr.amountTo = amountTo.toString();
        }
      }

      tr.status = okStatus;

      await tr.save({ transaction });
    });
  } else {
    tx = new TransactionBuilder(tr[txPrefix].tx);

    await tx.finalize();
  }

  return tx;
}

export async function processTx(
  job: Job,
  tr: TransactionsModel,
  tx: TransactionsModelTxRaw,
  txIndex: number,
  previousStatus: TransactionsModelStatusInitial,
  commitPrefix: TransactionsModelCommitPrefix,
  blockFrom: number | null = null
): Promise<boolean> {
  let txPrefix = toCamelCase(commitPrefix);

  txPrefix = `tx${txPrefix.charAt(0).toUpperCase()}${txPrefix.substring(1)}`;

  const txCreatedAtPrefix = `${txPrefix}CreatedAt`;
  const pendingStatus = `${commitPrefix}_pending` as TransactionsModelStatus;
  const okStatus = `${commitPrefix}_ok` as TransactionsModelStatus;
  const errStatus = `${commitPrefix}_err` as TransactionsModelStatus;
  const chainProperties = await Apis.instance()
    .db_api()
    .exec('get_global_properties', []);
  let dynamicChainProperties;
  const now = Math.ceil(Date.now() / 1000);
  const elapsed =
    now > tx.expiration
      ? now -
        tx.expiration +
        chainProperties.parameters.maximum_time_until_expiration
      : tx.expiration - now;
  const broadcast =
    chainProperties.parameters.maximum_time_until_expiration > elapsed;
  let blockTo;

  do {
    let txNotFetched = true;
    let blockHeight: number;
    let tryFetchNumber = 0;

    do {
      txNotFetched = true;

      if (
        broadcast &&
        (await Apis.instance()
          .db_api()
          .exec('get_recent_transaction_by_id', [tx.id()])) === null
      ) {
        try {
          await tx.broadcast();
        } catch (error) {
          console.error(
            `Job ${job.id} failed broadcast transaction ${tx.id()}`,
            error
          );
        }
      }

      dynamicChainProperties = await Apis.instance()
        .db_api()
        .exec('get_dynamic_global_properties', []);
      blockFrom =
        blockFrom ??
        (tryFetchNumber < appConfig.bithsaresBlockTryCheckNumber
          ? tr[txPrefix].blockFrom
          : 0);
      blockTo = dynamicChainProperties.head_block_number;

      for (
        blockHeight = blockTo;
        blockHeight >= blockFrom! && txNotFetched;
        blockHeight -= 1
      ) {
        const block = await Apis.instance()
          .db_api()
          .exec('get_block', [blockHeight]);

        for (const txCheckRaw of block.transactions) {
          const txCheck = new TransactionBuilder(txCheckRaw);

          try {
            await txCheck.finalize();
          } catch (error) {
            console.error(
              `Job ${job.id} skipped transaction ${txCheck}`,
              error
            );

            continue;
          }

          if (tx.id() === txCheck.id()) {
            txNotFetched = false;
          }
        }
      }

      if (txNotFetched) {
        tryFetchNumber += 1;

        if (tryFetchNumber >= appConfig.bithsaresBlockTryCheckNumber) {
          console.error(
            `Job ${job.id} skipped transaction ${tx.id()}: ` +
              `unknown, pending`
          );

          return false;
        }

        await new Promise((resolve, _reject) => {
          setTimeout(() => resolve(), appConfig.bithsaresBlockCheckTime);
        });
      }
    } while (txNotFetched);

    let txInitial = false;
    let amountFrom: string;

    if (commitPrefix === 'receive') {
      const assetFrom = await FetchChain(
        'getAsset',
        tx.operations[txIndex][1].amount.asset_id
      );
      const txRaw = tx.serialize();

      amountFrom = new Decimal(txRaw.operations[txIndex][1].amount.amount)
        .div(Decimal.pow(10, assetFrom.get('precision')))
        .toString();
    }
    const confirmations = blockTo - blockHeight;
    const status =
      blockHeight > dynamicChainProperties.last_irreversible_block_num
        ? pendingStatus
        : okStatus;
    const commitStatus = await sequelize.transaction(async (transaction) => {
      const txCommited: TransactionsModelTx = tr[txPrefix] ?? {};

      if (tr.status === previousStatus || tr.status === errStatus) {
        const existingTx = await TransactionsModel.findOne({
          attributes: ['id'],
          where: {
            id: { [SequelizeOp.ne]: tr.id },
            [txPrefix]: { txId: tx.id(), txIndex },
          },
          transaction,
        });

        if (existingTx !== null) {
          return false;
        }

        if (tr[txCreatedAtPrefix] === null) {
          tr[txCreatedAtPrefix] = new Date();
        }

        if (typeof txCommited.tx === 'undefined' || txCommited.tx == null) {
          txCommited.tx = tx.serialize();
          txCommited.txId = tx.id();
          txCommited.txIndex = txIndex;
          txInitial = true;
        }
      }

      if (txInitial || txCommited.confirmations !== confirmations) {
        txCommited.confirmations = confirmations;
        tr[txPrefix] = txCommited;
      }

      if (
        tr.status === previousStatus ||
        tr.status === pendingStatus ||
        tr.status === errStatus
      ) {
        if (commitPrefix === 'receive' && tr.amountFrom !== amountFrom) {
          tr.amountFrom = amountFrom;
        }

        tr.status = status;
      }

      await tr.save({ transaction });

      return true;
    });

    if (!commitStatus) {
      return false;
    }

    if (tr.status !== okStatus) {
      await new Promise((resolve, _reject) => {
        setTimeout(() => resolve(), appConfig.bithsaresBlockCheckTime);
      });
    }
  } while (tr.status !== okStatus);

  return true;
}

export async function skipOrProcessTx(
  job: Job,
  tr: TransactionsModel,
  tx: TransactionsModelTxRaw,
  previousStatus: TransactionsModelStatusInitial,
  commitPrefix: TransactionsModelCommitPrefix,
  blockFrom: number
): Promise<boolean> {
  for (let txIndex = 0; txIndex < tx.operations.length; txIndex += 1) {
    const op = tx.operations[txIndex];

    if (op[0] === ChainTypes.operations.transfer) {
      const assetFrom = await FetchChain('getAsset', tr.tickerFrom);

      if (
        op[1].amount.asset_id !== assetFrom.get('id') ||
        op[1].to !== assetFrom.get('issuer')
      ) {
        continue;
      }

      if (typeof op[1].memo !== 'undefined' || op[1].memo !== null) {
        let memo = null;

        const accountFrom = await FetchChain('getAccount', op[1].from);
        const accountFromMemo = accountFrom.getIn(['options', 'memo_key']);

        try {
          memo = Aes.decrypt_with_checksum(
            wifMemo,
            accountFromMemo,
            op[1].memo.nonce,
            op[1].memo.message
          ).toString();
        } catch (error) {
          console.error(`Job ${job.id} skipped transaction ${tx.id()}`, error);
        }

        if (memo === null || tr.derivedWallet!.invoice !== memo) {
          console.error(
            `Job ${job.id} skipped transaction ${tx.id()}: ` + `unknown memo`
          );

          continue;
        }
      }

      const commitStatus = await processTx(
        job,
        tr,
        tx,
        txIndex,
        previousStatus,
        commitPrefix,
        blockFrom
      );

      if (commitStatus) {
        return true;
      }
    }
  }

  return false;
}

export async function fetchAllHistoricalBlock(
  job: Job,
  tr: TransactionsModel,
  blockTo: number,
  previousStatus: TransactionsModelStatusInitial,
  commitPrefix: TransactionsModelCommitPrefix,
  taskStatus: TaskStatus
): Promise<boolean> {
  let lastError = null;

  for (let blockHeight = blockTo; blockHeight >= 0; blockHeight -= 1) {
    if (taskStatus.resolved()) {
      return false;
    }

    let block = null;

    try {
      block = await Apis.instance().db_api().exec('get_block', [blockHeight]);
    } catch (error) {
      console.error(`Job ${job.id} skipped block from ${blockHeight}`, error);
      lastError = error;
    }

    for (const txRaw of block.transactions) {
      const tx = new TransactionBuilder(txRaw);

      try {
        await tx.finalize();
      } catch (error) {
        console.error(`Job ${job.id} skipped transaction ${tx}`, error);

        continue;
      }

      const processed = await skipOrProcessTx(
        job,
        tr,
        tx,
        previousStatus,
        commitPrefix,
        blockHeight
      );

      if (processed) {
        return true;
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
  tr: TransactionsModel,
  blockFrom: number,
  previousStatus: TransactionsModelStatusInitial,
  commitPrefix: TransactionsModelCommitPrefix,
  taskStatus: TaskStatus
): Promise<boolean> {
  let dynamicChainProperties;

  while (true) {
    do {
      if (taskStatus.resolved()) {
        return false;
      }

      dynamicChainProperties = await Apis.instance()
        .db_api()
        .exec('get_dynamic_global_properties', []);

      if (blockFrom >= dynamicChainProperties.last_irreversible_block_num + 1) {
        await new Promise((resolve, _reject) => {
          setTimeout(() => resolve(), appConfig.bithsaresBlockCheckTime);
        });
      }
    } while (
      blockFrom >=
      dynamicChainProperties.last_irreversible_block_num + 1
    );

    for (
      let blockHeight = blockFrom;
      blockHeight <= dynamicChainProperties.last_irreversible_block_num;
      blockHeight += 1
    ) {
      if (taskStatus.resolved()) {
        return true;
      }

      const block = await Apis.instance()
        .db_api()
        .exec('get_block', [blockHeight]);

      for (const txRaw of block.transactions) {
        const tx = new TransactionBuilder(txRaw);

        try {
          await tx.finalize();
        } catch (error) {
          console.error(`Job ${job.id} skipped transaction ${tx}`, error);

          continue;
        }

        const processed = await skipOrProcessTx(
          job,
          tr,
          tx,
          previousStatus,
          commitPrefix,
          blockHeight
        );

        if (processed) {
          return true;
        }
      }
    }

    blockFrom = dynamicChainProperties.last_irreversible_block_num + 1;
  }
}

export async function fetchBlockUntilTxFound(
  job: Job,
  tr: TransactionsModel,
  previousStatus: TransactionsModelStatusInitial,
  commitPrefix: TransactionsModelCommitPrefix
): Promise<boolean> {
  if (tr.tickerFrom !== 'FINTEH.USDT') {
    throw new UnknownTickerFrom();
  }

  const trCloned = await sequelize.transaction(async (transaction) => {
    const maybeTrCloned = await TransactionsModel.findByPk(tr.id, {
      include: [
        {
          model: DerivedWalletsModel,
          as: 'derivedWallet',
          include: [{ model: WalletsModel, as: 'wallet' }],
        },
      ],
      transaction,
    });

    if (maybeTrCloned === null) {
      throw new TrNotFound();
    }

    return maybeTrCloned;
  });

  const dynamicChainProperties = await Apis.instance()
    .db_api()
    .exec('get_dynamic_global_properties', []);

  return resolveAny(job, [
    {
      handler: async (taskStatus: TaskStatus): Promise<boolean> => {
        return fetchAllHistoricalBlock(
          job,
          trCloned,
          dynamicChainProperties.last_irreversible_block_num,
          previousStatus,
          commitPrefix,
          taskStatus
        );
      },
      skip: true,
    },
    {
      handler: async (taskStatus: TaskStatus): Promise<boolean> => {
        return fetchAllNewBlock(
          job,
          tr,
          dynamicChainProperties.last_irreversible_block_num + 1,
          previousStatus,
          commitPrefix,
          taskStatus
        );
      },
      skip: false,
    },
  ]);
}

export async function withClient<T>(task: () => Promise<T>): Promise<T> {
  return bitshares.then(() => {
    return task();
  });
}
