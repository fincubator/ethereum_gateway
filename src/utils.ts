import { Job } from 'bullmq';

export function toCamelCase(snakeCase: string): string {
  return snakeCase.replace(/_[a-z]/gi, (snakeCaseTmp: string) => {
    return snakeCaseTmp.toUpperCase().replace('_', '');
  });
}

export function* range(
  start: number,
  stop: number,
  step = 1
): Generator<number, void, void> {
  for (
    let current = start;
    step > 0 ? current < stop : step < 0 ? current > stop : true;
    current += step
  ) {
    yield current;
  }
}

export interface TaskStatus {
  resolved(): boolean;
}

export interface TaskHandler {
  (status: TaskStatus): Promise<boolean>;
}

export interface Task {
  handler: TaskHandler;
  skip: boolean;
}

export async function resolveAny(job: Job, tasks: Task[]): Promise<boolean> {
  const state = { resolved: false };
  const requiredRejects = tasks.reduce((acc: number, task: Task) => {
    if (!task.skip) {
      return acc + 1;
    }

    return acc;
  }, 0);

  return new Promise((resolve, reject) => {
    let rejectedNumber = 1;

    for (const task of tasks) {
      task
        .handler({
          resolved: () => {
            return state.resolved;
          },
        })
        .then(
          (result: boolean) => {
            if (!state.resolved && (!task.skip || result)) {
              state.resolved = true;
              resolve(result);
            }
          },
          (error) => {
            if (rejectedNumber < requiredRejects) {
              console.error(`Some task in job ${job.id} failed with:`, error);

              if (!task.skip) {
                rejectedNumber += 1;
              }
            } else if (!state.resolved) {
              if (!task.skip) {
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
