import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Reservation = sequelize.define(
  "Reservation",
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
    sessionId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "session_id",
      comment: "Client session identifier (no auth required)",
    },
    status: {
      type: DataTypes.ENUM("active", "completed", "expired", "cancelled"),
      allowNull: false,
      defaultValue: "active",
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "expires_at",
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "completed_at",
    },
  },
  {
    tableName: "reservations",
    underscored: true,
    indexes: [
      { fields: ["drop_id"] },
      { fields: ["session_id"] },
      { fields: ["status"] },
      { fields: ["expires_at"] },
      {
        unique: true,
        fields: ["drop_id", "session_id"],
        where: { status: "active" },
        name: "unique_active_reservation_per_session",
      },
    ],
  },
);

export default Reservation;
