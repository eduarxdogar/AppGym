import { z } from 'zod';
import { InbodyDataSchema } from '../../profile/schemas/user-profile.schema';

export const OnboardingSchema = z.object({
  displayName: z.string().optional(),
  age: z.number().min(12, 'Edad mínima 12 años').max(100, 'Edad máxima 100 años').nullable().optional(),
  weight: z.number().positive('El peso debe ser mayor a 0'),
  height: z.number().positive('La altura debe ser mayor a 0'),
  sex: z.enum(['male', 'female', 'other']),
  goal: z.enum(['volumen', 'definicion', 'mantenimiento', 'perdida_peso']),
  fitnessLevel: z.enum(['Principiante', 'Intermedio', 'Avanzado']),
  availableDays: z.array(z.string()).min(1, 'Debes seleccionar al menos un día disponible'),
  equipment: z.array(z.string()).min(1, 'Debes seleccionar al menos un equipamiento'),
  baseGym: z.string().min(1, 'El gimnasio base es requerido'),
  inbodyData: InbodyDataSchema.optional(),
}).strict();

export type OnboardingData = z.infer<typeof OnboardingSchema>;
