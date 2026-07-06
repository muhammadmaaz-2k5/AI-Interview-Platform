import { z } from "zod";

export const PreInterviewSchema = z.object({
  githubUrl: z
    .string()
    .url("Please provide a valid URL")
    .refine(
      (val) => val.toLowerCase().includes("github.com"),
      "URL must be a GitHub link"
    ),
});

export type PreInterviewInput = z.infer<typeof PreInterviewSchema>;
