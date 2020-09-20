import { hdkey } from 'ethereumjs-wallet';
import { Client as WebSocketClient } from 'rpc-websockets';
import type { Transaction } from 'sequelize';

import { app, appConfig } from './app';
import { DerivedWallets, Orders, Txs, Wallets, sequelize } from './models';
import queue from './queue';

const bookerProvider = new WebSocketClient(appConfig.bookerProvider);

export async function getDepositAddress(args: any): Promise<any> {
  console.log(args);

  const outTxTo = await sequelize.transaction(
    async (transaction: Transaction) => {
      const wallet = (
        await Wallets.findOrCreate({
          attributes: ['id', 'payment'],
          where: { payment: 'ethereum', invoice: args.user },
          include: [
            {
              model: DerivedWallets,
              as: 'derivedWallets',
              attributes: ['id'],
              where: { payment: 'bitshares' },
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
        const inTxAddressTo = hdkey
          .fromExtendedKey(appConfig.ethereumColdKey)
          .derivePath(`m/0/${wallet.id}`)
          .getWallet()
          .getAddressString();

        derivedWallet = await DerivedWallets.create(
          {
            walletId: wallet.id,
            payment: 'ethereum',
            invoice: inTxAddressTo,
          },
          { transaction }
        );
      } else {
        [derivedWallet] = wallet.derivedWallets;
      }

      return derivedWallet.invoice;
    }
  );

  return { user: args.user, deposit_address: outTxTo };
}

export async function getDepositAddressHTTP(
  rq: Request,
  rs: Response
): Promise<void> {
  await rs.status(200).json(await getDepositAddress(rq.body));
}

export async function newInTx(args: any): Promise<any> {
  const order = await sequelize.transaction(
    async (transaction: Transaction) => {
      const walletId = DerivedWallets.findOne({
        attributes: ['id'],
        where: { payment: 'ethereum', invoice: args.outTxTto },
        transaction,
      });

      return Orders.create(
        {
          id: args.order_id,
          type: args.order_type,
          inTx: {
            coin: args.in_tx.coin,
            fromAddress: args.in_tx.from_address,
            toAddress: args.in_tx.to_address,
            amount: args.in_tx.amount,
            txCreatedAt: args.in_tx.created_at,
            txId: args.in_tx.tx_id,
            confirmations: args.in_tx.confirmations,
            maxConfirmations: args.in_tx.max_confirmations,
          },
          outTx: {
            coin: args.out_tx.coin,
            fromAddress: args.out_tx.from_address,
            toAddress: args.out_tx.to_address,
            amount: args.out_tx.amount,
            txCreatedAt: args.out_tx.created_at,
            txId: args.out_tx.tx_id,
            confirmations: args.out_tx.confirmations,
            maxConfirmations: args.out_tx.max_confirmations,
          },
        },
        {
          include: [
            { model: Txs, as: 'inTx' },
            { model: Txs, as: 'outTx' },
          ],
          transaction,
        }
      );
    }
  );

  const job = (await queue.getJob(order.jobId)) ?? null;

  if (job === null) {
    await queue.add(
      `payment:in`,
      {},
      { jobId: order.jobId, timeout: 1000 * 60 * 60 }
    );
  } else if ((await job.getState()) === 'failed') {
    await job.retry();
  }
}

export async function validateAddress(args: any): Promise<any> {
  args.is_valid = true;

  return args;
}

app.post('/v1/get_deposit_address', getDepositAddressHTTP);
