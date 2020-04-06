import { DataTypes, Op, QueryInterface } from 'sequelize';

async function up(
  queryInterface: QueryInterface,
  _DataTypes: any
): Promise<void> {
  await queryInterface.sequelize.transaction(async (transaction) => {
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
        invoice: { type: DataTypes.JSONB, allowNull: false },
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
        version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      },
      { transaction }
    );
    await queryInterface.addConstraint('Wallets', ['payment', 'invoice'], {
      transaction,
      type: 'unique',
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
        invoice: { type: DataTypes.JSONB, allowNull: false },
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
        version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      },
      { transaction }
    );
    await queryInterface.addConstraint(
      'DerivedWallets',
      ['walletId', 'payment'],
      {
        transaction,
        type: 'unique',
      }
    );
    await queryInterface.addConstraint(
      'DerivedWallets',
      ['payment', 'invoice'],
      { transaction, type: 'unique' }
    );
    await queryInterface.createTable(
      'Transactions',
      {
        id: {
          type: DataTypes.BIGINT,
          primaryKey: true,
          allowNull: false,
          autoIncrement: true,
          autoIncrementIdentity: true,
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
        tickerFrom: {
          type: DataTypes.ENUM('USDT', 'FINTEH.USDT'),
          allowNull: false,
        },
        amountFrom: DataTypes.DECIMAL(40, 20).UNSIGNED,
        tickerTo: {
          type: DataTypes.ENUM('USDT', 'FINTEH.USDT'),
          allowNull: false,
        },
        amountTo: DataTypes.DECIMAL(40, 20).UNSIGNED,
        status: {
          type: DataTypes.ENUM(
            'pending',
            'receive_pending',
            'receive_ok',
            'receive_err',
            'issue_commit_ok',
            'issue_commit_err',
            'issue_pending',
            'issue_ok',
            'issue_err',
            'burn_commit_ok',
            'burn_commit_err',
            'burn_pending',
            'burn_ok',
            'burn_err',
            'transfer_from_commit_ok',
            'transfer_from_commit_err',
            'transfer_from_pending',
            'transfer_from_ok',
            'transfer_from_err',
            'transfer_to_commit_ok',
            'transfer_to_commit_err',
            'transfer_to_pending',
            'transfer_to_ok',
            'transfer_to_err',
            'ok'
          ),
          allowNull: false,
          defaultValue: 'pending',
        },
        txReceive: DataTypes.JSONB,
        txReceiveCreatedAt: DataTypes.DATE,
        txIssue: DataTypes.JSONB,
        txIssueCreatedAt: DataTypes.DATE,
        txBurn: DataTypes.JSONB,
        txBurnCreatedAt: DataTypes.DATE,
        txTransferFrom: DataTypes.JSONB,
        txTransferFromCreatedAt: DataTypes.DATE,
        txTransferTo: DataTypes.JSONB,
        txTransferToCreatedAt: DataTypes.DATE,
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
        version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      },
      { transaction }
    );
    await queryInterface.addConstraint(
      'Transactions',
      ['amountFrom', 'amountTo'],
      {
        transaction,
        type: 'check',
        where: {
          amountFrom: { [Op.gte]: 0 },
          amountTo: {
            [Op.gte]: 0,
          },
        },
      }
    );
  });
}

async function down(
  queryInterface: QueryInterface,
  _DataTypes: any
): Promise<void> {
  queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.dropTable('Transactions', { transaction });
    await queryInterface.dropTable('DerivedWallets', { transaction });
    await queryInterface.dropTable('Wallets', { transaction });
  });
}

export default { up, down };
