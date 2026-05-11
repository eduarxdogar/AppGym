import { Injectable, inject, Signal, computed, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { StorageService } from './storage.service';
import { UserProfileStateService } from './user-profile-state.service';
import { WorkoutSession, RECOVERY_CONSTANTS, FATIGUE_SCORES, WorkoutExercise, WorkoutSet, MuscleStatus } from '../models/workout-history.model';
export type { MuscleStatus };

@Injectable({
  providedIn: 'root'
})
export class RecoveryService {
  private readonly userProfileState = inject(UserProfileStateService);

  private readonly MAIN_MUSCLES = [
    'Pecho', 'Espalda', 'Hombros', 
    'Bíceps', 'Tríceps', 'Antebrazos',
    'Cuádriceps', 'Isquios', 'Glúteos', 'Gemelos', 
    'Core', 'Trapecio', 'Lumbares'
  ];

  // Mapping for Firestore tags to internal names
  private readonly MUSCLE_MAP: Record<string, string> = {
    'pecho': 'Pecho', 'chest': 'Pecho', 'pectorales': 'Pecho',
    'espalda': 'Espalda', 'back': 'Espalda', 'dorsales': 'Espalda',
    'hombros': 'Hombros', 'shoulders': 'Hombros', 'deltoides': 'Hombros',
    'bíceps': 'Bíceps', 'biceps': 'Bíceps',
    'tríceps': 'Tríceps', 'triceps': 'Tríceps',
    'antebrazos': 'Antebrazos', 'forearms': 'Antebrazos',
    'cuádriceps': 'Cuádriceps', 'quads': 'Cuádriceps', 'piernas': 'Cuádriceps',
    'isquios': 'Isquios', 'hamstrings': 'Isquios',
    'glúteos': 'Glúteos', 'glutes': 'Glúteos',
    'gemelos': 'Gemelos', 'calves': 'Gemelos',
    'core': 'Core', 'abs': 'Core', 'abdominales': 'Core',
    'trapecio': 'Trapecio', 'traps': 'Trapecio',
    'lumbares': 'Lumbares', 'lower_back': 'Lumbares'
  };

  private readonly history = toSignal(
    inject(StorageService).getHistory().pipe(
      catchError(err => {
        console.error('RecoveryService: Failed to fetch history', err);
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
        color: 'green',
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
        
        // 1. Exact Match (Highest Priority - Case Sensitive)
        if (this.MAIN_MUSCLES.includes(rawGroup)) return rawGroup;
        
        const normalized = rawGroup.toLowerCase().trim();
        
        // 2. Direct Map (Normalized)
        if (this.MUSCLE_MAP[normalized]) return this.MUSCLE_MAP[normalized];
        
        // 3. Fuzzy Match
        return this.MAIN_MUSCLES.find(m => {
            const internal = m.toLowerCase();
            return internal === normalized || internal.includes(normalized) || normalized.includes(internal);
        });
    };

    console.log(`[RecoveryService] Processing ${sessions.length} sessions for fatigue/volume`);

    sortedSessions.forEach(session => {
        const dateStr = session.endTime || session.startTime || session.fecha;
        if (!dateStr) return;

        const workoutDate = new Date(dateStr).getTime();
        const sessionStats = new Map<string, { fatigue: number, volume: number }>();

        const exercises: WorkoutExercise[] = session.exercises || session.ejercicios || [];
        console.log(`[RecoveryService] Session date: ${dateStr}, Exercises: ${exercises.length}`);

        exercises.forEach((ex: WorkoutExercise) => {
            const group = ex.grupoMuscular || ex.groupMuscular || ex.muscleGroup;
            const target = findTargetMuscle(group);
            
            if (!target) {
              if (group) console.warn(`[RecoveryService] Could not map group: "${group}"`);
              return;
            }

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
        });

        // Update global map
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
    });

    // Post-calculation: Final recovery pass up to current time
    statusMap.forEach(status => {
        if (status.lastWorkoutDate) {
            const hours = (now - status.lastWorkoutDate.getTime()) / RECOVERY_CONSTANTS.MS_PER_HOUR;
            if (hours > 0) {
                status.percentage = Math.min(100, status.percentage + (hours * actualRecoveryPerHour));
            }
        }
        status.percentage = Math.round(status.percentage);
        status.color = this.getColorForPercentage(status.percentage);
    });

    return statusMap;
  }

  getColorForPercentage(percent: number): string {
    if (percent <= 30) return 'red';
    if (percent <= 75) return 'yellow';
    return 'green';
  }
}

