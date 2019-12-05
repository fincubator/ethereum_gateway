export default (sequelize, DataTypes) => {
  return sequelize.define('Wallets', {
    id: { type: DataTypes.BIGINT, primaryKey: true, allowNull: false,
          autoIncrement: true, autoIncrementIdentity: true },
    payment: { type: DataTypes.ENUM('ethereum', 'bitshares') },
    invoice: { type: DataTypes.JSONB, allowNull: false }
  }, { timestamps: true, paranoid: true, version: true,
       initialAutoIncrement: true });
};
