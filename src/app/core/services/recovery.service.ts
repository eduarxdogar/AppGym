import { Injectable, inject, Signal, computed, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { StorageService } from './storage.service';
import { UserProfileStateService } from './user-profile-state.service';
import { TrainingClockService } from './training-clock.service';
import { WorkoutSession, RECOVERY_CONSTANTS, FATIGUE_SCORES, MuscleStatus } from '../models/workout-history.model';
import { MUSCLES, Muscle, canonicalMuscle, statusForMesh } from '../models/muscle-taxonomy';
import { completedExerciseLoads } from '../utils/workout-session.utils';
import { LoggerService } from './logger.service';
export type { MuscleStatus };

@Injectable({ providedIn: 'root' })
export class RecoveryService {
  private readonly profileState = inject(UserProfileStateService);
  private readonly clock = inject(TrainingClockService);
  private readonly logger = inject(LoggerService);
  private readonly history = toSignal(inject(StorageService).getHistory().pipe(
    catchError(error => {
      this.logger.error('RecoveryService: Failed to fetch history', error);
      return of([] as WorkoutSession[]);
    })
  ), { initialValue: [] as WorkoutSession[] });

  readonly muscleRecoveryStatus = computed(() => this.calculateFatigue(this.history(), Math.max(this.clock.now(), Date.now())));
  private readonly selectedName = signal<string | null>(null);
  readonly selectedMuscleName = this.selectedName.asReadonly();

  setSelectedMuscle(name: string | null): void {
    this.selectedName.set(canonicalMuscle(name) ?? null);
  }

  getMuscleRecoveryStatus(): Signal<Map<string, MuscleStatus>> { return this.muscleRecoveryStatus; }

  getStatusForMesh(meshName: string): MuscleStatus | undefined {
    return statusForMesh(meshName, this.muscleRecoveryStatus());
  }

  private calculateFatigue(sessions: WorkoutSession[], now: number): Map<string, MuscleStatus> {
    const result = new Map<string, MuscleStatus>(MUSCLES.map(name => [name, {
      name, percentage: 100, totalVolume: 0, recoveryEtaHours: 0
    }]));
    const multiplier = (this.profileState.profile()?.inbodyData?.score ?? 0) >= RECOVERY_CONSTANTS.INBODY_THRESHOLD
      ? RECOVERY_CONSTANTS.RECOVERY_MULTIPLIER_ELITE : RECOVERY_CONSTANTS.RECOVERY_MULTIPLIER_NORMAL;
    const rate = RECOVERY_CONSTANTS.BASE_RECOVERY_PER_HOUR * multiplier;
    const chronological = sessions.map(session => ({ session, time: new Date(session.endTime ?? session.startTime ?? session.fecha ?? '').getTime() }))
      .filter(item => Number.isFinite(item.time) && item.time <= now).sort((a, b) => a.time - b.time);

    for (const { session, time } of chronological) {
      const impacts = new Map<Muscle, { fatigue: number; volume: number }>();
      const add = (muscle: Muscle, fatigue: number, volume: number) => {
        const current = impacts.get(muscle) ?? { fatigue: 0, volume: 0 };
        impacts.set(muscle, { fatigue: current.fatigue + fatigue, volume: current.volume + volume });
      };
      for (const exercise of session.exercises ?? session.ejercicios ?? []) {
        for (const load of completedExerciseLoads(exercise)) {
          const muscle = canonicalMuscle(load.grupoMuscular);
          const volume = load.weight * load.reps;
          if (!muscle || volume <= 0) continue;
          const type = load.type.toLowerCase();
          const fatigue = type.startsWith('t') ? FATIGUE_SCORES.TOPSET : type.startsWith('b') ? FATIGUE_SCORES.BACKOFF
            : type.startsWith('w') ? FATIGUE_SCORES.WARMUP : FATIGUE_SCORES.EFFECTIVE;
          add(muscle, fatigue, now - time <= RECOVERY_CONSTANTS.SEVEN_DAYS_MS ? volume : 0);
          if (muscle === 'Pecho') add('Hombro Anterior', fatigue * 0.30, 0);
          if (muscle === 'Espalda') add('Hombro Posterior', fatigue * 0.25, 0);
        }
      }
      // Primary and secondary impacts share the same chronological recovery step.
      for (const [muscle, impact] of impacts) {
        const status = result.get(muscle)!;
        const elapsed = status.lastWorkoutDate ? Math.max(0, time - status.lastWorkoutDate.getTime()) / RECOVERY_CONSTANTS.MS_PER_HOUR : 0;
        status.percentage = Math.max(0, Math.min(100, status.percentage + elapsed * rate) - impact.fatigue);
        status.totalVolume = (status.totalVolume ?? 0) + impact.volume;
        status.lastWorkoutDate = new Date(time);
      }
    }
    for (const status of result.values()) {
      if (!status.lastWorkoutDate) continue;
      const hours = Math.max(0, now - status.lastWorkoutDate.getTime()) / RECOVERY_CONSTANTS.MS_PER_HOUR;
      status.percentage = Math.min(100, status.percentage + hours * rate);
      status.recoveryEtaHours = status.percentage >= 100 ? 0 : Math.ceil((100 - status.percentage) / rate);
      status.percentage = Math.floor(status.percentage + 1e-9);
    }
    return result;
  }
}
