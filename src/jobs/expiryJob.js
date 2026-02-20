import { Op } from "sequelize";
import { Drop, Reservation } from "../models/index.js";
import sequelize from "../config/database.js";

const startExpiryJob = (io) => {
  const sweep = async () => {
    try {
      // -- find all active reservations that have expired --
      const expiredReservations = await Reservation.findAll({
        where: {
          status: "active",
          expiresAt: { [Op.lt]: new Date() },
        },
      });

      if (expiredReservations.length === 0) return;

      // -- group by dropId to batch update drops --
      const dropIds = [...new Set(expiredReservations.map((r) => r.dropId))];

      const transaction = await sequelize.transaction();
      try {
        // -- mark all expired --
        await Reservation.update(
          { status: "expired" },
          {
            where: {
              id: { [Op.in]: expiredReservations.map((r) => r.id) },
            },
            transaction,
          },
        );

        // -- return stock for each affected drop --
        for (const dropId of dropIds) {
          const count = expiredReservations.filter(
            (r) => r.dropId === dropId,
          ).length;
          await Drop.increment(
            { availableStock: count, reservedStock: -count },
            { where: { id: dropId }, transaction },
          );
        }

        await transaction.commit();

        // -- broadcast updates --
        for (const dropId of dropIds) {
          const drop = await Drop.findByPk(dropId);
          io.emit("stock:update", { drop, reason: "reservation_expired" });
        }
      } catch (err) {
        await transaction.rollback();
        console.error("[ExpiryJob] Transaction error:", err);
      }
    } catch (err) {
      console.error("[ExpiryJob] Sweep error:", err);
    }
  };

  // -- run every 5 seconds --
  setInterval(sweep, 5000);
  console.log("[ExpiryJob] Started reservation expiry job (every 5s)");
};

export { startExpiryJob };
