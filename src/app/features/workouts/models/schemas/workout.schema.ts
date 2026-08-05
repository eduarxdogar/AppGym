import { z } from 'zod';
import { EjercicioSchema } from './exercise.schema';

export const ActiveSetStateSchema = z.object({
  reps: z.number(),
  weight: z.number(),
  completed: z.boolean(),
  isDropset: z.boolean().optional(),
}).strict();

export const ProgressionOptionsSchema = z.object({
  focus: z.enum(['weight', 'volume']),
  frequencyAdjustment: z.number(),
}).strict();

export const WorkoutSchema = z.object({
  id: z.string(),
  fecha: z.string().optional(),
  nombre: z.string(),
  ejercicios: z.array(EjercicioSchema),
  coachNotes: z.string(),
  nivelDificultad: z.enum(['principiante', 'intermedio', 'avanzado']),
  musculos: z.array(z.string()).optional(),
  frequency: z.number().optional(),
  isCompleted: z.boolean().optional(),
  completedAt: z.string().optional(),
  durationMinutes: z.number().optional(),
  status: z.enum(['idle', 'active', 'completed']).optional(),
  activeStartTime: z.string().optional(),
  activeSetsState: z.record(z.string(), z.array(ActiveSetStateSchema)).optional(),
}).strict();

export type ActiveSetState = z.infer<typeof ActiveSetStateSchema>;
export type ProgressionOptions = z.infer<typeof ProgressionOptionsSchema>;
export type Workout = z.infer<typeof WorkoutSchema>;
