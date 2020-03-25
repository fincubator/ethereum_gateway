import { Job } from 'bullmq';

import {
  sequelize,
  Transactions as TransactionsModel,
  TransactionsStatus as TransactionsModelStatus,
} from './models';

export function toCamelCase(string: string) {
  return string.replace(/_[a-z]/gi, (string) => {
    return string.toUpperCase().replace('_', '');
  });
}

export function* range(start: number, stop: number, step = 1) {
  for (
    let current = start;
    step > 0 ? current < stop : step < 0 ? current > stop : true;
    current += step
  ) {
    yield current;
  }
}

export type TaskResolved = () => boolean;

export type TaskWithState = (isResolved: TaskResolved) => Promise<boolean>;

export interface TaskDecl {
  task: TaskWithState;
  skip: boolean;
}

export async function resolveAny(
  job: Job,
  tasks: TaskDecl[]
): Promise<boolean> {
  const state = { resolved: false };
  const requiredRejects = tasks.reduce((acc, task) => {
    if (!task.skip) {
      acc++;
    }

    return acc;
  }, 0);
  let rejectedNumber = 0;

  return new Promise((resolve, reject) => {
    for (const taskDecl of tasks) {
      taskDecl
        .task(() => {
          return state.resolved;
        })
        .then(
          (result) => {
            if (!state.resolved && (!taskDecl.skip || result)) {
              state.resolved = true;
              resolve(result);
            }
          },
          (error) => {
            if (rejectedNumber < requiredRejects - 1) {
              console.error(`Some task in job ${job.id} failed with:`, error);

              if (!taskDecl.skip) {
                rejectedNumber++;
              }
            }
            if (!state.resolved) {
              if (!taskDecl.skip) {
                state.resolved = true;
                reject(error);
              } else {
                console.error(`Some task in job ${job.id} failed with:`, error);
              }
            }
          }
        );
    }
  });
}
