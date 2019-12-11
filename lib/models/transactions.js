export default (sequelize, DataTypes) => {
  const Transactions = sequelize.define('Transactions', {
    id: { type: DataTypes.BIGINT, primaryKey: true, allowNull: false,
          autoIncrement: true, autoIncrementIdentity: true },
    tickerFrom: { type: DataTypes.ENUM('USDT', 'FINTEH.USDT'),
                  allowNull: false },
    amountFrom: { type: DataTypes.DECIMAL(40, 20).UNSIGNED, allowNull: false },
    tickerTo: { type: DataTypes.ENUM('USDT', 'FINTEH.USDT'), allowNull: false },
    amountTo: DataTypes.DECIMAL(40, 20).UNSIGNED,
    status: { type: DataTypes.ENUM('pending', 'receive_pending', 'receive_ok',
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
  }, { timestamps: true, paranoid: true, version: true,
       initialAutoIncrement: true });

  Transactions.associate = models => {
    models.DerivedWallets.hasMany(Transactions, { foreignKey: 'walletId' });
    Transactions.belongsTo(models.DerivedWallets, { foreignKey: 'walletId' });
  };

  return Transactions;
};
