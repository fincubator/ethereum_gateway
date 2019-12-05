import { Sequelize } from 'sequelize';

/*
export const development = {
  dialect: 'sqlite', storage: 'db.sql',
  isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE,
  logQueryParameters: true
}, test = {
  dialect: 'sqlite', storage: ':memory:',
  isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
};
*/

export const development = {
  dialect: 'postgres', username: 'payment-gateway', password: 'payment-gateway',
  database: 'payment-gateway',
  isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE,
  logQueryParameters: true
}, test = {
  dialect: 'sqlite', storage: ':memory:',
  isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
};
