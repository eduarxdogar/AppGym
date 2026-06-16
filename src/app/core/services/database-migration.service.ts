import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  getDocs,
  writeBatch,
  doc,
  query,
  where,
  UpdateData,
} from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { WorkoutSession, MIGRATION_SENTINELS } from '../models/workout-history.model';

/** Maximum Firestore writes per batch (hard limit: 500). We use 450 for safety. */
const BATCH_SIZE = 450;

/**
 * Muscle group values in legacy data that must be remapped to the new
 * three-head deltoid taxonomy introduced in the deltoid refactor.
 */
const MUSCLE_MIGRATION_MAP: Record<string, string> = {
  // Legacy generic shoulder tags → safe default: Hombro Lateral
  'hombros': 'Hombro Lateral',
  'shoulders': 'Hombro Lateral',
  'deltoides': 'Hombro Lateral',
  'hombro': 'Hombro Lateral',
  'shoulder': 'Hombro Lateral',
};

export interface MigrationReport {
  totalRead: number;
  totalPatched: number;
  totalSkipped: number;
  batchesCommitted: number;
  errors: string[];
  durationMs: number;
}

@Injectable({ providedIn: 'root' })
export class DatabaseMigrationService {
  private readonly firestore = inject(Firestore);
  private readonly authService = inject(AuthService);

  /**
   * Migrates all legacy `workout_history` documents for the current user.
   *
   * WHAT IT DOES:
   *  1. Backfills `originWorkoutId` — tries to match active plan workouts by
   *     name; falls back to MIGRATION_SENTINELS.WORKOUT_ID.
   *  2. Backfills `microcycleId` — assigns MIGRATION_SENTINELS.MICROCYCLE_ID.
   *  3. Remaps exercise `grupoMuscular` values that contain legacy shoulder
   *     tags ('hombros', 'deltoides', etc.) to the new three-head taxonomy.
   *
   * SAFE TO RE-RUN: Documents that already have `originWorkoutId` set are
   * skipped entirely (idempotent).
   *
   * COST OPTIMIZED: Uses Firestore WriteBatch (max 450 ops per batch) to
   * minimise round-trips. All reads happen upfront; writes are batched.
   */
  async migrateLegacyWorkoutHistory(): Promise<MigrationReport> {
    const t0 = Date.now();
    const report: MigrationReport = {
      totalRead: 0,
      totalPatched: 0,
      totalSkipped: 0,
      batchesCommitted: 0,
      errors: [],
      durationMs: 0,
    };

    const user = this.authService.currentUser();
    if (!user) {
      report.errors.push('No authenticated user. Aborting migration.');
      report.durationMs = Date.now() - t0;
      return report;
    }

    try {
      // ── 1. LOAD ACTIVE PLAN WORKOUTS (for name-based ID matching) ────────
      const workoutsCol = collection(this.firestore, 'workouts');
      const workoutsSnap = await getDocs(
        query(workoutsCol, where('userId', '==', user.uid))
      );

      /** Map: workout nombre (lowercase) → workout Firestore document ID */
      const nameToWorkoutId = new Map<string, string>();
      workoutsSnap.forEach(d => {
        const data = d.data();
        if (data['nombre']) {
          nameToWorkoutId.set(String(data['nombre']).toLowerCase().trim(), d.id);
        }
      });

      console.log(
        `[Migration] Loaded ${nameToWorkoutId.size} active plan workouts for ID matching.`
      );

      // ── 2. LOAD ALL HISTORY SESSIONS ─────────────────────────────────────
      const historyCol = collection(this.firestore, 'workout_history');
      const historySnap = await getDocs(
        query(historyCol, where('userId', '==', user.uid))
      );

      report.totalRead = historySnap.size;
      console.log(`[Migration] Read ${report.totalRead} history documents.`);

      // Collect documents that need patching
      const toPatch: Array<{ id: string; patch: Partial<WorkoutSession> & Record<string, unknown> }> = [];

      historySnap.forEach(docSnap => {
        const data = docSnap.data() as WorkoutSession;

        // Skip already-migrated documents (idempotent guard)
        if (data.originWorkoutId !== undefined) {
          report.totalSkipped++;
          return;
        }

        const patch: Record<string, unknown> = {};

        // ── Backfill originWorkoutId ─────────────────────────────────────
        const sessionName = (data.nombre ?? '').toLowerCase().trim();
        const matchedId = sessionName ? nameToWorkoutId.get(sessionName) : undefined;
        patch['originWorkoutId'] = matchedId ?? MIGRATION_SENTINELS.WORKOUT_ID;

        // ── Backfill microcycleId ────────────────────────────────────────
        if (data.microcycleId === undefined) {
          patch['microcycleId'] = MIGRATION_SENTINELS.MICROCYCLE_ID;
        }

        // ── Remap legacy shoulder muscle groups in exercises ─────────────
        const exercises: unknown[] = (data.exercises ?? data.ejercicios ?? []) as unknown[];
        let exercisesWerePatched = false;

        const migratedExercises = exercises.map((ex: any) => {
          const raw: string = (ex.grupoMuscular ?? ex.groupMuscular ?? ex.muscleGroup ?? '').toLowerCase().trim();
          const remapped = MUSCLE_MIGRATION_MAP[raw];
          if (remapped) {
            exercisesWerePatched = true;
            return { ...ex, grupoMuscular: remapped };
          }
          return ex;
        });

        if (exercisesWerePatched) {
          // Patch whichever field the doc actually uses
          if (data.exercises !== undefined) {
            patch['exercises'] = migratedExercises;
          } else {
            patch['ejercicios'] = migratedExercises;
          }
        }

        toPatch.push({ id: docSnap.id, patch });
      });

      console.log(
        `[Migration] ${toPatch.length} documents need patching, ` +
        `${report.totalSkipped} already migrated (skipped).`
      );

      // ── 3. COMMIT IN BATCHES ──────────────────────────────────────────────
      for (let i = 0; i < toPatch.length; i += BATCH_SIZE) {
        const chunk = toPatch.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(this.firestore);

        chunk.forEach(({ id, patch }) => {
          const ref = doc(historyCol, id);
          batch.update(ref, patch as UpdateData<WorkoutSession>);
        });

        await batch.commit();
        report.batchesCommitted++;
        report.totalPatched += chunk.length;
        console.log(
          `[Migration] Batch ${report.batchesCommitted} committed (${chunk.length} docs).`
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Migration] Fatal error:', msg);
      report.errors.push(msg);
    }

    report.durationMs = Date.now() - t0;
    console.log('[Migration] Complete:', report);
    return report;
  }
}
