import { z } from 'zod';

export const createInviteSchema = z.object({
  maxUses: z.number().int().nonnegative().optional().default(1),
  expiresInMinutes: z.number().int().positive().optional().default(60),
});
