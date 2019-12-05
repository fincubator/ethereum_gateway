export default (sequelize, DataTypes) => {
  const Transactions = sequelize.define('Transactions', {
    id: { type: DataTypes.BIGINT, primaryKey: true, allowNull: false,
          autoIncrement: true, autoIncrementIdentity: true },
    tickerFrom: { type: DataTypes.ENUM('USDT', 'FINTEH.USDT'),
                  allowNull: false },
    amountFrom: { type: DataTypes.DECIMAL(40, 20).UNSIGNED, allowNull: false },
    tickerTo: { type: DataTypes.ENUM('USDT', 'FINTEH.USDT'), allowNull: false },
    amountTo: DataTypes.DECIMAL(40, 20).UNSIGNED,
    status: { type: DataTypes.ENUM('init', 'tx_receive_ok', 'tx_receive_err',
                                   'tx_issue_ok', 'tx_issue_err', 'tx_burn_ok',
                                   'tx_burn_err', 'tx_transfer_from_ok',
                                   'tx_transfer_from_err', 'tx_transfer_to_ok',
                                   'tx_transfer_to_err'),
              allowNull: false, defaultValue: 'init' },
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
