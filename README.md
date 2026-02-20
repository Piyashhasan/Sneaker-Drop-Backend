# 🚀 Project Setup Guide

## Prerequisites

Make sure you have the following installed before getting started:

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [PostgreSQL](https://www.postgresql.org/) (v14 or higher)
- [Git](https://git-scm.com/)

---

## Getting Started

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd <project-folder>
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the root of the project and add the following:

```env
PORT=4000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sneaker_drop
DB_USER=[your_db_user_name]
DB_PASSWORD=[your_db_password_add]
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### 4. Set Up the Database

Make sure PostgreSQL is running, then create the database:

```bash
psql -U postgres -c "CREATE DATABASE sneaker_drop;"
```

### 5. Start the Development Server

```bash
npm run dev
```

The server will be running at: **http://localhost:4000**

The frontend (if separate) is expected at: **http://localhost:3000**

---

## ⚙️ Architecture & Design Decisions

### How Reservation Expiry Works

The 60-second reservation window is implemented using a **timestamp-based lazy expiration** pattern — no cron jobs, no background timers.

When a user reserves an item, an `expiresAt` timestamp is calculated and stored in the database:

```js
const expiresAt = new Date(now.getTime() + RESERVATION_TTL_SECONDS * 1000);
```

At the moment a purchase is attempted, the server checks if the reservation is still within its window:

```js
if (reservation.expiresAt < now) {
  await reservation.update({ status: "expired" }, { transaction });
  return res
    .status(410)
    .json({ message: "Reservation has expired. Please try again." });
}
```

The reservation is **not** actively killed after 60 seconds — it's evaluated at purchase time. This keeps the system stateless and simple, with no risk of timers misfiring in a distributed environment.

---

### How Concurrency is Handled

Preventing two users from claiming the same last item is solved through **three layered defenses**:

**1. Pessimistic Row-Level Locking**

The `Drop` record is fetched inside a database transaction using `SELECT ... FOR UPDATE`. This means only one request can hold the lock on that row at a time — all other concurrent requests are blocked at the database level until the first transaction completes.

```js
const drop = await Drop.findOne({
  where: { id: dropId, isActive: true },
  lock: transaction.LOCK.UPDATE,
  transaction,
});
```

**2. Atomic Stock Check + Decrement**

The stock check and the decrement happen inside the same locked transaction, so no two requests can both pass the `availableStock < 1` check for the same last item.

```js
if (drop.availableStock < 1) {
  await transaction.rollback();
  return res.status(409).json({ message: "No stock available. Sold out!" });
}

await drop.update(
  {
    availableStock: drop.availableStock - 1,
    reservedStock: drop.reservedStock + 1,
  },
  { transaction },
);
```

**3. Unique Constraint Fallback**

A database-level unique constraint prevents the same `sessionId` from holding two active reservations for the same drop simultaneously. If two identical requests somehow slip through, the `SequelizeUniqueConstraintError` is caught explicitly as a final safety net.

---

### Summary

| Concern                     | Solution                                         |
| --------------------------- | ------------------------------------------------ |
| Reservation expiry          | Timestamp-based lazy evaluation at purchase time |
| Race condition on last item | `SELECT FOR UPDATE` pessimistic lock             |
| Duplicate reservations      | Pre-check query + unique constraint fallback     |
| Stock integrity             | Atomic check + decrement inside same transaction |

---

### Real-Time Updates

After every reservation or purchase, the updated drop state is broadcast to all connected clients via **Socket.IO**, keeping the frontend stock count live without polling.

```js
io.emit("stock:update", { drop: updatedDrop });
io.emit("feed:update", { dropId, buyer, purchasedAt });
```
