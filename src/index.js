import "dotenv/config";

import express from "express";
import { Server } from "socket.io";
import http from "http";
import cors from "cors";
import { sequelize } from "./models/index.js";
import dropRoutes from "./routes/drops.routes.js";
import userRoutes from "./routes/users.routes.js";
import { startExpiryJob } from "./jobs/expiryJob.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// -- make io accessible in controllers --
app.set("io", io);

// -- middleware --
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" }));
app.use(express.json());

// -- routes --
app.use("/api/users", userRoutes);
app.use("/api/drops", dropRoutes);

app.get("/health", (req, res) =>
  res.json({ status: "ok", timestamp: new Date() }),
);

// -- socket.io connection handling --
io.on("connection", (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);
  socket.on("disconnect", () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 4000;

const start = async () => {
  try {
    await sequelize.authenticate();
    console.log("[DB] Connection established");
    await sequelize.sync({ alter: process.env.NODE_ENV === "development" });
    console.log("[DB] Models synced");

    // -- start background job --
    startExpiryJob(io);

    server.listen(PORT, () => {
      console.log(`[Server] Running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("[Server] Startup error:", err);
    process.exit(1);
  }
};

start();
