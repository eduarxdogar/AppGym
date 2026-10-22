import { z } from 'zod';
import { ProfileBasicsSchema } from '../../../core/models/onboarding.validation';

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

export const UserProfileSchema = ProfileBasicsSchema.extend({
  onboardingCompleted: z.boolean().optional(),
  displayName: z.string().optional(),
  age: z.number().nullable().optional(),
  height: z.number().finite().positive(),
  sex: z.enum(['male', 'female', 'other']).nullable().optional(),
  equipment: z.array(z.string()),
  availableEquipment: z.array(z.string().min(1)).min(1).optional(),
  fatigueLevels: z.record(z.string(), z.number()).optional(),
  inbodyData: InbodyDataSchema.optional(),
  baseGym: z.string().optional(),
  useSeelegSupplements: z.boolean().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  subscriptionStatus: z.enum(['vip', 'trialing', 'active', 'past_due', 'canceled', 'refunded', 'charged_back']).optional(),
  trialEndsAt: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  subscriptionPaymentId: z.string().optional(),
  subscriptionPaymentUpdatedAt: z.string().optional(),
  subscriptionPaymentApprovedAt: z.string().optional(),
  mpCustomerId: z.string().optional(),
  isDeleted: z.boolean().optional(),
  deletedAt: z.number().optional(),
  email: z.string().optional(),
}).strict();

export type SegmentalData = z.infer<typeof SegmentalDataSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
