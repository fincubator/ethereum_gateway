import type { QueryInterface, Transaction } from 'sequelize';
import { DataTypes, Op } from 'sequelize';

async function up(
  queryInterface: QueryInterface,
  _DataTypes: any
): Promise<void> {
  await queryInterface.sequelize.transaction(
    async (transaction: Transaction) => {
      await queryInterface.createTable(
        'Wallets',
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
          createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
          },
          updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
          },
          deletedAt: DataTypes.DATE,
          version: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
          },
        },
        { transaction }
      );
      await queryInterface.addConstraint('Wallets', {
        type: 'unique',
        fields: ['payment', 'invoice'],
        transaction,
      });
      await queryInterface.createTable(
        'DerivedWallets',
        {
          id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            allowNull: false,
            autoIncrement: true,
            autoIncrementIdentity: true,
          },
          walletId: {
            type: DataTypes.BIGINT,
            allowNull: false,
            references: { model: 'Wallets', key: 'id' },
            onUpdate: 'cascade',
            onDelete: 'cascade',
          },
          payment: {
            type: DataTypes.ENUM('ethereum', 'bitshares'),
            allowNull: false,
          },
          invoice: { type: DataTypes.STRING, allowNull: false },
          createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
          },
          updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
          },
          deletedAt: DataTypes.DATE,
          version: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
          },
        },
        { transaction }
      );
      await queryInterface.addConstraint('DerivedWallets', {
        transaction,
        type: 'unique',
        fields: ['walletId', 'payment'],
      });
      await queryInterface.addConstraint('DerivedWallets', {
        type: 'unique',
        fields: ['payment', 'invoice'],
        transaction,
      });
      await queryInterface.createTable(
        'Txs',
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
          error: {
            type: DataTypes.ENUM(
              'NO_ERROR',
              'UNKNOWN_ERROR',
              'BAD_ASSET',
              'LESS_MIN',
              'GREATER_MAX',
              'NO_MEMO',
              'FLOOD_MEMO',
              'OP_COLLISION',
              'TX_HASH_NOT_FOUND'
            ),
            allowNull: false,
            defaultValue: 'NO_ERROR',
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
          createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
          },
          updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
          },
          deletedAt: DataTypes.DATE,
          version: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
          },
        },
        { transaction }
      );
      await queryInterface.addConstraint('Txs', {
        type: 'unique',
        fields: ['coin', 'txId'],
        transaction,
      });
      await queryInterface.addConstraint('Txs', {
        type: 'check',
        fields: ['amount', 'confirmations', 'maxConfirmations'],
        where: {
          amount: { [Op.gte]: 0 },
          confirmations: { [Op.gte]: 0 },
          maxConfirmations: { [Op.gte]: 0 },
        },
        transaction,
      });
      await queryInterface.createTable(
        'Orders',
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
          walletId: {
            type: DataTypes.BIGINT,
            allowNull: false,
            references: { model: 'DerivedWallets', key: 'id' },
            onUpdate: 'cascade',
            onDelete: 'cascade',
          },
          type: {
            type: DataTypes.ENUM('TRASH', 'DEPOSIT', 'WITHDRAWAL'),
            allowNull: false,
            defaultValue: 'TRASH',
          },
          inTxId: {
            type: DataTypes.UUID,
            unique: true,
            allowNull: false,
            references: { model: 'Txs', key: 'id' },
            onUpdate: 'cascade',
            onDelete: 'cascade',
          },
          outTxId: {
            type: DataTypes.UUID,
            unique: true,
            allowNull: false,
            references: { model: 'Txs', key: 'id' },
            onUpdate: 'cascade',
            onDelete: 'cascade',
          },
          createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
          },
          updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
          },
          deletedAt: DataTypes.DATE,
          version: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
          },
        },
        { transaction }
      );
    }
  );
}

async function down(
  queryInterface: QueryInterface,
  _DataTypes: any
): Promise<void> {
  await queryInterface.sequelize.transaction(
    async (transaction: Transaction) => {
      await queryInterface.dropTable('Orders', { transaction });
      await queryInterface.dropTable('Txs', { transaction });
      await queryInterface.dropTable('DerivedWallets', { transaction });
      await queryInterface.dropTable('Wallets', { transaction });
    }
  );
}

export default { up, down };
