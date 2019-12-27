import { Job } from 'bullmq';
import { Sequelize, Model, DataTypes, HasMany, BelongsTo,
         HasManyGetAssociationsMixin, HasManySetAssociationsMixin,
         HasManyAddAssociationsMixin, HasManyAddAssociationMixin,
         HasManyRemoveAssociationMixin, HasManyRemoveAssociationsMixin,
         HasManyCreateAssociationMixin, HasManyHasAssociationMixin,
         HasManyHasAssociationsMixin, HasManyCountAssociationsMixin,
         BelongsToGetAssociationMixin, BelongsToSetAssociationMixin,
         BelongsToCreateAssociationMixin } from 'sequelize';

import * as configs from './config/config.db';
import { toCamelCase } from './utils';

const env = process.env.NODE_ENV || 'development';
const config = configs[env];

export let sequelize: Sequelize;

if(config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password,
                            config);
}

export type Payment = 'ethereum' | 'bitshares';

export class Wallets extends Model {
  public id!: number;
  public payment?: Payment;
  public invoice?: any;
  public readonly derivedWallets?: DerivedWallets[];
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly version!: number;

  public static associations: {
    derivedWallets: HasMany<Wallets, DerivedWallets>
  };

  public getDerivedWallets!: HasManyGetAssociationsMixin<DerivedWallets>;
  public setDerivedWallets!: HasManySetAssociationsMixin<DerivedWallets, number>;
  public addDerivedWallets!: HasManyAddAssociationsMixin<DerivedWallets, number>;
  public addDerivedWallet!: HasManyAddAssociationMixin<DerivedWallets, number>;
  public removeDerivedWallet!: HasManyRemoveAssociationMixin<DerivedWallets, number>;
  public removeDerivedWallets!: HasManyRemoveAssociationsMixin<DerivedWallets, number>;
  public createDerivedWallets!: HasManyCreateAssociationMixin<DerivedWallets>;
  public hasDerivedWallet!: HasManyHasAssociationMixin<DerivedWallets, number>;
  public hasDerivedWallets!: HasManyHasAssociationsMixin<DerivedWallets, number>;
  public countDerivedWallets!: HasManyCountAssociationsMixin;

}

export class DerivedWallets extends Model {
  public id!: number;
  public payment?: Payment;
  public invoice?: any;
  public walletId!: number;
  public readonly wallet?: Wallets;
  public readonly transactions?: Transactions[];
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly version!: number;

  public static associations: {
    wallet: BelongsTo<DerivedWallets, Wallets>;
    transactions: HasMany<DerivedWallets, Transactions>;
  };

  public getWallet!: BelongsToGetAssociationMixin<Wallets>;
  public setWallet!: BelongsToSetAssociationMixin<Wallets, number>;
  public createWallet!: BelongsToCreateAssociationMixin<Wallets>;

  public getTransactions!: HasManyGetAssociationsMixin<Transactions>;
  public setTransactions!: HasManySetAssociationsMixin<Transactions, number>;
  public addTransactions!: HasManyAddAssociationsMixin<Transactions, number>;
  public addTransaction!: HasManyAddAssociationMixin<Transactions, number>;
  public removeTransaction!: HasManyRemoveAssociationMixin<Transactions, number>;
  public removeTransactions!: HasManyRemoveAssociationsMixin<Transactions, number>;
  public createTransactions!: HasManyCreateAssociationMixin<Transactions>;
  public hasTransaction!: HasManyHasAssociationMixin<Transactions, number>;
  public hasTransactions!: HasManyHasAssociationsMixin<Transactions, number>;
  public countTransactions!: HasManyCountAssociationsMixin;
}

export type Ticker = 'USDT' | 'FINTEH.USDT';

export type StatusInitial = 'pending' | 'receive_ok' | 'issue_commit_ok' |
                            'issue_ok' | 'burn_commit_ok' | 'burn_ok' |
                            'transfer_from_commit_ok' | 'transfer_from_ok' |
                            'transfer_to_commit_ok' | 'transfer_to_ok';

export type TransactionsStatus =
  'pending' | 'receive_pending' | 'receive_ok' | 'receive_err' |
  'issue_commit_ok' | 'issue_commit_err' | 'issue_pending' | 'issue_ok' |
  'issue_err' | 'burn_commit_ok' | 'burn_commit_err' | 'burn_pending' |
  'burn_ok' | 'burn_err' | 'transfer_from_commit_ok' |
  'transfer_from_commit_err' | 'transfer_from_pending' | 'transfer_from_ok' |
  'transfer_from_err' | 'transfer_to_commit_ok' | 'transfer_to_commit_err' |
  'transfer_to_pending' | 'transfer_to_ok' | 'transfer_to_err' | 'ok';

export class Transactions extends Model {
  public id!: number;
  public jobId!: string;
  tickerFrom!: Ticker;
  amountFrom?: string;
  tickerTo!: Ticker;
  amountTo?: string;
  status!: TransactionsStatus;
  txReceive?: any;
  txReceiveCreatedAt?: Date;
  txIssue?: any;
  txIssueCreatedAt?: Date;
  txBurn?: any;
  txBurnCreatedAt?: Date;
  txTransferFrom?: any;
  txTransferFromCreatedAt?: Date;
  txTransferTo?: any;
  txTransferToCreatedAt?: Date;
  public walletId!: number;
  public readonly derivedWallet?: DerivedWallets;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly version!: number;

  public static associations: {
    derivedWallet: BelongsTo<Transactions, DerivedWallets>;
  };

  public getDerivedWallet!: BelongsToGetAssociationMixin<DerivedWallets>;
  public setDerivedWallet!: BelongsToSetAssociationMixin<DerivedWallets, number>;
  public createDerivedWallet!: BelongsToCreateAssociationMixin<DerivedWallets>;
}

export type Task<T> = () => Promise<T>;

export type TransactionsCommitPrefix = 'receive' | 'issue' | 'burn' |
                                       'transfer_from' |  'transfer_to';

export type TransactionsStatusPostfix = '' | 'commit';

export async function transactionsCatchAndCommitError<T>(
  job: Job, model: Transactions, task: Task<T>,
  commitPrefix: TransactionsCommitPrefix,
  statusPostfix: TransactionsStatusPostfix = ''
): Promise<T> {
  try {
    return await task();
  } catch(error) {
    if(statusPostfix.length > 0) {
      statusPostfix += '_';
    }

    statusPostfix += 'err';

    const ccCommitPrefix = toCamelCase(commitPrefix);
    const status = `${commitPrefix}_${statusPostfix}` as TransactionsStatus;

    const txPrefix = 'tx' + (ccCommitPrefix.charAt(0).toUpperCase() ?? '')
                   + ccCommitPrefix.substring(1);

    await sequelize.transaction(async transaction => {
      model.status = status;

      const txCommited = model[txPrefix] ?? {};

      if(error instanceof Error) {
        txCommited.last_error = { name: error.name, message: error.message,
                                  stacktrace: error.stack };
      } else {
        txCommited.last_error = error;
      }

      model[txPrefix] = txCommited;

      await model.save({ transaction });
    });

    throw error;
  }
};

Wallets.init({
  id: { type: DataTypes.BIGINT, primaryKey: true, allowNull: false,
        autoIncrement: true, autoIncrementIdentity: true },
  payment: { type: DataTypes.ENUM('ethereum', 'bitshares'),
             allowNull: false  },
  invoice: { type: DataTypes.JSONB, allowNull: false }
}, { sequelize, timestamps: true, paranoid: true, version: true,
     initialAutoIncrement: true });

DerivedWallets.init({
  id: { type: DataTypes.BIGINT, primaryKey: true, allowNull: false,
        autoIncrement: true, autoIncrementIdentity: true },
  payment: { type: DataTypes.ENUM('ethereum', 'bitshares'),
             allowNull: false },
  invoice: { type: DataTypes.JSONB, allowNull: false }
}, { sequelize, timestamps: true, paranoid: true, version: true,
     initialAutoIncrement: true });

Transactions.init({
  id: { type: DataTypes.BIGINT, primaryKey: true, allowNull: false,
        autoIncrement: true, autoIncrementIdentity: true },
  jobId: { type: DataTypes.UUID, unique: true, allowNull: false,
           defaultValue: DataTypes.UUIDV4 },
  tickerFrom: { type: DataTypes.ENUM('USDT', 'FINTEH.USDT'), allowNull: false },
  amountFrom: DataTypes.DECIMAL(40, 20).UNSIGNED,
  tickerTo: { type: DataTypes.ENUM('USDT', 'FINTEH.USDT'), allowNull: false },
  amountTo: DataTypes.DECIMAL(40, 20).UNSIGNED,
  status: { type: DataTypes.ENUM('pending', 'receive_pending', 'receive_ok',
                                 'receive_err', 'issue_commit_ok',
                                 'issue_commit_err', 'issue_pending',
                                 'issue_ok', 'issue_err', 'burn_commit_ok',
                                 'burn_commit_err', 'burn_pending', 'burn_ok',
                                 'burn_err', 'transfer_from_commit_ok',
                                 'transfer_from_commit_err',
                                 'transfer_from_pending', 'transfer_from_ok',
                                 'transfer_from_err', 'transfer_to_commit_ok',
                                 'transfer_to_commit_err',
                                 'transfer_to_pending', 'transfer_to_ok',
                                 'transfer_to_err', 'ok'),
            allowNull: false, defaultValue: 'pending' },
  txReceive: DataTypes.JSONB,
  txReceiveCreatedAt: DataTypes.DATE,
  txIssue: DataTypes.JSONB,
  txIssueCreatedAt: DataTypes.DATE,
  txBurn: DataTypes.JSONB,
  txBurnCreatedAt: DataTypes.DATE,
  txTransferFrom: DataTypes.JSONB,
  txTransferFromCreatedAt: DataTypes.DATE,
  txTransferTo: DataTypes.JSONB,
  txTransferToCreatedAt: DataTypes.DATE
}, { sequelize, timestamps: true, paranoid: true, version: true,
     initialAutoIncrement: true });

Wallets.hasMany(DerivedWallets, { as: 'derivedWallets',
                                  foreignKey: 'walletId' });
DerivedWallets.belongsTo(Wallets, { as: 'wallet', foreignKey: 'walletId' });
DerivedWallets.hasMany(Transactions, { as: 'transactions',
                                       foreignKey: 'walletId' });
Transactions.belongsTo(DerivedWallets, { as: 'derivedWallet',
                                         foreignKey: 'walletId' });
