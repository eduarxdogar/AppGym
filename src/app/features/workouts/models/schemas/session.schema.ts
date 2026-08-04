import { z } from 'zod';

export const WorkoutSetSchema = z.object({
  reps: z.number().optional(),
  repeticiones: z.number().optional(),
  weight: z.number().optional(),
  peso: z.number().optional(),
  pesokg: z.number().optional(),
  completed: z.boolean().optional(),
  type: z.string().optional(),
  tipo: z.string().optional(),
}).strict();

export const WorkoutExerciseSchema = z.object({
  name: z.string().optional(),
  nombre: z.string().optional(),
  grupoMuscular: z.string().optional(),
  groupMuscular: z.string().optional(),
  muscleGroup: z.string().optional(),
  sets: z.array(WorkoutSetSchema).optional(),
  series: z.array(WorkoutSetSchema).optional(),
  tipos: z.enum(['normal', 'top-set', 'back-set', 'drop-set', 'super-serie']).optional(),
}).strict();

export const WorkoutSessionSchema = z.object({
  id: z.string().optional(),
  userId: z.string().optional(),
  microcycleId: z.string().optional(),
  originWorkoutId: z.string().optional(),
  nombre: z.string().optional(),
  fecha: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  exercises: z.array(WorkoutExerciseSchema).optional(),
  ejercicios: z.array(WorkoutExerciseSchema).optional(),
  calories: z.number().optional(),
  duration: z.string().optional(),
  totalVolume: z.number().optional(),
  musclesWorked: z.array(z.string()).optional(),
  musculos: z.array(z.string()).optional(),
}).strict();

export type WorkoutSet = z.infer<typeof WorkoutSetSchema>;
export type WorkoutExercise = z.infer<typeof WorkoutExerciseSchema>;
export type WorkoutSession = z.infer<typeof WorkoutSessionSchema>;
