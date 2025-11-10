import { z } from 'zod';

export const sendMessageSchema = z.object({
  text: z
    .string()
    .min(1, { message: 'Message cannot be empty' })
    .max(5000, { message: 'Message too long (max 5000 chars)' }),
});
