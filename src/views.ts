import EthereumHDKey from 'ethereumjs-wallet/hdkey';
import { Application, Request, Response } from 'express';
import { Sequelize, Op as SequelizeOp } from 'sequelize';

import { app, appConfig } from './app';
import {
  DerivedWallets as DerivedWalletsModel,
  Transactions as TransactionsModel,
  Wallets as WalletsModel,
  sequelize,
} from './models';
import { queue } from './queue';

class UnknownPayment extends Error {}

async function getTransaction(rq: Request, rs: Response): Promise<void> {
  const tr = await sequelize.transaction(async (transaction) => {
    return TransactionsModel.findByPk(rq.params.id, {
      attributes: [
        'tickerFrom',
        'amountFrom',
        'amountTo',
        'status',
        [Sequelize.json('txReceive.confirmations'), 'txReceiveConfirmations'],
        [Sequelize.json('txReceive.txId'), 'txReceiveTxId'],
        [Sequelize.json('txReceive.txIndex'), 'txReceiveTxIndex'],
        [Sequelize.json('txIssue.confirmations'), 'txIssueConfirmations'],
        [Sequelize.json('txIssue.txId'), 'txIssueTxId'],
        [Sequelize.json('txIssue.txIndex'), 'txIssueTxIndex'],
        [Sequelize.json('txBurn.confirmations'), 'txBurnConfirmations'],
        [Sequelize.json('txBurn.txId'), 'txBurnTxId'],
        [Sequelize.json('txBurn.txIndex'), 'txBurnTxIndex'],
        [
          Sequelize.json('txTransferFrom.confirmations'),
          'txTransferFromConfirmations',
        ],
        [Sequelize.json('txTransferFrom.txId'), 'txTransferFromTxId'],
        [Sequelize.json('txTransferFrom.txIndex'), 'txTransferFromTxIndex'],
        [
          Sequelize.json('txTransferTo.confirmations'),
          'txTransferToConfirmations',
        ],
        [Sequelize.json('txTransferTo.txId'), 'txTransferToTxId'],
        [Sequelize.json('txTransferTo.txIndex'), 'txTransferToTxIndex'],
      ],
      include: [
        {
          model: DerivedWalletsModel,
          as: 'derivedWallet',
          attributes: ['payment', 'invoice'],
          include: [
            {
              model: WalletsModel,
              as: 'wallet',
              attributes: ['payment', 'invoice'],
            },
          ],
        },
      ],
      transaction,
    });
  });

  if (tr === null) {
    await rs.status(404).json({});
  } else {
    await rs.status(200).json(tr.toJSON());
  }
}

async function postTransaction(rq: Request, rs: Response): Promise<void> {
  await sequelize.transaction(async (transaction) => {
    const wallet = (
      await WalletsModel.findOrCreate({
        attributes: ['id', 'payment'],
        where: {
          payment: rq.body.paymentTo,
          invoice: rq.body.invoiceTo,
        },
        include: [
          {
            model: DerivedWalletsModel,
            as: 'derivedWallets',
            attributes: ['id', 'payment', 'invoice'],
            where: {
              payment: rq.body.paymentFrom,
            },
            required: false,
            separate: true,
            limit: 1,
          },
        ],
        transaction,
      })
    )[0];

    let derivedWallet;

    if (
      typeof wallet.derivedWallets === 'undefined' ||
      wallet.derivedWallets.length === 0
    ) {
      let invoiceFrom;

      switch (rq.body.paymentFrom) {
        case 'ethereum':
          invoiceFrom = EthereumHDKey.fromExtendedKey(appConfig.ethereumColdKey)
            .derivePath(`m/0/${wallet.id}`)
            .getWallet()
            .getAddressString();

          break;
        case 'bitshares':
          invoiceFrom = rq.body.invoiceTo;

          break;
        default:
          throw new UnknownPayment();
      }

      derivedWallet = await DerivedWalletsModel.create(
        {
          walletId: wallet.id,
          payment: rq.body.paymentFrom,
          invoice: invoiceFrom,
        },
        { transaction }
      );
    } else {
      derivedWallet = wallet.derivedWallets[0];
    }

    const tr = (
      await TransactionsModel.findOrCreate({
        attributes: ['id', 'jobId', 'status'],
        where: {
          walletId: derivedWallet.id,
          tickerFrom: rq.body.tickerFrom,
          tickerTo: rq.body.tickerTo,
          status: { [SequelizeOp.ne]: 'ok' },
        },
        defaults: { amountFrom: rq.body.amountFrom },
        fields: ['jobId', 'walletId', 'tickerFrom', 'amountFrom', 'tickerTo'],
        transaction,
      })
    )[0];

    const job = (await queue.getJob(tr.jobId)) ?? null;

    if (job === null) {
      await queue.add(
        `payment:${derivedWallet.payment}:${wallet.payment}`,
        {},
        { jobId: tr.jobId, timeout: 1000 * 60 * 60 }
      );
    } else if ((await job.getState()) === 'failed') {
      await job.retry();
    }

    await rs.status(200).json({
      id: tr.id,
      invoiceFrom: derivedWallet.invoice,
      status: tr.status,
    });
  });
}

app.get('/v1/transactions/:id', getTransaction);
app.post('/v1/transactions', postTransaction);
