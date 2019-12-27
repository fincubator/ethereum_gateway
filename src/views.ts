import { Application, Request, Response } from 'express';
import { Op as SequelizeOp } from 'sequelize';
import EthereumHDKey from 'ethereumjs-wallet/hdkey';

import { app, appConfig } from './app';
import { sequelize, Wallets as WalletsModel,
         DerivedWallets as DerivedWalletsModel,
         Transactions as TransactionsModel } from './models';
import { queue } from './queue';

class UnknownPayment extends Error {};

async function getTransaction(rq: Request, rs: Response): Promise<void> {
  const tx = await sequelize.transaction(async transaction => {
    return await TransactionsModel.findByPk(rq.params.id, {
      attributes: ['tickerFrom', 'amountFrom', 'amountTo', 'status',
                   [sequelize.json('txReceive.confirmations'),
                    'txReceiveConfirmations'],
                   [sequelize.json('txReceive.txId'), 'txReceiveTxId'],
                   [sequelize.json('txReceive.txIndex'), 'txReceiveTxIndex'],
                   [sequelize.json('txIssue.confirmations'),
                    'txIssueConfirmations'],
                   [sequelize.json('txIssue.txId'), 'txIssueTxId'],
                   [sequelize.json('txIssue.txIndex'), 'txIssueTxIndex'],
                   [sequelize.json('txBurn.confirmations'),
                    'txBurnConfirmations'],
                   [sequelize.json('txBurn.txId'), 'txBurnTxId'],
                   [sequelize.json('txBurn.txIndex'), 'txBurnTxIndex'],
                   [sequelize.json('txTransferFrom.confirmations'),
                    'txTransferFromConfirmations'],
                   [sequelize.json('txTransferFrom.txId'),
                    'txTransferFromTxId'],
                   [sequelize.json('txTransferFrom.txIndex'),
                    'txTransferFromTxIndex'],
                   [sequelize.json('txTransferTo.confirmations'),
                    'txTransferToConfirmations'],
                   [sequelize.json('txTransferTo.txId'), 'txTransferToTxId'],
                   [sequelize.json('txTransferTo.txIndex'),
                    'txTransferToTxIndex']],
      include: [{ model: DerivedWalletsModel,
        as: 'derivedWallet', attributes: ['payment', 'invoice'], include: [{
          model: WalletsModel, as: 'wallet', attributes: ['payment', 'invoice']
        }]
      }],
      transaction
    });
  });

  if(tx === null) {
    await rs.status(404).json({});
  } else {
    await rs.status(200).json(tx.toJSON());
  }
};

async function postTransaction(rq: Request, rs: Response): Promise<void> {
  await sequelize.transaction(async transaction => {
    const wallet = (await WalletsModel.findOrCreate({
      attributes: ['id', 'payment'], where: {
        payment: rq.body.paymentTo, invoice: rq.body.invoiceTo
      }, include: [{ model: DerivedWalletsModel,
        as: 'derivedWallets', attributes: ['id', 'payment', 'invoice'], where: {
          payment: rq.body.paymentFrom
        }, required: false, separate: true, limit: 1
      }], transaction
    }))[0];

    let derivedWallet;

    if(typeof wallet.derivedWallets === 'undefined' ||
       wallet.derivedWallets.length === 0) {
      let invoiceFrom;

      switch(rq.body.paymentFrom) {
        case 'ethereum':
          invoiceFrom = EthereumHDKey.fromExtendedKey(appConfig.ethereumColdKey)
            .derivePath(`m/0/${wallet.id}`).getWallet().getAddressString();

          break;
        case 'bitshares':
          invoiceFrom = rq.body.invoiceTo;

          break;
        default:
          throw new UnknownPayment();
      }

      derivedWallet = await DerivedWalletsModel.create({
        walletId: wallet.id, payment: rq.body.paymentFrom, invoice: invoiceFrom
      }, { transaction });
    } else {
      derivedWallet = wallet.derivedWallets[0];
    }

    const tr = (await TransactionsModel.findOrCreate({
      attributes: ['id', 'jobId', 'status'], where: {
        walletId: derivedWallet.id, tickerFrom: rq.body.tickerFrom,
        tickerTo: rq.body.tickerTo, status: { [SequelizeOp.ne]: 'ok' }
      }, defaults: { amountFrom: rq.body.amountFrom },
      fields: ['jobId', 'walletId', 'tickerFrom', 'amountFrom', 'tickerTo'],
      transaction
    }))[0];

    const job = await queue.getJob(tr.jobId);

    if(job === null) {
      await queue.add(`payment:${derivedWallet.payment}:${wallet.payment}`,
                      {}, { jobId: tr.jobId, timeout: 1000 * 60 * 60 });
    } else if(await job.getState() === 'failed') {
      await job.retry();
    }

    await rs.status(200).json({ id: tr.id, invoiceFrom: derivedWallet.invoice,
                                status: tr.status });
  });
};

app.get('/v1/transactions/:id', getTransaction);
app.post('/v1/transactions', postTransaction);
