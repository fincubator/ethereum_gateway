import { Decimal } from 'decimal.js';

import { appConfig } from '../app';
import models, { Sequelize, sequelize } from '../models';
import contracts, { web3 } from '../web3';
import { Apis, ChainStore, FetchChain, TransactionBuilder, wif, wifPublicKey,
         bitshares } from '../bitshares';

class OverwritingProhibited extends Error {};

class UnknownTicker extends Error {};

class UnknownTickerFee extends UnknownTicker {};

class UnknownTickerFrom extends UnknownTicker {};

class UnknownTickerTo extends UnknownTicker {};

class TxNotFound extends Error {};

class UnknownAccount extends Error {};

class UnknownAccountFrom extends UnknownAccount {};

class UnknownAccountTo extends UnknownAccount {};

class UnknownStatus extends Error {};

function* range(start, stop, step = 1) {
  for(let current = start;
      step > 0 ? current < stop : step < 0 ? current > stop : true;
      current += step) {
    yield current;
  }
}

const resolveAny = async (job, tasks) => {
  const state = { resolved: false };
  const requiredRejects = tasks.reduce((acc, task) => {
    if(task.skip === false) {
      acc++;
    }

    return acc;
  }, 0);
  let rejectedNumber = 0;

  return await new Promise((resolve, reject) => {
    for(const taskDecl of tasks) {
      taskDecl.task(state).then(result => {
        if(state.resolved === false && (taskDecl.skip === false ||
                                        result === true)) {
          state.resolved = true;
          resolve(result);
        }
      }, error => {
        if(rejectedNumber < requiredRejects - 1) {
          console.error(`Some task in job ${job.id} failed with:`, error);

          if(taskDecl.skip === false) {
            rejectedNumber++;
          }
        } if(state.resolved === false) {
          if(taskDecl.skip === false) {
            state.resolved = true;
            reject(error);
          } else {
            console.error(`Some task in job ${job.id} failed with:`, error);
          }
        }
      });
    }
  });
};

const catchAndCommitError = async (job, tr, task, status) => {
  try {
    return await task();
  } catch(error) {
    await sequelize.transaction(async transaction => {
      tr.status = status;

      const txReceive = tr.txReceive ?? {};

      if(error instanceof Error) {
        txReceive.last_error = { name: error.name, code: error.code,
                                 message: error.message,
                                 stacktrace: error.stack };
      } else {
        txReceive.last_error = error;
      }

      tr.txReceive = txReceive;

      await tr.save({ transaction });
    });

    throw error;
  }
};

const processTx = async (job, tr, tx, assetDecimals) => {
  const amountFrom = new Decimal(tx.returnValues.value)
    .div(Decimal.pow(10, assetDecimals)).toString();
  let bcTx, currentBlock;

  const fetchBcTx = async () => {
    bcTx = await web3.eth.getTransactionReceipt(tx.transactionHash);

    if(bcTx === null) {
      console.warn(`Job ${job.id} skipped transaction ${tx.transactionHash}: ` +
                   `unknown or pending`);

      return false;
    }

    if(bcTx.status === false) {
      console.warn(`Job ${job.id} skipped transaction ${tx.transactionHash}: ` +
                   `reverted`);

      return false;
    }

    currentBlock = await web3.eth.getBlockNumber();

    return true;
  };

  const commitTx = async status => {
    return await sequelize.transaction(async transaction => {
      const txReceive = tr.txReceive ?? {};

      if(tr.status === 'pending' || tr.status === 'receive_err') {
        const existing_tx = await models.Transactions.findOne({
          attributes: ['id'], where: { id: { [Sequelize.Op.ne]: tr.id },
            txReceive: { tx: { transactionHash: tx.transactionHash } }
          }, transaction
        });

        if(existing_tx !== null) {
          return false;
        }

        if(typeof txReceive.tx !== 'undefined' && txReceive.tx !== null) {
          throw new OverwritingProhibited();
        }

        if(tx.txReceiveCreatedAt === null) {
          tx.txReceiveCreatedAt = new Date();
        }

        txReceive.tx = tx;
        tr.amountFrom = amountFrom;
      }

      const confirmations = currentBlock - bcTx.blockNumber + 1;

      if(tr.status === 'pending' || tr.status === 'receive_err' ||
         txReceive.confirmations !== confirmations) {
        txReceive.confirmations = confirmations;
        tr.txReceive = txReceive;
      }

      if(tr.status === 'pending' || tr.status === 'receive_pending' ||
         tr.status === 'receive_err') {
        tr.status = status;
      }

      await tr.save({ transaction });

      return true;
    });
  };

  if(await fetchBcTx() === false) {
    return false;
  }

  while(bcTx.blockNumber + appConfig.ethereumRequiredConfirmations - 1 >
        currentBlock) {
    if(await await commitTx('receive_pending') === false) {
      return false;
    }

    await new Promise((resolve, reject) => {
      setTimeout(() => resolve(), appConfig.ethereumBlockTime);
    });

    if(await fetchBcTx() === false) {
      return false;
    }
  }

  return await commitTx('receive_ok');
};

const processTxs = async (job, tr, txs, assetDecimals) => {
  let result = false;

  for(const tx of txs) {
    result = await processTx(job, tr, tx, assetDecimals);

    if(result === true) {
      return result;
    }
  }

  return result;
};

const fetchAllHistoricalBlock = async (job, tr, contract, assetDecimals,
                                       resolveState) => {
  const currentBlock = await web3.eth.getBlockNumber();

  let result = false;
  let last_error = null;

  for(const rightBlock of range(currentBlock, 0, -appConfig.web3BatchSize)) {
    if(resolveState.resolved === true) {
      return result;
    }

    let leftBlock = rightBlock - appConfig.web3BatchSize + 1;

    leftBlock = leftBlock > 0 ? leftBlock : 0;

    let txs = null;

    try {
      txs = await contract.getPastEvents('Transfer', { filter: {
        to: tr.DerivedWallet.invoice
      }, fromBlock: leftBlock, toBlock: rightBlock });
    } catch(error) {
      console.error(
        `Job ${job.id} skipped blocks from ${leftBlock} to ${rightBlock}`, error
      );
      last_error = error;
    }

    if(txs !== null && txs.length === 0) {
      result = await processTxs(job, tr, txs, assetDecimals);

      if(result === true) {
        return result;
      }
    }
  }

  if(last_error !== null) {
    throw last_error;
  }

  return result;
};

const fetchAllNewBlock = async (job, tr, contract, assetDecimals,
                                resolveState) => {
  return await new Promise((resolve, reject) => {
    contract.once('Transfer', { filter: {
      to: tr.DerivedWallet.invoice
    } }, (error, tx) => {
      if(resolveState.resolved === true) {
        resolve(false);
      }

      if(error !== null) {
        reject(error);
      }

      processTx(job, tr, tx, assetDecimals).then(result => resolve(result),
        error => reject(error)
      );
    });
  });
};

const fetchBlockUntilTxFound = async (job, tr) => {
  const contract = contracts[tr.tickerFrom.toLowerCase()];

  if(typeof contract === 'undefined') {
    throw new UnknownTickerFrom();
  }

  const assetDecimals = new Decimal(await contract.methods.decimals().call());
  const result = await resolveAny(job, [
    { task: async state => {
      return await fetchAllHistoricalBlock(job, tr, contract, assetDecimals,
                                           state); }, skip: true },
    { task: async state => { return await fetchAllNewBlock(job, tr, contract,
                                                           assetDecimals,
                                                           state); },
      skip: false }
  ]);

  if(result === true) {
    return result;
  }

  throw new TxNotFound();
};

const issueTxCommit = async (job, tr) => {
  let tx;

  if(tr.status === 'receive_ok' || tr.status === 'issue_commit_err') {
    if(tr.tickerTo !== 'FINTEH.USDT') {
      throw new UnknownTickerTo();
    }

    const timeout = 1000 * 60;
    const assetFee = await FetchChain('getAsset', appConfig.bitsharesAssetFee,
                                      timeout);
    const assetTo = await FetchChain('getAsset', tr.tickerTo, timeout);
    const accountTo = await FetchChain('getAccount',
                                       tr.DerivedWallet.Wallet.invoice,
                                       timeout);

    if(assetFee === null) {
      throw new UnknownTickerFee();
    }

    if(assetTo === null) {
      throw new UnknownTickerTo();
    }

    if(accountTo === null) {
      throw new UnknownAccountTo();
    }

    const amountTo = Decimal.mul(tr.amountFrom, Decimal.pow(10,
      assetTo.get('precision'))
    ).toNumber();

    tx = new TransactionBuilder();

    tx.add_type_operation('asset_issue', { issuer: assetTo.get('issuer'),
      asset_to_issue: { amount: amountTo, asset_id: assetTo.get('id') },
      issue_to_account: accountTo.get('id'), fee: { amount: 0, asset_id:
                                                    assetFee.get('id') }
    });
    await tx.update_head_block();

    //const chain = await Apis.instance().db_api()
    //    .exec('get_chain_properties', []);

    //console.log(chain);

    tx.set_expire_seconds(60 * 60 * 24 - 60);
    await tx.set_required_fees();
    tx.add_signer(wif, wif.toPublicKey().toPublicKeyString());

    await tx.finalize();

    const txId = tx.id();
    const txData = tx.serialize();

    await sequelize.transaction(async transaction => {
      const txIssue = tr.txIssue ?? {};

      if(typeof txIssue.txId !== 'undefined' && txIssue.txId !== null) {
        throw new OverwritingProhibited();
      }

      if(typeof txIssue.tx !== 'undefined' && txIssue.tx !== null) {
        throw new OverwritingProhibited();
      }

      if(tx.txIssueCreatedAt === null) {
        tx.txIssueCreatedAt = new Date();
      }

      txIssue.txId = txId;
      txIssue.tx = txData;
      tr.txIssue = txIssue;
      tr.status = 'issue_commit_ok';

      await tr.save({ transaction });
    });
  } else if(tr.status !== 'pending' && tr.status !== 'receive_pending' &&
            tr.status !== 'receive_ok' && tr.status !== 'receive_err') {
    tx = new TransactionBuilder(tr.txIssue.tx);

    tx.add_signer(wif, wifPublicKey);
    await tx.finalize();
  } else {
    throw new UnknownStatus();
  }

  return tx;
};

const issueTxBroadcast = async (job, tr, tx) => {
  if(await Apis.instance().db_api()
    .exec('get_recent_transaction_by_id', [tx.id()]) === null) {
    await tx.broadcast();
  }

  while(true) {
    const bcStatus = (await Apis.instance().db_api()
      .exec('get_objects', [['2.1.0']]))[0];
    const blockTo = bcStatus.head_block_number;
    let blockHeight;
    let txFoundedInBlock = false;

    for(blockHeight = blockTo; blockHeight >= 0; blockHeight--) {
      const block = await Apis.instance().db_api()
        .exec('get_block', [blockHeight]);

      for(const txRaw of block.transactions) {
        const txCheck = new TransactionBuilder(txRaw);

        txCheck.add_signer(wif, wifPublicKey);

        try {
          await txCheck.finalize();
        } catch(error) {
          console.error(`Job ${job.id} skipped transaction`, error);

          continue;
        }

        if(tx.id() === txCheck.id()) {
          txFoundedInBlock = true;

          break;
        }
      }

      if(txFoundedInBlock === true) {
        break;
      }
    }

    if(txFoundedInBlock === true) {
      const confirmations = blockTo - blockHeight;

      await sequelize.transaction(async transaction => {
        const txIssue = tr.txIssue ?? {};

        if(tx.txIssueCreatedAt === null) {
          tx.txIssueCreatedAt = new Date();
        }

        if(txIssue.confirmations !== confirmations) {
          txIssue.confirmations = confirmations;
        }

        tr.txIssue = txIssue;

        if(tr.status === 'issue_commit_ok' || tr.status === 'issue_pending' ||
           tr.status === 'issue_err') {
          if(blockHeight <= bcStatus.last_irreversible_block_num) {
            tr.status = 'issue_ok';
          } else if(tr.status !== 'issue_pending') {
            tr.status = 'issue_pending';
          }
        }

        await tr.save({ transaction });
      });

      break;
    } else {
      if(await Apis.instance().db_api()
        .exec('get_recent_transaction_by_id', [tx.id()]) === null) {
        try {
          await tx.broadcast();
        } catch(error) {
          console.log(`Job ${job.id} failed broadcast transaction ${tx.id()}`,
                      error);
        }
      }
    }
  }
};

const issueTx = async task => {
  return await bitshares.then(() => { return task(); });
};

const jobDecl = async job => {
  const tr = await sequelize.transaction(async transaction => {
    const tr = await models.Transactions.findByPk(
      parseInt(job.id), { include: [{ model: models.DerivedWallets, include: [{
        model: models.Wallets
      }] }], transaction }
    );

    return tr;
  });

  if(tr.status === 'pending' || tr.status === 'receive_pending' ||
     tr.status === 'receive_err') {
    await catchAndCommitError(job, tr, async () => {
      return await fetchBlockUntilTxFound(job, tr);
    }, 'receive_err');
  }

  const tx = await catchAndCommitError(job, tr, async () => {
    return await issueTx(async () => { return issueTxCommit(job, tr); });
  }, 'issue_commit_err');

  if(tr.status === 'issue_commit_ok' || tr.status === 'issue_pending' ||
     tr.status === 'issue_err') {
    await catchAndCommitError(job, tr, async () => {
      return await issueTx(async () => {
        return issueTxBroadcast(job, tr, tx);
      });
    }, 'issue_err');
  }

  if(tr.status === 'issue_ok') {
    await sequelize.transaction(async transaction => {
      tr.status = 'ok';

      await tr.save({ transaction });
    });

    return;
  }

  throw new UnknownStatus();
};

export default queue => queue.process('payment:ethereum:bitshares', jobDecl);
