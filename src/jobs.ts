import type { Job } from 'bullmq';
import type { Transaction } from 'sequelize';

import { Orders, Txs, sequelize } from './models';
import { fetchBlockUntilTxFound, tryProcessTx, txTransferTo } from './web3';

export class OrderNotFound extends Error {}

export class TxNotFound extends Error {}

export async function paymentIn(job: Job, order: Orders): Promise<void> {
  const result = await fetchBlockUntilTxFound(job, order);

  if (!result) {
    throw new TxNotFound();
  }
}

export async function paymentOut(job: Job, order: Orders): Promise<void> {
  const tx = await txTransferTo(job, order);

  if (!tx) {
    throw new TxNotFound();
  }

  const result = await tryProcessTx(job, order, tx);

  if (!result) {
    throw new TxNotFound();
  }
}

export async function payment(job: Job): Promise<void> {
  const order = await sequelize.transaction(
    async (transaction: Transaction) => {
      const maybeOrder = await Orders.findOne({
        where: { jobId: job.id },
        include: [
          { model: Txs, as: 'inTx' },
          { model: Txs, as: 'outTx' },
        ],
        transaction,
      });

      if (maybeOrder === null) {
        throw new OrderNotFound();
      }

      return maybeOrder;
    }
  );

  switch (order.flow) {
    case 'IN':
      await paymentIn(job, order);

      break;
    case 'OUT':
      await paymentOut(job, order);

      break;
  }
}

export interface Jobs {
  [key: string]: (job: Job) => Promise<void>;
}

export const jobs: Jobs = { payment };
