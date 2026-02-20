import express from "express";

import {
  listDrops,
  getDrop,
  createDrop,
  reserveItem,
  purchaseItem,
  getReservation,
} from "../controllers/drop.controller.js";

const router = express.Router();

// -- routes --
router.get("/", listDrops);
router.post("/", createDrop);
router.get("/:id", getDrop);
router.post("/:id/reserve", reserveItem);
router.post("/:id/purchase", purchaseItem);
router.get("/:id/reservation", getReservation);

export default router;
