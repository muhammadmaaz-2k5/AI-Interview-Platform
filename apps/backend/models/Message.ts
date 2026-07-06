import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../db";

export interface MessageAttributes {
  id: string;
  interviewId: string;
  role: "User" | "Assistant";
  content: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MessageCreationAttributes
  extends Optional<MessageAttributes, "id"> {}

export class Message
  extends Model<MessageAttributes, MessageCreationAttributes>
  implements MessageAttributes
{
  public id!: string;
  public interviewId!: string;
  public role!: "User" | "Assistant";
  public content!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Message.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    interviewId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "Interviews",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    role: {
      type: DataTypes.ENUM("User", "Assistant"),
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: "Messages",
  }
);
