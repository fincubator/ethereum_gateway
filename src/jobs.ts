import type { Job } from 'bullmq';
import type { Transaction } from 'sequelize';

import { Orders, Txs, sequelize } from './models';
import { fetchBlockUntilTxFound, processTx, txTransferTo } from './web3';

export class OrderNotFound extends Error {}

export class TxNotFound extends Error {}

export async function paymentIn(job: Job): Promise<void> {
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

  const result = await fetchBlockUntilTxFound(job, order, 'in');

  if (!result) {
    throw new TxNotFound();
  }
}

export async function paymentOut(job: Job): Promise<void> {
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

  const tx = await txTransferTo(job, order);

  if (!tx) {
    throw new TxNotFound();
  }

  const result = await processTx(job, order, 'out', tx);

  if (!result) {
    throw new TxNotFound();
  }
}

export interface Jobs {
  [key: string]: (job: Job) => Promise<void>;
}

export const jobs: Jobs = {
  'payment:in': paymentIn,
  'payment:out': paymentOut,
};
