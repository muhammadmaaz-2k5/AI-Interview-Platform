import { sequelize, ensureDatabaseExists } from "../db";
import { Interview } from "./Interview";
import { Message } from "./Message";

// Define Associations
Interview.hasMany(Message, {
  foreignKey: "interviewId",
  as: "messages",
  onDelete: "CASCADE",
});

Message.belongsTo(Interview, {
  foreignKey: "interviewId",
  as: "interview",
});

export { sequelize, Interview, Message };

export async function initDb() {
  try {
    // Ensure that the target database exists in PostgreSQL
    await ensureDatabaseExists();

    // Authenticate the connection
    await sequelize.authenticate();
    console.log("🔒 Database authentication successful.");
    
    // Sync models to schema (alter: true adjusts tables to match current models)
    await sequelize.sync({ alter: true });
    console.log("⚡ Database tables synchronized successfully.");
  } catch (error) {
    console.error("💥 Failed to initialize the database schema:", error);
    throw error;
  }
}
