import { Sequelize } from "sequelize";
import { Client } from "pg";
import dotenv from "dotenv";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
const dbName = process.env.DB_NAME || "ai-interview-plateform";
const dbUser = process.env.DB_USER || "postgres";
const dbPassword = process.env.DB_PASSWORD || "maaz";
const dbHost = process.env.DB_HOST || "localhost";
const dbPort = parseInt(process.env.DB_PORT || "5432", 10);

export const sequelize = databaseUrl
  ? new Sequelize({
      dialect: "postgres",
      dialectModule: Client,
      dialectOptions: {
        ssl: new URL(databaseUrl).searchParams.get("sslmode") === "require"
          ? { require: true }
          : undefined,
      },
      username: new URL(databaseUrl).username,
      password: new URL(databaseUrl).password,
      database: new URL(databaseUrl).pathname.replace(/^\//, ""),
      host: new URL(databaseUrl).hostname,
      port: parseInt(new URL(databaseUrl).port || "5432", 10),
      logging: false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
    })
  : new Sequelize(dbName, dbUser, dbPassword, {
      host: dbHost,
      port: dbPort,
      dialect: "postgres",
      logging: false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
    });

export async function ensureDatabaseExists() {
  if (databaseUrl) {
    return;
  }

  const client = new Client({
    user: dbUser,
    password: dbPassword,
    host: dbHost,
    port: dbPort,
    database: "postgres",
  });

  try {
    await client.connect();
    const res = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );

    if (res.rowCount === 0) {
      console.log(`🔨 Database "${dbName}" does not exist. Creating database now...`);
      await client.query(
        `CREATE DATABASE "${dbName.replace(/"/g, '""')}"`
      );
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

export async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log("✅ PostgreSQL connection has been established successfully via Sequelize.");
  } catch (error) {
    console.error("❌ Unable to connect to the PostgreSQL database:", error);
    throw error;
  }
}
