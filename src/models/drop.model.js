import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Drop = sequelize.define(
  "Drop",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    imageUrl: {
      type: DataTypes.STRING(512),
      allowNull: true,
      field: "image_url",
    },
    totalStock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 0 },
      field: "total_stock",
    },
    availableStock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 0 },
      field: "available_stock",
    },
    reservedStock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "reserved_stock",
    },
    soldStock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "sold_stock",
    },
    startsAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "starts_at",
    },
    endsAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "ends_at",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: "is_active",
    },
  },
  {
    tableName: "drops",
    underscored: true,
    indexes: [{ fields: ["is_active"] }, { fields: ["starts_at"] }],
  },
);

export default Drop;
