export interface MuscleStatus {
  name: string;
  percentage: number;
  color: string;
  lastWorkoutDate?: Date;
  totalVolume?: number;
}

export interface WorkoutSet {
  reps?: number;
  repeticiones?: number;
  weight?: number;
  peso?: number;
  pesokg?: number;
  completed?: boolean;
  type?: string;
  tipo?: string;
}

export interface WorkoutExercise {
  name?: string;
  nombre?: string;
  grupoMuscular?: string;
  groupMuscular?: string;
  muscleGroup?: string;
  sets?: WorkoutSet[];
  series?: WorkoutSet[];
}

export interface WorkoutSession {
  id?: string;
  userId?: string;
  nombre?: string;
  fecha?: string;
  startTime?: string;
  endTime?: string;
  exercises?: WorkoutExercise[];
  ejercicios?: WorkoutExercise[];
  // Calculated & legacy properties
  calories?: number;
  duration?: string;
  totalVolume?: number;
  musclesWorked?: string[];
  musculos?: string[];
}

export const RECOVERY_CONSTANTS = {
  BASE_RECOVERY_PER_HOUR: 0.85,       // Slower: full recovery takes ~117h (5 days) at default
  INBODY_THRESHOLD: 85,
  RECOVERY_MULTIPLIER_ELITE: 1.15,
  RECOVERY_MULTIPLIER_NORMAL: 1,
  SEVEN_DAYS_MS: 7 * 24 * 60 * 60 * 1000,
  MS_PER_HOUR: 3600000,
  MIN_RECOVERY_HOURS_CAP: 12,        // Can't return to 100% within 12h of a workout
  FULL_RECOVERY_HOURS: 48,           // Full recovery ceiling window
};

export const FATIGUE_SCORES = {
  TOPSET: 25,
  EFFECTIVE: 15,
  BACKOFF: 10,
  WARMUP: 3,
  DEFAULT: 15,
} as const;
