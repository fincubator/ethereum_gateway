async function up(queryInterface, Sequelize): Promise<void> {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.createTable('Wallets', {
      id: { type: Sequelize.BIGINT, primaryKey: true, allowNull: false,
            autoIncrement: true, autoIncrementIdentity: true },
      payment: { type: Sequelize.ENUM('ethereum', 'bitshares'),
                 allowNull: false },
      invoice: { type: Sequelize.JSONB, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false,
                   defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false,
                   defaultValue: Sequelize.NOW },
      deletedAt: Sequelize.DATE,
      version: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 }
    }, { transaction });
    await queryInterface.addConstraint(
      'Wallets', ['payment', 'invoice'], { transaction, type: 'unique' }
    );
    await queryInterface.createTable('DerivedWallets', {
      id: { type: Sequelize.BIGINT, primaryKey: true, allowNull: false,
            autoIncrement: true, autoIncrementIdentity: true },
      walletId: { type: Sequelize.BIGINT, allowNull: false,
                  references: { model: 'Wallets', key: 'id' },
                  onUpdate: 'cascade', onDelete: 'cascade' },
      payment: { type: Sequelize.ENUM('ethereum', 'bitshares'),
                 allowNull: false },
      invoice: { type: Sequelize.JSONB, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false,
                   defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false,
                   defaultValue: Sequelize.NOW },
      deletedAt: Sequelize.DATE,
      version: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 }
    }, { transaction });
    await queryInterface.addConstraint(
      'DerivedWallets', ['walletId', 'payment'], {
        transaction, type: 'unique'
      }
    );
    await queryInterface.addConstraint(
      'DerivedWallets', ['payment', 'invoice'], { transaction, type: 'unique' }
    );
    await queryInterface.createTable('Transactions', {
      id: { type: Sequelize.BIGINT, primaryKey: true, allowNull: false,
            autoIncrement: true, autoIncrementIdentity: true },
      jobId: { type: Sequelize.UUID, unique: true, allowNull: false,
               defaultValue: Sequelize.UUIDV4 },
      walletId: { type: Sequelize.BIGINT, allowNull: false,
                  references: { model: 'DerivedWallets', key: 'id' },
                  onUpdate: 'cascade', onDelete: 'cascade' },
      tickerFrom: { type: Sequelize.ENUM('USDT', 'FINTEH.USDT'),
                    allowNull: false },
      amountFrom: Sequelize.DECIMAL(40, 20).UNSIGNED,
      tickerTo: { type: Sequelize.ENUM('USDT', 'FINTEH.USDT'),
                  allowNull: false },
      amountTo: Sequelize.DECIMAL(40, 20).UNSIGNED,
      status: { type: Sequelize.ENUM('pending', 'receive_pending', 'receive_ok',
                                     'receive_err', 'issue_commit_ok',
                                     'issue_commit_err', 'issue_pending',
                                     'issue_ok', 'issue_err', 'burn_commit_ok',
                                     'burn_commit_err', 'burn_pending',
                                     'burn_ok', 'burn_err',
                                     'transfer_from_commit_ok',
                                     'transfer_from_commit_err',
                                     'transfer_from_pending',
                                     'transfer_from_ok', 'transfer_from_err',
                                     'transfer_to_commit_ok',
                                     'transfer_to_commit_err',
                                     'transfer_to_pending', 'transfer_to_ok',
                                     'transfer_to_err', 'ok'),
                allowNull: false, defaultValue: 'pending' },
      txReceive: Sequelize.JSONB, txReceiveCreatedAt: Sequelize.DATE,
      txIssue: Sequelize.JSONB,
      txIssueCreatedAt: Sequelize.DATE,
      txBurn: Sequelize.JSONB,
      txBurnCreatedAt: Sequelize.DATE,
      txTransferFrom: Sequelize.JSONB,
      txTransferFromCreatedAt: Sequelize.DATE,
      txTransferTo: Sequelize.JSONB,
      txTransferToCreatedAt: Sequelize.DATE,
      createdAt: { type: Sequelize.DATE, allowNull: false,
                   defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false,
                   defaultValue: Sequelize.NOW },
      deletedAt: Sequelize.DATE,
      version: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 }
    }, { transaction });
    await queryInterface.addConstraint(
      'Transactions', ['amountFrom', 'amountTo'], {
        transaction, type: 'check', where: {
          amountFrom: { [Sequelize.Op.gte]: 0 }, amountTo: {
            [Sequelize.Op.gte]: 0
          }
        }
      }
    );
  });
};


async function down(queryInterface, Sequelize): Promise<void> {
  queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.dropTable('Transactions', { transaction });
    await queryInterface.dropTable('DerivedWallets', { transaction });
    await queryInterface.dropTable('Wallets', { transaction });
  });
};

export default {up, down};
