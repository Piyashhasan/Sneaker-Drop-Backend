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
