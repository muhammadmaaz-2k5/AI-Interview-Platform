import { Sequelize } from "sequelize";
import { Client } from "pg";
import dotenv from "dotenv";

dotenv.config();

const dbName = process.env.DB_NAME || "ai-interview-plateform";
const dbUser = process.env.DB_USER || "postgres";
const dbPassword = process.env.DB_PASSWORD || "maaz";
const dbHost = process.env.DB_HOST || "localhost";
const dbPort = parseInt(process.env.DB_PORT || "5432", 10);

export async function ensureDatabaseExists() {
  const client = new Client({
    user: dbUser,
    password: dbPassword,
    host: dbHost,
    port: dbPort,
    database: "postgres", // Connect to default pg database to check/create target
  });

  try {
    await client.connect();
    const res = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );

    if (res.rowCount === 0) {
      console.log(`🔨 Database "${dbName}" does not exist. Creating database now...`);
      // CREATE DATABASE cannot be executed inside a transaction block
      await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
      console.log(`✅ Database "${dbName}" created successfully.`);
    } else {
      console.log(`✓ Database "${dbName}" already exists.`);
    }
  } catch (error: any) {
    console.warn(`⚠️ Warning: Database check or auto-creation failed: ${error.message}`);
    console.log("Proceeding with Sequelize connection attempt...");
  } finally {
    try {
      await client.end();
    } catch (e) {}
  }
}

export const sequelize = new Sequelize(dbName, dbUser, dbPassword, {
  host: dbHost,
  port: dbPort,
  dialect: "postgres",
  logging: false, // Set to console.log to see SQL queries during development
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

export async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log("✅ PostgreSQL connection has been established successfully via Sequelize.");
  } catch (error) {
    console.error("❌ Unable to connect to the PostgreSQL database:", error);
    throw error;
  }
}
