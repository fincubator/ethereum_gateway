import { Decimal } from 'decimal.js';

import models, { sequelize } from '../models';
import contracts, { web3 } from '../web3';
import { ChainStore, FetchChain, TransactionBuilder, wif,
         bitshares } from '../bitshares';


class UnknownAccount extends Error {};

class UnknownAccountFrom extends UnknownAccount {};

class UnknownAccountTo extends UnknownAccount {};

class OverwritingProhibited extends Error {};

class UnknownTicker extends Error {};

class UnknownTickerFee extends UnknownTicker {};

class UnknownTickerFrom extends UnknownTicker {};

class UnknownTickerTo extends UnknownTicker {};

class TxNotFound extends Error {};

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
  let rejectedNumber = 0;

  return await new Promise((resolve, reject) => {
    for(const task of tasks) {
      task(state).then(result => {
        if(state.resolved === false) {
          state.resolved = true;
          resolve(result);
        }
      }, error => {
        if(rejectedNumber < tasks.length) {
          console.error(`Some task in job ${job.id} failed with:`, error);
          rejectedNumber++;
        } if(state.resolved === false) {
          state.resolved = true;
          reject(error);
        }
      });
    }
  });
};

const catchAndCommitError = async (job, tr, task, status_on_error) => {
  try {
    await task();
  } catch(error) {
    await sequelize.transaction(async transaction => {
      tr.status = status_on_error;

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

const issueAssetWithChainStore = async (job, tr) => {
  if(tr.tickerTo !== 'FINTEH.USDT') {
    throw new UnknownTickerTo();
  }

  const timeout = 1000 * 60;
  const assetFee = await FetchChain('getAsset', 'BTS', timeout);
  const assetTo = await FetchChain('getAsset', tr.tickerTo, timeout);
  const accountTo = await FetchChain('getAccount', tr.DerivedWallet.Wallet,
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

  const amountTo = new Decimal(tr.amountFrom)
    .toDecimalPlaces(assetTo.get('precision')).toNumber();
  const tx = new TransactionBuilder();

  tx.add_type_operation('asset_issue', { issuer: assetTo.get('issuer'),
    asset_to_issue: { amount: amountTo, asset_id: assetTo.get('id') },
    issue_to_account: accountTo.get('id'), fee: { amount: 0, asset_id:
                                                  assetFee.get('id') }
  });
  await tx.set_required_fees();
  tx.add_signer(wif, wif.toPublicKey().toPublicKeyString());
  console.log(tx.serialize());
  console.log(tx.serialize().operations[0][1]);
  console.log(await tx.broadcast());

  throw new Error();
};

const issueAsset = async (job, tr) => {
  return await bitshares.then(() => {
    return issueAssetWithChainStore(job, tr);
  });
};

const processTx = async (job, tr, tx, assetDecimals) => {
  return await sequelize.transaction(async transaction => {
    const existing_tx = await models.Transactions.findOne({ attributes: ['id'],
      where: { txReceive: { tx: { transactionHash: tx.transactionHash } } },
      transaction
    });

    if(existing_tx !== null) {
      return false;
    }

    const txReceive = tr.txReceive ?? {};

    if(typeof txReceive.tx !== 'undefined' && txReceive.tx !== null) {
      throw new OverwritingProhibited();
    }

    if(tx.txReceiveCreatedAt === null) {
      tx.txReceiveCreatedAt = new Date();
    }

    txReceive.tx = tx;
    tr.txReceive = txReceive;
    tr.amountFrom = new Decimal(tx.returnValues.value)
      .div(Decimal.pow(10, assetDecimals)).toString();

    tr.status = 'tx_receive_ok';

    await tr.save({ transaction });

    return true;
  });
};

const processTxs = async (job, tr, txs, assetDecimals) => {
  let result;

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
  const batchSize = 1000;
  const currentBlock = await web3.eth.getBlockNumber();

  let result = false;
  let last_error = null;

  for(const rightBlock of range(currentBlock, 0, -batchSize)) {
    if(resolveState.resolved === true) {
      return result;
    }

    let leftBlock = rightBlock - batchSize + 1;

    leftBlock = leftBlock > 0 ? leftBlock : 0;

    let txs = null;

    try {
      txs = await contract.getPastEvents('Transfer', { filter: {
        to: tr.DerivedWallet.invoice
        //to: '0xab5c66752a9e8167967685f1450532fb96d5d24f'
      }, fromBlock: leftBlock, toBlock: rightBlock });
    } catch(error) {
      console.error(
        `Job ${job.id} skipped blocks from ${leftBlock} to ${rightBlock}`, error
      );
      last_error = error;
    }

    if(txs !== null) {
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
      //to: '0xab5c66752a9e8167967685f1450532fb96d5d24f'
    } }, (error, tx) => {
      if(resolveState.resolved === true) {
        resolve(false);
      }

      if(error !== null) {
        reject(error);
      }

      resolve(processTx(job, tr, tx, assetDecimals)
        .then(result => resolve(result), error => reject(error)));
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
    async (state) => { return await fetchAllHistoricalBlock(job, tr, contract,
                                                            assetDecimals,
                                                            state); },
    async (state) => { return await fetchAllNewBlock(job, tr, contract,
                                                     assetDecimals, state); }
  ]);

  if(result === true) {
    return result;
  }

  throw new TxNotFound();
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

  if(tr.status === 'init' || tr.status === 'tx_receive_err') {
    await catchAndCommitError(job, tr, async () => { 
      return await fetchBlockUntilTxFound(job, tr);
    }, 'tx_receive_err');
  }

  if(tr.status === 'tx_receive_ok' || tr.status === 'tx_issue_err') {
    await catchAndCommitError(job, tr, async () => { 
      return await issueAsset(job, tr);
    }, 'tx_issue_err');

    return;
  }

  throw new UnknownStatus();
};

export default queue => queue.process('payment:ethereum:bitshares', jobDecl);
