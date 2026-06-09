/**
 * workout-history.model.ts
 *
 * RETROCOMPATIBILITY CONTRACT
 * ──────────────────────────────────────────────────────────────────────────
 * All fields added after v1 must remain optional (?) so that legacy
 * Firestore documents written before those fields existed are never
 * rejected by the TypeScript layer.
 *
 * Fields that are new post-migration (microcycleId, originWorkoutId) are
 * always optional. Services that read them must handle `undefined` gracefully
 * and use the LEGACY_* sentinel constants to detect un-migrated docs.
 */

/** Sentinel values injected by the migration script into legacy documents. */
export const MIGRATION_SENTINELS = {
  MICROCYCLE_ID: 'legacy-cycle',
  WORKOUT_ID: 'legacy-workout',
} as const;

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
  /**
   * Canonical muscle group.
   * Legacy docs may contain raw values like 'hombros' — the migration
   * backfills these, but all consuming code must also handle them via
   * RecoveryService.MUSCLE_MAP.
   */
  grupoMuscular?: string;
  groupMuscular?: string;
  muscleGroup?: string;
  sets?: WorkoutSet[];
  series?: WorkoutSet[];
  /** Advanced set type, preserved across microcycle rollover. */
  tipos?: 'normal' | 'top-set' | 'back-set' | 'drop-set' | 'super-serie';
}

export interface WorkoutSession {
  id?: string;
  userId?: string;
  /**
   * Links this session to a specific microcycle plan document.
   * Set when the session is completed from a planned Workout.
   * Legacy docs that were not migrated will have this field undefined or
   * set to MIGRATION_SENTINELS.MICROCYCLE_ID ('legacy-cycle').
   */
  microcycleId?: string;
  /**
   * ID of the source Workout plan document this session was executed from.
   * Enables the progression engine to match sessions to their plan workout
   * without relying solely on name matching.
   * Legacy docs: undefined or MIGRATION_SENTINELS.WORKOUT_ID ('legacy-workout').
   */
  originWorkoutId?: string;
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
