export default (sequelize, DataTypes) => {
  const DerivedWallets = sequelize.define('DerivedWallets', {
    id: { type: DataTypes.BIGINT, primaryKey: true, allowNull: false,
          autoIncrement: true, autoIncrementIdentity: true },
    payment: { type: DataTypes.ENUM('ethereum', 'bitshares') },
    invoice: { type: DataTypes.JSONB, allowNull: false }
  }, { timestamps: true, paranoid: true, version: true,
       initialAutoIncrement: true });

  DerivedWallets.associate = models => {
    models.Wallets.hasMany(DerivedWallets, { foreignKey: 'walletFrom' });
    DerivedWallets.belongsTo(models.Wallets, { foreignKey: 'walletFrom' });
  };

  return DerivedWallets;
};
