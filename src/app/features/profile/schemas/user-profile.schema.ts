import { z } from 'zod';

export const SegmentalDataSchema = z.object({
  rightArm: z.string().nullable().optional(),
  leftArm: z.string().nullable().optional(),
  trunk: z.string().nullable().optional(),
  rightLeg: z.string().nullable().optional(),
  leftLeg: z.string().nullable().optional(),
}).strict();

export const InbodyDataSchema = z.object({
  muscleKg: z.number().nullable().optional(),
  fatPercent: z.number().nullable().optional(),
  bmr: z.number().nullable().optional(),
  waterPercentage: z.number().nullable().optional(),
  visceralFat: z.number().nullable().optional(),
  boneMass: z.number().nullable().optional(),
  score: z.number().nullable().optional(),
  raw: z.string().optional(),
  segmentalMuscle: SegmentalDataSchema.optional(),
  segmentalFat: SegmentalDataSchema.optional(),
}).strict();

export const UserProfileSchema = z.object({
  displayName: z.string().optional(),
  age: z.number().nullable().optional(),
  weight: z.number(),
  height: z.number(),
  sex: z.enum(['male', 'female', 'other']).nullable().optional(),
  goal: z.enum(['volumen', 'definicion', 'mantenimiento', 'perdida_peso']),
  fitnessLevel: z.enum(['Principiante', 'Intermedio', 'Avanzado']),
  availableDays: z.array(z.string()),
  equipment: z.array(z.string()),
  fatigueLevels: z.record(z.string(), z.number()).optional(),
  inbodyData: InbodyDataSchema.optional(),
  baseGym: z.string().optional(),
  useSeelegSupplements: z.boolean().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  subscriptionStatus: z.enum(['trialing', 'active', 'past_due', 'canceled']).optional(),
  trialEndsAt: z.string().optional(),
  mpCustomerId: z.string().optional(),
  isDeleted: z.boolean().optional(),
  deletedAt: z.number().optional(),
  email: z.string().optional(),
}).strict();

export type SegmentalData = z.infer<typeof SegmentalDataSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
