import { Job } from 'bullmq';
import type {
  BelongsTo,
  BelongsToCreateAssociationMixin,
  BelongsToGetAssociationMixin,
  BelongsToSetAssociationMixin,
  HasMany,
  HasManyAddAssociationMixin,
  HasManyAddAssociationsMixin,
  HasManyCountAssociationsMixin,
  HasManyCreateAssociationMixin,
  HasManyGetAssociationsMixin,
  HasManyHasAssociationMixin,
  HasManyHasAssociationsMixin,
  HasManyRemoveAssociationMixin,
  HasManyRemoveAssociationsMixin,
  HasManySetAssociationsMixin,
} from 'sequelize';
import { DataTypes, Model, Sequelize, Transaction } from 'sequelize';

import * as configs from './config/config.db';

const env = process.env.NODE_ENV ?? 'development';
const config = configs[env];

export let sequelize: Sequelize;

if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    config
  );
}

export type Payment = 'ethereum' | 'bitshares';

export class Wallets extends Model {
  public id!: number;

  public payment?: Payment;

  public invoice?: string;

  public readonly derivedWallets?: DerivedWallets[];

  public readonly createdAt!: Date;

  public readonly updatedAt!: Date;

  public readonly version!: number;

  public static associations: {
    derivedWallets: HasMany<Wallets, DerivedWallets>;
  };

  public getDerivedWallets!: HasManyGetAssociationsMixin<DerivedWallets>;

  public setDerivedWallets!: HasManySetAssociationsMixin<
    DerivedWallets,
    number
  >;

  public addDerivedWallets!: HasManyAddAssociationsMixin<
    DerivedWallets,
    number
  >;

  public addDerivedWallet!: HasManyAddAssociationMixin<DerivedWallets, number>;

  public removeDerivedWallet!: HasManyRemoveAssociationMixin<
    DerivedWallets,
    number
  >;

  public removeDerivedWallets!: HasManyRemoveAssociationsMixin<
    DerivedWallets,
    number
  >;

  public createDerivedWallets!: HasManyCreateAssociationMixin<DerivedWallets>;

  public hasDerivedWallet!: HasManyHasAssociationMixin<DerivedWallets, number>;

  public hasDerivedWallets!: HasManyHasAssociationsMixin<
    DerivedWallets,
    number
  >;

  public countDerivedWallets!: HasManyCountAssociationsMixin;
}

export class DerivedWallets extends Model {
  public id!: number;

  public payment?: Payment;

  public invoice?: string;

  public walletId!: number;

  public readonly wallet?: Wallets;

  public readonly orders?: Orders[];

  public readonly createdAt!: Date;

  public readonly updatedAt!: Date;

  public readonly version!: number;

  public static associations: {
    wallet: BelongsTo<DerivedWallets, Wallets>;
    orders: HasMany<DerivedWallets, Orders>;
  };

  public getWallet!: BelongsToGetAssociationMixin<Wallets>;

  public setWallet!: BelongsToSetAssociationMixin<Wallets, number>;

  public createWallet!: BelongsToCreateAssociationMixin<Wallets>;

  public getOrders!: HasManyGetAssociationsMixin<Orders>;

  public setOrders!: HasManySetAssociationsMixin<Orders, string>;

  public addOrders!: HasManyAddAssociationsMixin<Orders, string>;

  public addOrder!: HasManyAddAssociationMixin<Orders, string>;

  public removeOrders!: HasManyRemoveAssociationsMixin<Orders, string>;

  public removeOrder!: HasManyRemoveAssociationMixin<Orders, string>;

  public createOrder!: HasManyCreateAssociationMixin<Orders>;

  public hasOrders!: HasManyHasAssociationsMixin<Orders, string>;

  public hasOrder!: HasManyHasAssociationMixin<Orders, string>;

  public countOrders!: HasManyCountAssociationsMixin;
}

export type Coin = 'USDT' | 'FINTEH.USDT';

export type TxError =
  | 'NO_ERROR'
  | 'UNKNOWN_ERROR'
  | 'BAD_ASSET'
  | 'LESS_MIN'
  | 'GREATER_MAX'
  | 'NO_MEMO'
  | 'FLOOD_MEMO'
  | 'OP_COLLISION'
  | 'TX_HASH_NOT_FOUND';

export interface TxRaw {
  [key: string]: any;
}

export class Txs extends Model {
  public id!: string;

  public coin!: Coin;

  public txId?: string;

  public fromAddress?: string;

  public toAddress?: string;

  public amount!: string;

  public txCreatedAt!: Date;

  public error!: TxError;

  public confirmations!: number;

  public maxConfirmations!: number;

  public tx?: TxRaw;

  public readonly createdAt!: Date;

  public readonly updatedAt!: Date;

  public readonly version!: number;
}

export type OrderType = 'TRASH' | 'DEPOSIT' | 'WITHDRAWAL';

export type OrderParty = 'INIT' | 'IN_CREATED' | 'OUT_CREATED';

export class Orders extends Model {
  public id!: string;

  public jobId!: string;

  public walletId!: number;

  public readonly derivedWallet?: DerivedWallets;

  public type!: OrderType;

  public party!: OrderParty;

  public inTxId!: string;

  public readonly inTx?: Txs;

  public outTxId!: string;

  public readonly outTx?: Txs;

  public readonly createdAt!: Date;

  public readonly updatedAt!: Date;

  public readonly version!: number;

  public static associations: {
    derivedWallet: BelongsTo<Orders, DerivedWallets>;
    inTx: BelongsTo<Orders, Txs>;
    outTx: BelongsTo<Orders, Txs>;
  };

  public getDerivedWallet!: BelongsToGetAssociationMixin<DerivedWallets>;

  public setDerivedWallet!: BelongsToSetAssociationMixin<
    DerivedWallets,
    number
  >;

  public createDerivedWallet!: BelongsToCreateAssociationMixin<DerivedWallets>;

  public getInTx!: BelongsToGetAssociationMixin<Txs>;

  public setInTx!: BelongsToSetAssociationMixin<Txs, string>;

  public createInTx!: BelongsToCreateAssociationMixin<Txs>;

  public getOutTx!: BelongsToGetAssociationMixin<Txs>;

  public setOutTx!: BelongsToSetAssociationMixin<Txs, string>;

  public createOutTx!: BelongsToCreateAssociationMixin<Txs>;
}

export interface Task<T> {
  (): Promise<T>;
}

Wallets.init(
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      allowNull: false,
      autoIncrement: true,
      autoIncrementIdentity: true,
    },
    payment: {
      type: DataTypes.ENUM('ethereum', 'bitshares'),
      allowNull: false,
    },
    invoice: { type: DataTypes.STRING, allowNull: false },
  },
  {
    sequelize,
    timestamps: true,
    paranoid: true,
    version: true,
    initialAutoIncrement: true,
  }
);

DerivedWallets.init(
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      allowNull: false,
      autoIncrement: true,
      autoIncrementIdentity: true,
    },
    payment: {
      type: DataTypes.ENUM('ethereum', 'bitshares'),
      allowNull: false,
    },
    invoice: { type: DataTypes.STRING, allowNull: false },
  },
  {
    sequelize,
    timestamps: true,
    paranoid: true,
    version: true,
    initialAutoIncrement: true,
  }
);

Txs.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
    },
    coin: {
      type: DataTypes.ENUM('USDT', 'FINTEH.USDT'),
      allowNull: false,
    },
    txId: DataTypes.STRING,
    fromAddress: DataTypes.STRING,
    toAddress: DataTypes.STRING,
    amount: DataTypes.DECIMAL(78, 36).UNSIGNED,
    txCreatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
    confirmations: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },
    maxConfirmations: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },
    tx: { type: DataTypes.JSONB, allowNull: true },
  },
  {
    sequelize,
    timestamps: true,
    paranoid: true,
    version: true,
    initialAutoIncrement: true,
  }
);

Orders.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
    },
    jobId: {
      type: DataTypes.UUID,
      unique: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
    },
    type: {
      type: DataTypes.ENUM('TRASH', 'DEPOSIT', 'WITHDRAWAL'),
      allowNull: false,
    },
  },
  {
    sequelize,
    timestamps: true,
    paranoid: true,
    version: true,
    initialAutoIncrement: true,
  }
);

Wallets.hasMany(DerivedWallets, {
  as: 'derivedWallets',
  foreignKey: 'walletId',
});

DerivedWallets.belongsTo(Wallets, { as: 'wallet', foreignKey: 'walletId' });

DerivedWallets.hasMany(Orders, {
  as: 'transactions',
  foreignKey: 'walletId',
});

Orders.belongsTo(DerivedWallets, {
  as: 'derivedWallet',
  foreignKey: 'walletId',
});

Orders.belongsTo(Txs, {
  as: 'inTx',
  foreignKey: 'inTxId',
});

Orders.belongsTo(Txs, {
  as: 'outTx',
  foreignKey: 'outTxId',
});
