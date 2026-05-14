import { z } from 'zod';

export const captureSignalSchema = z.object({
  content:   z.string().min(1, 'content required').max(2000),
  person_id: z.string().uuid().optional(),
});

export const humanStateSchema = z.object({
  mood_score:     z.number().int().min(1).max(5),
  energy_score:   z.number().int().min(1).max(10),
  physical_tags:  z.array(z.string().max(50)).max(10).default([]),
  emotional_tags: z.array(z.string().max(50)).max(10).default([]),
  notes:          z.string().max(500).optional(),
});

export const pushTokenSchema = z.object({
  token: z.string()
    .refine(t => t.startsWith('ExponentPushToken[') && t.endsWith(']'), {
      message: 'Invalid Expo push token format',
    }),
});

export const deleteAccountSchema = z.object({
  confirmation: z.literal('ELIMINAR MI CUENTA'),
});
