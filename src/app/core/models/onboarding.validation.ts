import { z } from 'zod';

export const AVAILABLE_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const;
export const ProfileBasicsSchema = z.object({
  weight: z.number().finite().positive(),
  goal: z.enum(['volumen', 'definicion', 'mantenimiento', 'perdida_peso']),
  fitnessLevel: z.enum(['Principiante', 'Intermedio', 'Avanzado']),
  availableDays: z.array(z.enum(AVAILABLE_DAYS)).min(1).max(7)
    .refine(days => new Set(days).size === days.length),
});
const CompletedOnboardingSchema = ProfileBasicsSchema.extend({
  onboardingCompleted: z.literal(true),
  isDeleted: z.literal(false).optional(),
});

export function isOnboardingComplete(profile: unknown): boolean {
  return CompletedOnboardingSchema.safeParse(profile).success;
}
