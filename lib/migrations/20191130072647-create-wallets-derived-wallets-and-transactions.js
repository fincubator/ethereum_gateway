const up = async (queryInterface, Sequelize) => {
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
      walletFrom: { type: Sequelize.BIGINT, allowNull: false,
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
      'DerivedWallets', ['walletFrom', 'payment'], {
        transaction, type: 'unique'
      }
    );
    await queryInterface.addConstraint(
      'DerivedWallets', ['payment', 'invoice'], { transaction, type: 'unique' }
    );
    await queryInterface.createTable('Transactions', {
      id: { type: Sequelize.BIGINT, primaryKey: true, allowNull: false,
            autoIncrement: true, autoIncrementIdentity: true },
      walletId: { type: Sequelize.BIGINT, allowNull: false,
                  references: { model: 'DerivedWallets', key: 'id' },
                  onUpdate: 'cascade', onDelete: 'cascade' },
      tickerFrom: { type: Sequelize.ENUM('USDT', 'FINTEH.USDT'),
                    allowNull: false },
      amountFrom: { type: Sequelize.DECIMAL(40, 20).UNSIGNED,
                    allowNull: false },
      tickerTo: { type: Sequelize.ENUM('USDT', 'FINTEH.USDT'),
                  allowNull: false },
      amountTo: Sequelize.DECIMAL(40, 20).UNSIGNED,
      status: { type: Sequelize.ENUM('init', 'tx_receive_ok', 'tx_receive_err',
                                     'tx_issue_ok', 'tx_issue_err',
                                     'tx_burn_ok', 'tx_burn_err',
                                     'tx_transfer_from_ok',
                                     'tx_transfer_from_err',
                                     'tx_transfer_to_ok',
                                     'tx_transfer_to_err'),
                allowNull: false, defaultValue: 'init' },
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


const down = async (queryInterface, Sequelize) => {
  queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.dropTable('Transactions', { transaction });
    await queryInterface.dropTable('DerivedWallets', { transaction });
    await queryInterface.dropTable('Wallets', { transaction });
  });
};

export default {up, down};
