// src/validators/groupSchemas.js
import { z } from "zod";

// Validation schema for creating a group
export const groupCreateSchema = z.object({
  name: z
    .string({ required_error: "Group name is required" })
    .min(1, "Group name cannot be empty"),

  type: z.enum(["private", "open"], {
    required_error: "Group type must be private or open",
  }),

  // 0 = unlimited, otherwise at least 2 members required
  maxMembers: z
    .number({
      required_error: "maxMembers is required",
      invalid_type_error: "maxMembers must be a number",
    })
    .int()
    .nonnegative()
    .refine(
      (n) => n === 0 || n >= 2,
      "maxMembers must be 0 (unlimited) or at least 2"
    ),

  // ✅ NEW FIELD — optional list used to pre-add members at creation time
  initialMemberIds: z.array(z.string()).optional().default([]),
});
