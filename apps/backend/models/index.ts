import { sequelize, ensureDatabaseExists } from "../db";
import { Interview } from "./Interview";
import { Message } from "./Message";

const databaseUrl = process.env.DATABASE_URL;

defineAssociations();

export function defineAssociations() {
  Interview.hasMany(Message, {
    foreignKey: "interviewId",
    as: "messages",
    onDelete: "CASCADE",
  });

  Message.belongsTo(Interview, {
    foreignKey: "interviewId",
    as: "interview",
  });
}

export { sequelize, Interview, Message };

export async function initDb() {
  try {
    if (!databaseUrl) {
      await ensureDatabaseExists();
    }
    await sequelize.authenticate();
    console.log("🔒 Database authentication successful.");
    
    await sequelize.sync({ alter: true });
    console.log("⚡ Database tables synchronized successfully.");
  } catch (error) {
    console.error("💥 Failed to initialize the database schema:", error);
    throw error;
  }
}
