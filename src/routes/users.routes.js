import express from "express";
import { registerUser } from "../controllers/user.controller.js";

const router = express.Router();

// -- routes --
router.post("/register", registerUser);

export default router;
