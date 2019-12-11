import EthereumHDKey from 'ethereumjs-wallet/hdkey';

import { appConfig } from '../app';
import models, { Sequelize, sequelize } from '../models';
import { queue } from '../jobs';

class UnknownPayment extends Error {};

const get_transaction = async (rq, rs) => {
  const tx = await sequelize.transaction(async transaction => {
    return await models.Transactions.findByPk(rq.params.id, {
      attributes: ['tickerFrom', 'amountFrom', 'tickerTo', 'amountTo',
                   'status'], include: [{ model: models.DerivedWallets,
        attributes: ['payment', 'invoice'], include: [{ model: models.Wallets,
          attributes: ['payment', 'invoice']
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

const post_transaction = async (rq, rs) => {
  await sequelize.transaction(async transaction => {
    const wallet = (await models.Wallets.findOrCreate({
      attributes: ['id', 'payment'], where: {
        payment: rq.body.paymentTo, invoice: rq.body.invoiceTo
      }, include: [{ model: models.DerivedWallets,
        attributes: ['id', 'payment', 'invoice'], where: {
          payment: rq.body.paymentFrom
        }, required: false, separate: true, limit: 1
      }], transaction
    }))[0];

    let derivedWallet;

    if(typeof wallet.DerivedWallets === 'undefined' ||
       wallet.DerivedWallets.length === 0) {
      let invoiceFrom;

      if(rq.body.paymentFrom === 'ethereum') {
        invoiceFrom = EthereumHDKey.fromExtendedKey(appConfig.rootKey)
          .derivePath(`m/0/${wallet.id}`).getWallet().getAddressString();
      } else {
        throw new UnknownPayment();
      }

      derivedWallet = await models.DerivedWallets.create({
        walletFrom: wallet.id, payment: rq.body.paymentFrom,
        invoice: invoiceFrom
      }, { transaction });
    } else {
      derivedWallet = wallet.DerivedWallets[0];
    }

    const tr = (await models.Transactions.findOrCreate({
      attributes: ['id', 'status'], where: {
        walletId: derivedWallet.id, tickerFrom: rq.body.tickerFrom,
        tickerTo: rq.body.tickerTo, status: { [Sequelize.Op.ne]: 'ok' }
      }, defaults: { amountFrom: rq.body.amountFrom },
      fields: ['walletId', 'tickerFrom', 'amountFrom', 'tickerTo'],
      transaction
    }))[0];

    const job = await queue.getJob(tr.id);

    if(job === null) {
      await queue.add(`payment:${derivedWallet.payment}:${wallet.payment}`,
                      {}, { jobId: tr.id, timeout: 1000 * 60 * 60 });
    } else if(await job.getState() === 'failed') {
      await job.retry();
    }

    await rs.status(200).json({ id: tr.id, invoiceFrom: derivedWallet.invoice,
                                status: tr.status });
  });
};

export default app => {
  app.get('/transactions/:id', get_transaction);
  app.post('/transactions', post_transaction);
};
