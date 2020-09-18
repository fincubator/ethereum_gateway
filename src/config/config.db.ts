import { Transaction } from 'sequelize';

export const production = {
  dialect: 'postgres',
  host: process.env.DB_HOST ?? 'payment-gateway',
  username: process.env.DB_USERNAME ?? 'payment-gateway',
  password: process.env.DB_PASSWORD ?? 'payment-gateway',
  database: process.env.DB_DATABASE ?? 'payment-gateway',
  isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
};

export const development = {
  dialect: 'postgres',
  host: process.env.DB_HOST ?? 'payment-gateway',
  username: process.env.DB_USERNAME ?? 'payment-gateway',
  password: process.env.DB_PASSWORD ?? 'payment-gateway',
  database: process.env.DB_DATABASE ?? 'payment-gateway',
  isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
  logQueryParameters: true,
};

export const test = {
  dialect: 'sqlite',
  storage: ':memory:',
  isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
};
