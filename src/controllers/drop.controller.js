import { Op } from "sequelize";
import sequelize from "../config/database.js";
import { Drop, Reservation, User, Purchase } from "../models/index.js";

const RESERVATION_TTL_SECONDS = 10;

// -- GET ALL DROPS --
export const listDrops = async (req, res) => {
  try {
    const drops = await Drop.findAll({
      where: { isActive: true },
      order: [["startsAt", "DESC"]],
      include: [
        {
          model: Purchase,
          as: "purchases",
          separate: true,
          limit: 3,
          order: [["purchasedAt", "DESC"]],
          attributes: ["id", "purchasedAt", "dropId", "userId"],
          include: [
            {
              model: User,
              as: "buyer",
              attributes: ["id", "username"],
            },
          ],
        },
      ],
    });

    res.json({ success: true, data: drops });
  } catch (err) {
    console.error("listDrops error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch drops" });
  }
};

// -- GET DROPS BY ID --
export const getDrop = async (req, res) => {
  try {
    const drop = await Drop.findByPk(req.params.id);
    if (!drop)
      return res
        .status(404)
        .json({ success: false, message: "Drop not found" });
    res.json({ success: true, data: drop });
  } catch (err) {
    console.error("getDrop error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch drop" });
  }
};

// -- CREATE DROP --
export const createDrop = async (req, res) => {
  const { name, description, price, imageUrl, totalStock, startsAt, endsAt } =
    req.body;

  if (!name || !price || !totalStock) {
    return res.status(400).json({
      success: false,
      message: "name, price, and totalStock are required",
    });
  }
  if (totalStock < 1) {
    return res
      .status(400)
      .json({ success: false, message: "totalStock must be >= 1" });
  }

  try {
    const drop = await Drop.create({
      name,
      description,
      price,
      imageUrl,
      totalStock,
      availableStock: totalStock,
      reservedStock: 0,
      soldStock: 0,
      startsAt: startsAt ? new Date(startsAt) : new Date(),
      endsAt: endsAt ? new Date(endsAt) : null,
    });
    res.status(201).json({ success: true, data: drop });
  } catch (err) {
    console.error("createDrop error:", err);
    res.status(500).json({ success: false, message: "Failed to create drop" });
  }
};

// -- RESERVE DROP --
export const reserveItem = async (req, res) => {
  const { sessionId } = req.body;
  const { id: dropId } = req.params;

  if (!sessionId) {
    return res
      .status(400)
      .json({ success: false, message: "sessionId is required" });
  }

  const transaction = await sequelize.transaction();
  try {
    const drop = await Drop.findOne({
      where: { id: dropId, isActive: true },
      lock: transaction.LOCK.UPDATE,
      transaction,
    });

    if (!drop) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Drop not found or inactive" });
    }

    // check drop window
    const now = new Date();

    if (drop.startsAt > now) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Drop has not started yet" });
    }
    if (drop.endsAt && drop.endsAt < now) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Drop has ended" });
    }

    // check if this session already has an active reservation for this drop
    const existing = await Reservation.findOne({
      where: { dropId, sessionId, status: "active" },
      transaction,
    });

    if (existing) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "You already have an active reservation for this item",
        reservation: existing,
      });
    }

    // THE KEY CHECK: available stock
    if (drop.availableStock < 1) {
      await transaction.rollback();
      return res
        .status(409)
        .json({ success: false, message: "No stock available. Sold out!" });
    }

    const expiresAt = new Date(now.getTime() + RESERVATION_TTL_SECONDS * 1000);

    // decrement available, increment reserved
    await drop.update(
      {
        availableStock: drop.availableStock - 1,
        reservedStock: drop.reservedStock + 1,
      },
      { transaction },
    );

    const reservation = await Reservation.create(
      { dropId, sessionId, status: "active", expiresAt },
      { transaction },
    );

    await transaction.commit();

    // reload drop for fresh state to broadcast
    const updatedDrop = await Drop.findByPk(dropId);

    // emit via socket (attached to req.app)
    const io = req.app.get("io");
    if (io) {
      io.emit("stock:update", { drop: updatedDrop });
    }

    res.status(201).json({
      success: true,
      message: "Reserved! You have 60 seconds to complete your purchase.",
      data: { reservation, drop: updatedDrop },
    });
  } catch (err) {
    await transaction.rollback();
    console.error("reserveItem error:", err);
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message: "You already have an active reservation",
      });
    }
    res.status(500).json({
      success: false,
      message: "Reservation failed. Please try again.",
    });
  }
};

// -- PURCHASE DROP --
export const purchaseItem = async (req, res) => {
  const { sessionId, userId } = req.body.payload;

  const { id: dropId } = req.params;

  if (!sessionId || !userId) {
    return res
      .status(400)
      .json({ success: false, message: "sessionId and userId are required" });
  }

  const transaction = await sequelize.transaction();
  try {
    const reservation = await Reservation.findOne({
      where: { dropId, sessionId, status: "active" },
      lock: transaction.LOCK.UPDATE,
      transaction,
    });

    if (!reservation) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "No active reservation found. It may have expired.",
      });
    }

    const now = new Date();
    if (reservation.expiresAt < now) {
      await reservation.update({ status: "expired" }, { transaction });
      await transaction.rollback();
      return res.status(410).json({
        success: false,
        message: "Reservation has expired. Please try again.",
      });
    }

    // verify the user exists
    const user = await User.findByPk(userId, { transaction });
    if (!user) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const drop = await Drop.findOne({
      where: { id: dropId },
      lock: transaction.LOCK.UPDATE,
      transaction,
    });

    // complete reservation
    await reservation.update(
      { status: "completed", completedAt: now },
      { transaction },
    );

    // adjust stock counters
    await drop.update(
      {
        reservedStock: drop.reservedStock - 1,
        soldStock: drop.soldStock + 1,
      },
      { transaction },
    );

    // create the purchase record for the activity feed
    const purchase = await Purchase.create(
      {
        dropId,
        userId,
        reservationId: reservation.id,
        pricePaid: drop.price,
        purchasedAt: now,
      },
      { transaction },
    );

    await transaction.commit();

    const updatedDrop = await Drop.findByPk(dropId);

    const io = req.app.get("io");
    if (io) {
      // broadcast the purchase so all connected clients can update the feed
      io.emit("stock:update", { drop: updatedDrop });
      io.emit("feed:update", {
        dropId,
        buyer: { id: user.id, username: user.username },
        purchasedAt: purchase.purchasedAt,
      });
    }

    res.json({
      success: true,
      message: "Purchase complete! 🎉",
      data: { reservation, purchase, drop: updatedDrop },
    });
  } catch (err) {
    await transaction.rollback();
    console.error("purchaseItem error:", err);
    res
      .status(500)
      .json({ success: false, message: "Purchase failed. Please try again." });
  }
};

// GET /api/drops/:id/reservation?sessionId=xxx
export const getReservation = async (req, res) => {
  const { sessionId } = req.query;
  const { id: dropId } = req.params;

  if (!sessionId)
    return res
      .status(400)
      .json({ success: false, message: "sessionId required" });

  try {
    const reservation = await Reservation.findOne({
      where: { dropId, sessionId, status: "active" },
    });

    res.json({ success: true, data: reservation });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch reservation" });
  }
};
