import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Purchase = sequelize.define(
  "Purchase",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    dropId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "drop_id",
      references: { model: "drops", key: "id" },
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "user_id",
      references: { model: "users", key: "id" },
    },
    reservationId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      field: "reservation_id",
      references: { model: "reservations", key: "id" },
    },
    pricePaid: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: "price_paid",
    },
    purchasedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "purchased_at",
    },
  },
  {
    tableName: "purchases",
    underscored: true,
    indexes: [{ fields: ["drop_id"] }, { fields: ["user_id"] }],
  },
);

export default Purchase;
