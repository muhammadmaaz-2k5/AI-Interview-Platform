import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../db";
import { Message } from "./Message";

export interface InterviewAttributes {
  id: string;
  githubUrl: string;
  githubMetadata: any;
  status: "Pre" | "In-Progress" | "Done";
  score: number | null;
  feedback: any | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface InterviewCreationAttributes
  extends Optional<InterviewAttributes, "id" | "githubMetadata" | "status" | "score" | "feedback"> {}

export class Interview
  extends Model<InterviewAttributes, InterviewCreationAttributes>
  implements InterviewAttributes
{
  declare public id: string;
  declare public githubUrl: string;
  declare public githubMetadata: any;
  declare public status: "Pre" | "In-Progress" | "Done";
  public readonly messages?: Message[];
  declare public score: number | null;
  declare public feedback: any | null;

  declare public readonly createdAt: Date;
  declare public readonly updatedAt: Date;
}

Interview.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    githubUrl: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    githubMetadata: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
    },
    status: {
      type: DataTypes.ENUM("Pre", "In-Progress", "Done"),
      allowNull: false,
      defaultValue: "Pre",
    },
    score: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
    feedback: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize,
    tableName: "Interviews",
  }
);
