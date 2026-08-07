import { Injectable, signal, computed, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { Workout } from '../../models/workout.model';
import { WorkoutService } from '../../services/workout.service';
import { TrainingSessionService } from '../../services/training-session.service';
import { TrainingHistoryService } from '../../services/training-history.service';
import { RestTimerService } from '../../services/rest-timer.service';
import { WorkoutSession, WorkoutSessionExercise } from '../../models/workout-session.model';
import { Firestore, collection, doc, deleteField } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { ToastService } from '../../../../core/services/toast.service';
import { StrictSessionValidationSchema } from '../../models/schemas/session.schema';
import { UserProfileService } from '../../../account/services/user-profile.service';
import { UserProfileStateService } from '../../../account/services/user-profile-state.service';
import { RecoveryService } from '../../../metrics/services/recovery.service';
export interface DropSet {
  reps: number;
  weight: number;
  superReps?: number;
  superWeight?: number;
}

export interface WorkoutSet {
  type?: 'warmup' | 'effective' | 'topset' | 'backoff';
  reps: number;
  weight: number;
  completed: boolean;
  dropSets?: DropSet[];
  superReps?: number;
  superWeight?: number;
}

@Injectable({
  providedIn: 'root'
})
export class WorkoutSessionService {
  private readonly workoutService = inject(WorkoutService);
  private readonly trainingSessionService = inject(TrainingSessionService);
  private readonly trainingHistoryService = inject(TrainingHistoryService);
  public readonly restTimer = inject(RestTimerService);
  private readonly firestore = inject(Firestore);
  private readonly injector = inject(EnvironmentInjector);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly userProfileService = inject(UserProfileService);
  private readonly userProfileState = inject(UserProfileStateService);
  private readonly recoveryService = inject(RecoveryService);

  // State
  workout = signal<Workout | null>(null);
  activeSets = signal<Map<number, WorkoutSet[]>>(new Map());
  isActive = signal<boolean>(false);
  sessionSeconds = signal<number>(0);
  
  private sessionStartTime: number | null = null;
  private sessionInterval: ReturnType<typeof setInterval> | null = null;

  // Computed
  sessionTimeFormatted = computed(() => {
    const totalSeconds = this.sessionSeconds();
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const pad = (n: number) => n < 10 ? '0' + n : String(n);
    return hrs > 0
      ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}`
      : `${pad(mins)}:${pad(secs)}`;
  });

  timerProgress = computed(() => {
    const elapsed = this.sessionSeconds();
    const target = 3600; // 1 hour goal
    return Math.min((elapsed / target) * 100, 100);
  });

  loadWorkout(workoutId: string) {
    const w = this.workoutService.getWorkoutById(workoutId)();
    this.workout.set(w || null);
    
    if (w) {
      if (w.status === 'active' && !this.isActive()) {
        this.restoreActiveSession(w);
      } else if (this.activeSets().size === 0) {
        this.initializeSets(w);
      }
    }
  }

  initializeSets(w: Workout) {
    const initialMap = new Map<number, WorkoutSet[]>();
    w.ejercicios.forEach((ex, index) => {
      const sets: WorkoutSet[] = [];
      const targetSets = ex.series || 3;
      for (let i = 0; i < targetSets; i++) {
        const isWarmup = i < 2;
        sets.push({
          type: isWarmup ? 'warmup' : 'effective',
          reps: ex.repeticiones || 10,
          weight: ex.pesokg || 0,
          completed: false,
          dropSets: [],
          superReps: (!isWarmup && ex.superSetEjercicio) ? (ex.superSetEjercicio.repeticiones || 10) : undefined,
          superWeight: (!isWarmup && ex.superSetEjercicio) ? (ex.superSetEjercicio.pesokg || 0) : undefined
        });
      }
      initialMap.set(index, sets);
    });
    this.activeSets.set(initialMap);
  }

  private restoreActiveSession(w: Workout) {
    this.isActive.set(true);
    const startTime = w.activeStartTime ? new Date(w.activeStartTime).getTime() : Date.now();
    this.sessionStartTime = startTime;
    
    const elapsed = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
    this.sessionSeconds.set(elapsed);
    this.startSessionTimer();

    if (w.activeSetsState && Object.keys(w.activeSetsState).length > 0) {
      const restoredMap = new Map<number, WorkoutSet[]>();
      Object.entries(w.activeSetsState).forEach(([key, sets]) => {
        restoredMap.set(Number(key), sets as WorkoutSet[]);
      });
      this.activeSets.set(restoredMap);
    } else {
      this.initializeSets(w);
    }
    this.trainingSessionService.startSession(w);
  }

  startSessionTimer() {
    if (this.sessionInterval) clearInterval(this.sessionInterval);
    if (!this.sessionStartTime) {
      this.sessionStartTime = Date.now();
    }
    this.sessionInterval = setInterval(() => {
      if (!this.sessionStartTime) return;
      const now = Date.now();
      const elapsed = Math.floor((now - this.sessionStartTime) / 1000);
      this.sessionSeconds.set(elapsed);
    }, 1000);
  }

  stopSessionTimer() {
    if (this.sessionInterval) {
      clearInterval(this.sessionInterval);
      this.sessionInterval = null;
    }
  }

  startRoutine() {
    const w = this.workout();
    if (!w) return;
    this.isActive.set(true);

    if (this.sessionInterval) {
      clearInterval(this.sessionInterval);
      this.sessionInterval = null;
    }
    this.sessionSeconds.set(0);

    const startTimeStr = new Date().toISOString();
    this.sessionStartTime = new Date(startTimeStr).getTime();
    this.startSessionTimer();
    this.trainingSessionService.startSession(w);
    
    this.persistWorkoutChanges({
      ...w,
      status: 'active',
      activeStartTime: startTimeStr
    });
  }

  async persistWorkoutChanges(overrideWorkout?: Workout): Promise<void> {
    const w = overrideWorkout ?? this.workout();
    if (!w) return;
    try {
      await this.workoutService.updateWorkout(w);
    } catch (err) {
      console.error('Error persisting workout changes:', err);
    }
  }

  async persistSetsState(): Promise<void> {
    const w = this.workout();
    if (!w || !this.isActive()) return;
    const setsRecord: Record<number, WorkoutSet[]> = {};
    this.activeSets().forEach((sets, key) => { setsRecord[key] = sets; });
    await this.persistWorkoutChanges({ ...w, activeSetsState: setsRecord });
  }

  getSetsForExercise(index: number): WorkoutSet[] {
    return this.activeSets().get(index) || [];
  }

  addSet(index: number) {
    const map = new Map(this.activeSets());
    const current = map.get(index) || [];
    const type = current.length < 2 ? 'warmup' : 'effective';
    const last = current.at(-1) ?? { type, reps: 0, weight: 0, completed: false, dropSets: [] };
    
    current.push({ ...last, type, completed: false, dropSets: [], superReps: undefined, superWeight: undefined });
    map.set(index, current);
    this.activeSets.set(map);
    this.persistSetsState();
  }

  deleteSet(exIndex: number, setIndex: number) {
    const map = new Map(this.activeSets());
    const sets = map.get(exIndex);
    if (sets && sets.length > 1) {
      sets.splice(setIndex, 1);
      map.set(exIndex, sets);
      this.activeSets.set(map);
      this.persistSetsState();
    }
  }

  toggleSetType(exIndex: number, setIndex: number) {
    const map = new Map(this.activeSets());
    const current = map.get(exIndex);
    const s = current?.[setIndex];
    if (s) {
      const typeMap: Record<string, 'warmup' | 'effective' | 'topset' | 'backoff'> = {
        'warmup': 'effective',
        'effective': 'topset',
        'topset': 'backoff',
        'backoff': 'warmup'
      };
      s.type = typeMap[s.type || 'effective'];
      map.set(exIndex, current);
      this.activeSets.set(map);
      this.persistSetsState();
    }
  }

  toggleSetComplete(exIndex: number, setIndex: number, onComplete?: (seconds: number) => void) {
    const map = new Map(this.activeSets());
    const sets = map.get(exIndex);
    if (!sets?.[setIndex]) return;

    const isNowCompleted = !sets[setIndex].completed;
    sets[setIndex].completed = isNowCompleted;
    map.set(exIndex, sets);
    this.activeSets.set(map);
    this.persistSetsState();

    if (isNowCompleted && onComplete) {
      const ex = this.workout()?.ejercicios[exIndex];
      const seconds = this.parseRestTimeSeconds(ex?.descanso);
      onComplete(seconds);
    }
  }

  private parseRestTimeSeconds(descanso: string | number | undefined): number {
    if (!descanso) return 90;
    const match = /^(\d+)\s*([sm])/i.exec(String(descanso).trim());
    if (match) {
      const val = Number.parseInt(match[1], 10);
      return match[2].toLowerCase() === 'm' ? val * 60 : val;
    }
    return Number(descanso) || 90;
  }

  updateSetWeight(exIndex: number, setIndex: number, weight: number) {
    const map = new Map(this.activeSets());
    const sets = map.get(exIndex);
    if (sets?.[setIndex]) {
      sets[setIndex].weight = weight;
      this.activeSets.set(map);
      this.persistSetsState();
    }
  }

  updateSetReps(exIndex: number, setIndex: number, reps: number) {
    const map = new Map(this.activeSets());
    const sets = map.get(exIndex);
    if (sets?.[setIndex]) {
      sets[setIndex].reps = reps;
      this.activeSets.set(map);
      this.persistSetsState();
    }
  }
  
  updateDropSet(exIndex: number, setIndex: number, dropIndex: number, weight: number, reps: number) {
      const map = new Map(this.activeSets());
      const current = map.get(exIndex);
      const dropSets = current?.[setIndex]?.dropSets;
      if (current && dropSets?.[dropIndex]) {
          dropSets[dropIndex].weight = weight;
          dropSets[dropIndex].reps = reps;
          map.set(exIndex, current);
          this.activeSets.set(map);
          this.persistSetsState();
      }
  }

  toggleSupersetForSet(exIndex: number, setIndex: number) {
    const map = new Map(this.activeSets());
    const current = map.get(exIndex);
    const w = this.workout();
    const s = current?.[setIndex];
    if (s && w) {
      if (s.superWeight !== undefined || s.superReps !== undefined) {
        s.superWeight = undefined;
        s.superReps = undefined;
      } else {
        const ex = w.ejercicios[exIndex];
        s.superWeight = ex.superSetEjercicio?.pesokg || 0;
        s.superReps = ex.superSetEjercicio?.repeticiones || 10;
      }
      map.set(exIndex, current);
      this.activeSets.set(map);
      this.persistSetsState();
    }
  }
  
  clearSupersetData(exIndex: number, setIndex: number) {
      const map = new Map(this.activeSets());
      const current = map.get(exIndex);
      const s = current?.[setIndex];
      if (s) {
          delete s.superWeight;
          delete s.superReps;
          map.set(exIndex, current);
          this.activeSets.set(map);
          this.persistSetsState();
          this.toastService.showInfo('Superserie quitada de este set');
      }
  }

  addDropSet(exIndex: number) {
    const map = new Map(this.activeSets());
    const current = map.get(exIndex) || [];
    let targetSetIndex = -1;
    for (let i = current.length - 1; i >= 0; i--) {
      if (current[i].type === 'effective' || current[i].type === undefined) {
        targetSetIndex = i;
        break;
      }
    }
    if (targetSetIndex === -1 && current.length > 0) {
      targetSetIndex = current.length - 1;
    }
    if (targetSetIndex !== -1) {
      const targetSet = current[targetSetIndex];
      targetSet.dropSets ??= [];
      const baseForDrop = targetSet.dropSets.at(-1) ?? targetSet;
      const dropWeight = Math.floor((baseForDrop.weight || 0) * 0.8);
      const newReps = (baseForDrop.reps || 10) + 4;
      const newDropSet: DropSet = { reps: newReps, weight: dropWeight };
      if (baseForDrop.superReps !== undefined) {
        newDropSet.superWeight = Math.floor((baseForDrop.superWeight || 0) * 0.8);
        newDropSet.superReps = (baseForDrop.superReps || 10) + 4;
      }
      targetSet.dropSets.push(newDropSet);
    }
    map.set(exIndex, current);
    this.activeSets.set(map);
    this.persistSetsState();
  }

  deleteDropSet(exIndex: number, setIndex: number, dropIndex: number) {
    const map = new Map(this.activeSets());
    const current = map.get(exIndex);
    const dropSets = current?.[setIndex]?.dropSets;
    if (current && dropSets) {
      dropSets.splice(dropIndex, 1);
      map.set(exIndex, current);
      this.activeSets.set(map);
      this.persistSetsState();
    }
  }
  
  clearDropSetSupersetData(exIndex: number, setIndex: number, dropIndex: number) {
      const map = new Map(this.activeSets());
      const current = map.get(exIndex);
      const dropSets = current?.[setIndex]?.dropSets;
      if (current && dropSets?.[dropIndex]) {
          delete dropSets[dropIndex].superWeight;
          delete dropSets[dropIndex].superReps;
          map.set(exIndex, current);
          this.activeSets.set(map);
          this.persistSetsState();
          this.toastService.showInfo('Superserie quitada de este Drop Set');
      }
  }

  calculateTotalVolume(): number {
    let total = 0;
    this.activeSets().forEach(sets => {
      if (Array.isArray(sets)) {
        sets.forEach(s => {
          if (s.completed && s.reps && s.weight) {
             total += (s.reps * s.weight);
          }
        });
      }
    });
    return total;
  }

  async finalizeSession() {
    this.isActive.set(false);
    this.stopSessionTimer();
    this.restTimer.stop();
    
    const workout = this.workout();
    if (!workout) {
      this.router.navigate(['/weekly-plan']);
      return;
    }

    const startTime = this.trainingSessionService.getCurrentSession()?.fechaInicio || new Date();
    const sessionExercises: WorkoutSessionExercise[] = workout.ejercicios.map((ex, index) => {
      const sets = this.activeSets().get(index) || [];
      return {
        exerciseId: ex.id || index,
        name: ex.nombre,
        grupoMuscular: ex.grupoMuscular || '',
        targetSets: ex.series || 0,
        sets: sets.filter(s => s.completed).map(s => ({
          weight: s.weight,
          reps: s.reps,
          completed: s.completed,
          type: s.type
        }))
      };
    });

    const validationResult = StrictSessionValidationSchema.safeParse({ exercises: sessionExercises });
    if (!validationResult.success) {
      this.toastService.showError('Faltan campos por llenar. Asegúrate de ingresar KG y Repeticiones (> 0) en todas las series.');
      return;
    }

    const muscles = new Set<string>();
    workout.musculos?.forEach(m => muscles.add(m));
    workout.ejercicios.forEach(ex => {
      if (ex.grupoMuscular) muscles.add(ex.grupoMuscular);
    });

    const docId = runInInjectionContext(this.injector, () => {
      return doc(collection(this.firestore, 'dummy')).id;
    });

    const sessionVolume = this.calculateTotalVolume();

    const session: WorkoutSession = {
      id: docId,
      userId: '', 
      workoutId: workout.id,
      name: workout.nombre,
      startTime: startTime.toISOString(),
      endTime: new Date().toISOString(),
      duration: this.sessionTimeFormatted(),
      totalVolume: sessionVolume,
      musclesWorked: Array.from(muscles),
      exercises: sessionExercises,
      feeling: 'good',
      calories: Math.round((this.sessionSeconds() / 60 * 5) + (sessionVolume * 0.0005))
    };

    await this.trainingHistoryService.addSession(session);

    if (muscles.size > 0) {
      this.toastService.showSuccess(`Sesión guardada. Desgaste registrado en: ${Array.from(muscles).join(', ')}`);
    }

    const profile = this.userProfileState.profile();
    
    // Deduct base 20% system recovery per completed workout, floor at 0%
    let updatedSystemRecovery = profile?.systemRecovery ?? 100;
    updatedSystemRecovery = Math.max(0, updatedSystemRecovery - 20);

    // Calculate hydrated fatigue for target muscles
    const currentStatus = this.recoveryService.getMuscleRecoveryStatus()();
    const fatigueObj: Record<string, number> = { ...profile?.muscleFatigue };
    
    // Deduct 30% from each muscle worked in this session
    muscles.forEach(m => {
      const normalized = this.recoveryService.normalizeMuscleName(m);
      if (normalized) {
        const currentPercentage = currentStatus.get(normalized)?.percentage ?? 100;
        fatigueObj[normalized] = Math.max(0, currentPercentage - 30);
      }
    });

    const nowIso = new Date().toISOString();

    const updatedWorkout: Workout = {
      ...workout,
      ejercicios: workout.ejercicios.map((ex, index) => {
        const sets = this.activeSets().get(index) || [];
        return {
          ...ex,
          sets: sets.map(s => ({ ...s }))
        };
      }),
      isCompleted: true,
      completedAt: new Date().toISOString(),
      durationMinutes: Math.floor(this.sessionSeconds() / 60),
      status: 'completed',
      activeSetsState: deleteField() as any,
      activeStartTime: deleteField() as any
    };

    // Execute Firestore writes in parallel
    await runInInjectionContext(this.injector, async () => {
      await Promise.all([
        this.workoutService.updateWorkout(updatedWorkout),
        profile ? this.userProfileService.saveProfile({
          ...profile,
          systemRecovery: updatedSystemRecovery,
          muscleFatigue: fatigueObj,
          lastFatigueUpdate: nowIso,
          totalVolume: (profile.totalVolume || 0) + sessionVolume
        }) : Promise.resolve()
      ]);
    });

    // Force signal update to reflect immediately in the dashboard
    this.userProfileState.refreshProfile();

    if (workout.fecha) {
      await this.shiftFutureWorkouts(workout, workout.fecha);
    }

    this.clearActiveSession();
    this.router.navigate(['/weekly-plan']);
  }

  private async shiftFutureWorkouts(workout: Workout, fechaStr: string): Promise<void> {
    const scheduledDate = new Date(fechaStr);
    scheduledDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - scheduledDate.getTime();
    const daysOffset = Math.round(diffTime / (1000 * 60 * 60 * 24));
    if (daysOffset <= 0) return;

    const allWorkouts = this.workoutService.workouts();
    const futureWorkouts = allWorkouts.filter(w => {
      if (w.id === workout.id || w.isCompleted || w.status === 'completed' || !w.fecha) return false;
      const wDate = new Date(w.fecha);
      wDate.setHours(0, 0, 0, 0);
      return wDate.getTime() > scheduledDate.getTime();
    });

    for (const w of futureWorkouts) {
      const newDate = new Date(w.fecha!);
      newDate.setDate(newDate.getDate() + daysOffset);
      await this.workoutService.updateWorkout({
        ...w,
        fecha: newDate.toISOString()
      });
    }
    if (futureWorkouts.length > 0) {
      this.toastService.showInfo(`Calendario ajustado: Se empujaron ${futureWorkouts.length} día(s) por el retraso.`);
    }
  }

  cancelActiveSession() {
    const w = this.workout();
    if (w) {
      const updatedW: any = { ...w, status: 'idle' };
      delete updatedW.activeStartTime;
      delete updatedW.activeSetsState;
      this.workoutService.updateWorkout(updatedW);
    }
    this.clearActiveSession();
    this.router.navigate(['/weekly-plan']);
  }

  clearActiveSession() {
    this.workout.set(null);
    this.activeSets.set(new Map());
    this.sessionSeconds.set(0);
    this.isActive.set(false);
    this.stopSessionTimer();
    this.restTimer.stop();
    this.trainingSessionService.saveSession(null);
  }
}
