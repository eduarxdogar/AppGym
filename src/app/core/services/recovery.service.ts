import { Injectable, inject, Signal, computed, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { StorageService } from './storage.service';
import { UserProfileStateService } from './user-profile-state.service';
import { WorkoutSession, RECOVERY_CONSTANTS, FATIGUE_SCORES, WorkoutExercise, WorkoutSet, MuscleStatus } from '../models/workout-history.model';
import { LoggerService } from './logger.service';
export type { MuscleStatus };

@Injectable({
  providedIn: 'root'
})
export class RecoveryService {
  private readonly userProfileState = inject(UserProfileStateService);
  private readonly logger = inject(LoggerService);

  /**
   * Canonical list of tracked muscle groups.
   * 'Hombros' has been split into its three anatomical heads to prevent
   * false fatigue alerts caused by treating the entire deltoid as one block.
   */
  private readonly MAIN_MUSCLES = [
    'Pecho', 'Espalda',
    'Hombro Anterior', 'Hombro Lateral', 'Hombro Posterior',
    'Bíceps', 'Tríceps', 'Antebrazos',
    'Cuádriceps', 'Isquios', 'Glúteos', 'Gemelos',
    'Core', 'Trapecio', 'Lumbares'
  ];

  /**
   * Maps raw exercise tags (from Firestore / AI output) to canonical muscle names.
   * Generic 'shoulders'/'hombros' maps to Hombro Lateral (the most commonly targeted head
   * in generic shoulder work). Specific tags map to their precise head.
   */
  private readonly MUSCLE_MAP: Record<string, string> = {
    // Pecho
    'pecho': 'Pecho', 'chest': 'Pecho', 'pectorales': 'Pecho',
    // Espalda
    'espalda': 'Espalda', 'back': 'Espalda', 'dorsales': 'Espalda',
    // Deltoides — generic tag → Hombro Lateral (default head for neutral shoulder work)
    'hombros': 'Hombro Lateral', 'shoulders': 'Hombro Lateral', 'deltoides': 'Hombro Lateral',
    // Deltoides — specific head tags
    'hombro anterior': 'Hombro Anterior', 'deltoides anterior': 'Hombro Anterior',
    'anterior deltoid': 'Hombro Anterior', 'front delt': 'Hombro Anterior',
    'hombro lateral': 'Hombro Lateral', 'deltoides lateral': 'Hombro Lateral',
    'lateral deltoid': 'Hombro Lateral', 'side delt': 'Hombro Lateral',
    'hombro posterior': 'Hombro Posterior', 'deltoides posterior': 'Hombro Posterior',
    'rear delt': 'Hombro Posterior', 'posterior deltoid': 'Hombro Posterior',
    // Arms
    'bíceps': 'Bíceps', 'biceps': 'Bíceps',
    'tríceps': 'Tríceps', 'triceps': 'Tríceps',
    'antebrazos': 'Antebrazos', 'forearms': 'Antebrazos',
    // Legs
    'cuádriceps': 'Cuádriceps', 'quads': 'Cuádriceps', 'piernas': 'Cuádriceps',
    'isquios': 'Isquios', 'hamstrings': 'Isquios',
    'glúteos': 'Glúteos', 'glutes': 'Glúteos',
    'gemelos': 'Gemelos', 'calves': 'Gemelos',
    // Core / back
    'core': 'Core', 'abs': 'Core', 'abdominales': 'Core',
    'trapecio': 'Trapecio', 'traps': 'Trapecio',
    'lumbares': 'Lumbares', 'lower_back': 'Lumbares'
  };

  private readonly history = toSignal(
    inject(StorageService).getHistory().pipe(
      catchError(err => {
        this.logger.error('RecoveryService: Failed to fetch history', err);
        return of([] as WorkoutSession[]);
      })
    ),
    { initialValue: [] as WorkoutSession[] }
  );

  readonly muscleRecoveryStatus = computed(() => {
    const sessions = this.history() || [];
    return this.calculateFatigue(sessions);
  });

  private readonly _selectedMuscleName = signal<string | null>(null);
  readonly selectedMuscleName = this._selectedMuscleName.asReadonly();

  constructor() {}

  setSelectedMuscle(name: string | null) {
    this._selectedMuscleName.set(name);
  }

  getMuscleRecoveryStatus(): Signal<Map<string, MuscleStatus>> {
    return this.muscleRecoveryStatus;
  }

  private calculateFatigue(sessions: WorkoutSession[]): Map<string, MuscleStatus> {
    const statusMap = new Map<string, MuscleStatus>();
    const now = Date.now();

    const profile = this.userProfileState.profile();
    const inBodyScore = profile?.inbodyData?.score || 0;
    const recoveryMultiplier = inBodyScore >= RECOVERY_CONSTANTS.INBODY_THRESHOLD
      ? RECOVERY_CONSTANTS.RECOVERY_MULTIPLIER_ELITE
      : RECOVERY_CONSTANTS.RECOVERY_MULTIPLIER_NORMAL;

    const actualRecoveryPerHour = RECOVERY_CONSTANTS.BASE_RECOVERY_PER_HOUR * recoveryMultiplier;

    // Initialize map
    this.MAIN_MUSCLES.forEach(muscle => {
      statusMap.set(muscle, {
        name: muscle,
        percentage: 100,
        totalVolume: 0
      });
    });

    if (!sessions || sessions.length === 0) return statusMap;

    // Sort: Older sessions first
    const sortedSessions = [...sessions]
      .filter(s => s.endTime || s.startTime || s.fecha)
      .sort((a, b) => {
        const da = new Date(a.endTime || a.startTime || a.fecha || 0).getTime();
        const db = new Date(b.endTime || b.startTime || b.fecha || 0).getTime();
        return da - db;
      });

    const findTargetMuscle = (rawGroup: string | undefined): string | undefined => {
      if (!rawGroup) return undefined;

      const normalized = rawGroup.toLowerCase().trim();

      // 1. Exact case-insensitive match against MAIN_MUSCLES
      const exactMain = this.MAIN_MUSCLES.find(m => m.toLowerCase() === normalized);
      if (exactMain) return exactMain;

      // 2. Direct Map (Normalized)
      if (this.MUSCLE_MAP[normalized]) return this.MUSCLE_MAP[normalized];

      // 3. Fuzzy Match
      return this.MAIN_MUSCLES.find(m => {
        const internal = m.toLowerCase();
        return internal.includes(normalized) || normalized.includes(internal);
      });
    };

    this.logger.log(`[RecoveryService] Processing ${sessions.length} sessions for fatigue/volume`);

    sortedSessions.forEach(session => {
      const dateStr = session.endTime || session.startTime || session.fecha;
      if (!dateStr) return;

      const workoutDate = new Date(dateStr).getTime();
      const sessionStats = new Map<string, { fatigue: number, volume: number }>();

      const exercises: WorkoutExercise[] = session.exercises || session.ejercicios || [];
      this.logger.log(`[RecoveryService] Session date: ${dateStr}, Exercises: ${exercises.length}`);

      exercises.forEach((ex: WorkoutExercise) => {
        const group = ex.grupoMuscular || ex.groupMuscular || ex.muscleGroup;
        const target = findTargetMuscle(group);

        if (!target) {
          if (group) this.logger.warn(`[RecoveryService] Could not map group: "${group}"`);
          return;
        }

        // Ensure the muscle is registered in sessionStats even if sets are empty
        if (!sessionStats.has(target)) sessionStats.set(target, { fatigue: 0, volume: 0 });
        const stats = sessionStats.get(target)!;

        const sets: WorkoutSet[] = ex.sets || ex.series || [];
        sets.forEach((s: WorkoutSet) => {
          const isCompleted = s.completed !== false;
          if (!isCompleted) return;

          const reps = Number(s.reps || s.repeticiones || 0);
          const weight = Number(s.weight || s.peso || s.pesokg || 0);

          if (reps > 0) {
            const isWithin7Days = (now - workoutDate) <= RECOVERY_CONSTANTS.SEVEN_DAYS_MS;
            if (isWithin7Days) {
              stats.volume += (reps * weight);
            }
          }

          const type = (s.type || s.tipo || 'effective').toLowerCase();
          if (type.startsWith('t')) stats.fatigue += FATIGUE_SCORES.TOPSET;
          else if (type.startsWith('e')) stats.fatigue += FATIGUE_SCORES.EFFECTIVE;
          else if (type.startsWith('b')) stats.fatigue += FATIGUE_SCORES.BACKOFF;
          else if (type.startsWith('w')) stats.fatigue += FATIGUE_SCORES.WARMUP;
          else stats.fatigue += FATIGUE_SCORES.DEFAULT;
        });

        // Guarantee minimum session fatigue: any muscle appearing in a workout
        // takes at least a baseline impact of 10%.
        const MIN_SESSION_FATIGUE = 10;
        if (stats.fatigue < MIN_SESSION_FATIGUE) {
          stats.fatigue = MIN_SESSION_FATIGUE;
        }
      });

      // Update global map from session stats
      sessionStats.forEach((stats, muscle) => {
        const current = statusMap.get(muscle);
        if (!current) return;

        // Recover since last workout
        if (current.lastWorkoutDate) {
          const hours = (workoutDate - current.lastWorkoutDate.getTime()) / RECOVERY_CONSTANTS.MS_PER_HOUR;
          if (hours > 0) {
            current.percentage = Math.min(100, current.percentage + (hours * actualRecoveryPerHour));
          }
        }

        current.percentage = Math.max(0, current.percentage - stats.fatigue);
        current.totalVolume = (current.totalVolume || 0) + stats.volume;
        current.lastWorkoutDate = new Date(workoutDate);
      });

      // ── CROSS-FATIGUE PASS ──────────────────────────────────────────────────
      // Biomechanically correct spillover: compound movements for one muscle
      // mechanically stress adjacent deltoid heads.
      //   • Pecho (horizontal push)  → stresses Hombro Anterior (30%)
      //   • Espalda (horizontal pull) → stresses Hombro Posterior (25%)
      // Applied as a secondary pass AFTER session stats are committed,
      // so primary muscle fatigue is preserved intact.
      this.applyCrossFatigue(sessionStats, statusMap, workoutDate);
    });

    // Post-calculation: Final recovery pass up to current time
    statusMap.forEach(status => {
      if (status.lastWorkoutDate) {
        const hoursSince = (now - status.lastWorkoutDate.getTime()) / RECOVERY_CONSTANTS.MS_PER_HOUR;
        if (hoursSince > 0) {
          status.percentage = Math.min(100, status.percentage + (hoursSince * actualRecoveryPerHour));
        }

        // DECAY FIX: Enforce minimum fatigue lockout
        if (hoursSince < RECOVERY_CONSTANTS.MIN_RECOVERY_HOURS_CAP) {
          status.percentage = Math.min(status.percentage, 90);
        } else if (hoursSince < RECOVERY_CONSTANTS.FULL_RECOVERY_HOURS) {
          status.percentage = Math.min(status.percentage, 99);
        }
      }
      status.percentage = Math.round(status.percentage);
    });

    return statusMap;
  }

  /**
   * Applies biomechanical cross-fatigue to deltoid heads based on compound lifts:
   *  - Chest session  → Hombro Anterior loses (chestFatigue × 0.30)
   *  - Back session   → Hombro Posterior loses (backFatigue × 0.25)
   *
   * @param sessionStats   Fatigue data from the current session (muscle → stats)
   * @param statusMap      Global recovery map being mutated
   * @param workoutDate    Timestamp of the session for lastWorkoutDate tracking
   */
  private applyCrossFatigue(
    sessionStats: Map<string, { fatigue: number; volume: number }>,
    statusMap: Map<string, MuscleStatus>,
    workoutDate: number
  ): void {
    // Chest → Hombro Anterior
    const chestStats = sessionStats.get('Pecho');
    if (chestStats && chestStats.fatigue > 0) {
      const spillover = chestStats.fatigue * 0.30;
      const anterior = statusMap.get('Hombro Anterior');
      if (anterior) {
        anterior.percentage = Math.max(0, anterior.percentage - spillover);
        // Update lastWorkoutDate so recovery clock ticks correctly
        if (!anterior.lastWorkoutDate || workoutDate > anterior.lastWorkoutDate.getTime()) {
          anterior.lastWorkoutDate = new Date(workoutDate);
        }
      }
    }

    // Back → Hombro Posterior
    const backStats = sessionStats.get('Espalda');
    if (backStats && backStats.fatigue > 0) {
      const spillover = backStats.fatigue * 0.25;
      const posterior = statusMap.get('Hombro Posterior');
      if (posterior) {
        posterior.percentage = Math.max(0, posterior.percentage - spillover);
        if (!posterior.lastWorkoutDate || workoutDate > posterior.lastWorkoutDate.getTime()) {
          posterior.lastWorkoutDate = new Date(workoutDate);
        }
      }
    }
  }
}

