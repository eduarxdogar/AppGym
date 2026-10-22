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
  lastWorkoutDate?: Date;
  totalVolume?: number;
  recoveryEtaHours?: number;
}

export type {
  WorkoutSession,
  WorkoutSessionExercise as WorkoutExercise,
  WorkoutSessionSet as WorkoutSet
} from './workout-session.model';

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
