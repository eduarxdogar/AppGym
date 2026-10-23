import { Injectable, signal, computed, inject, untracked, DestroyRef } from '@angular/core';
import { Workout } from '../../../../core/models/workout.model';
import { WorkoutService } from '../../../../core/services/workout.service';
import { TrainingSessionService } from '../../../../core/services/training-session.service';
import { WorkoutCompletionService } from '../../../../core/services/workout-completion.service';
import { AuthService } from '../../../../core/services/auth.service';
import { canonicalMuscle } from '../../../../core/models/muscle-taxonomy';
import { exerciseVolume, firestoreData, nonNegative, sessionCalories } from '../../../../core/utils/workout-session.utils';
import { RestTimerService } from '../../../../core/services/rest-timer.service';
import { CompletedWorkoutSession, WorkoutSessionExercise, WorkoutSessionSet, WorkoutDropSet } from '../../../../core/models/workout-session.model';
import { Router } from '@angular/router';
import { ToastService } from '../../../../core/services/toast.service';

export interface DropSet extends WorkoutDropSet { reps: number; weight: number; }
export interface WorkoutSet extends WorkoutSessionSet {
  type?: 'warmup' | 'effective' | 'topset' | 'backoff';
  reps: number;
  weight: number;
  completed: boolean;
  dropSets?: DropSet[];
}

@Injectable({
  providedIn: 'root'
})
export class WorkoutSessionService {
  private readonly workoutService = inject(WorkoutService);
  private readonly trainingSessionService = inject(TrainingSessionService);
  private readonly completion = inject(WorkoutCompletionService);
  private readonly auth = inject(AuthService);
  public readonly restTimer = inject(RestTimerService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  // State
  workout = signal<Workout | null>(null);
  activeSets = signal<Map<number, WorkoutSet[]>>(new Map());
  isActive = signal<boolean>(false);
  readonly isFinalizing = signal(false);
  private pendingWrites: Promise<void> = Promise.resolve();
  private sessionId: string | null = null;
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

  constructor() { inject(DestroyRef).onDestroy(() => this.stopSessionTimer()); }

  loadWorkout(workoutId: string) {
    const w = this.workoutService.getWorkoutById(workoutId)();
    untracked(() => {
      if (this.isFinalizing()) return;
      const changed = this.workout()?.id !== workoutId;
      if (changed) {
        this.stopSessionTimer();
        this.activeSets.set(new Map());
        this.sessionSeconds.set(0);
        this.sessionStartTime = null;
        this.sessionId = null;
        this.isActive.set(false);
      }
      this.workout.set(w || null);
      if (!w) return;
      const cached = this.trainingSessionService.getCurrentSession();
      const pendingLocal = cached?.workoutId === w.id && cached.sessionId && cached.userId === this.auth.currentUser()?.uid;
      if (!this.isActive() && w.status !== 'completed' && !w.isCompleted && (w.status === 'active' || pendingLocal)) {
        this.restoreActiveSession({ ...w,
          activeStartTime: w.activeStartTime ?? cached?.fechaInicio.toISOString(),
          activeSessionId: w.activeSessionId ?? cached?.sessionId
        });
      } else if (this.activeSets().size === 0) this.initializeSets(w);
    });
  }

  initializeSets(w: Workout) {
    const initialMap = new Map<number, WorkoutSet[]>();
    w.ejercicios.forEach((ex, index) => {
      const sets: WorkoutSet[] = [];
      const targetSets = ex.series || 3;
      for (let i = 0; i < targetSets; i++) {
        const isWarmup = i < (ex.serieCalentamiento ?? 0);
        sets.push({
          type: isWarmup ? 'warmup' : ex.tipos === 'top-set' ? 'topset' : ex.tipos === 'back-set' ? 'backoff' : 'effective',
          reps: ex.repeticiones || 10,
          weight: ex.pesokg || 0,
          completed: false,
          dropSets: [],
          superCompleted: false,
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
    this.sessionStartTime = Number.isFinite(startTime) ? startTime : Date.now();
    this.sessionId = w.activeSessionId ?? `${w.id}_${this.sessionStartTime}`;
    this.workout.set({ ...w, activeSessionId: this.sessionId, activeStartTime: new Date(this.sessionStartTime).toISOString() });
    
    const elapsed = Math.max(0, Math.floor((Date.now() - this.sessionStartTime) / 1000));
    this.sessionSeconds.set(elapsed);
    this.startSessionTimer();

    if (w.activeSetsState && Object.keys(w.activeSetsState).length > 0) {
      const restoredMap = new Map<number, WorkoutSet[]>();
      Object.entries(w.activeSetsState).forEach(([key, sets]) => {
        if (!Number.isInteger(Number(key)) || !Array.isArray(sets)) return;
        restoredMap.set(Number(key), (sets as WorkoutSet[]).map(set => ({
          ...set, superCompleted: set.superCompleted ?? set.completed === true,
          dropSets: (set.dropSets ?? []).map(drop => ({ ...drop,
            completed: drop.completed ?? set.completed === true,
            superCompleted: drop.superCompleted ?? set.completed === true
          }))
        })));
      });
      this.activeSets.set(restoredMap);
    } else {
      this.initializeSets(w);
    }
    this.trainingSessionService.startSession(w, new Date(this.sessionStartTime!), this.sessionId!, this.auth.currentUser()?.uid);
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
    if (!w || this.isActive() || this.isFinalizing() || w.isCompleted || w.status === 'completed') return;
    this.isActive.set(true);
    const startTimeStr = new Date().toISOString();
    this.sessionStartTime = new Date(startTimeStr).getTime();
    this.sessionId = crypto.randomUUID();
    this.sessionSeconds.set(0);
    this.workout.set({ ...w, activeSessionId: this.sessionId, activeStartTime: startTimeStr, status: 'active' });
    this.startSessionTimer();
    this.trainingSessionService.startSession(w, new Date(this.sessionStartTime!), this.sessionId!, this.auth.currentUser()?.uid);
    
    this.persistWorkoutChanges({
      ...w,
      status: 'active',
      activeSessionId: this.sessionId,
      activeStartTime: startTimeStr
    });
  }

  async persistWorkoutChanges(overrideWorkout?: Workout): Promise<void> {
    const w = overrideWorkout ?? this.workout();
    if (!w || this.isFinalizing()) return;
    const snapshot = structuredClone(w);
    this.pendingWrites = this.pendingWrites.then(() => this.workoutService.updateWorkout(snapshot)).catch(error => {
      console.error('Error persisting workout changes:', error);
      this.toastService.showError('No se pudo sincronizar la rutina. Tus cambios siguen en esta sesión.');
    });
    await this.pendingWrites;
  }

  async persistSetsState(): Promise<void> {
    const w = this.workout();
    if (!w || !this.isActive() || this.isFinalizing()) return;
    const setsRecord: Record<number, WorkoutSet[]> = {};
    this.activeSets().forEach((sets, key) => { setsRecord[key] = sets; });
    await this.persistWorkoutChanges({ ...w, activeSetsState: setsRecord });
  }

  getSetsForExercise(index: number): WorkoutSet[] {
    return this.activeSets().get(index) || [];
  }

  addSet(index: number) {
    if (this.isFinalizing()) return;
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
    if (this.isFinalizing()) return;
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
    if (this.isFinalizing()) return;
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
    if (this.isFinalizing()) return;
    const map = new Map(this.activeSets());
    const sets = map.get(exIndex);
    if (!sets?.[setIndex]) return;

    const isNowCompleted = !sets[setIndex].completed;
    sets[setIndex].completed = isNowCompleted;
    sets[setIndex].superCompleted = isNowCompleted;
    sets[setIndex].dropSets?.forEach(drop => {
      drop.completed = isNowCompleted;
      drop.superCompleted = isNowCompleted;
    });
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
    if (this.isFinalizing()) return;
    const map = new Map(this.activeSets());
    const sets = map.get(exIndex);
    if (sets?.[setIndex]) {
      sets[setIndex].weight = weight;
      this.activeSets.set(map);
      this.persistSetsState();
    }
  }

  updateSetReps(exIndex: number, setIndex: number, reps: number) {
    if (this.isFinalizing()) return;
    const map = new Map(this.activeSets());
    const sets = map.get(exIndex);
    if (sets?.[setIndex]) {
      sets[setIndex].reps = reps;
      this.activeSets.set(map);
      this.persistSetsState();
    }
  }
  
  updateDropSet(exIndex: number, setIndex: number, dropIndex: number, weight: number, reps: number) {
    if (this.isFinalizing()) return;
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
    if (this.isFinalizing()) return;
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
    if (this.isFinalizing()) return;
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
    if (this.isFinalizing()) return;
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
      const newDropSet: DropSet = { reps: newReps, weight: dropWeight, completed: false, superCompleted: false };
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
    if (this.isFinalizing()) return;
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
    if (this.isFinalizing()) return;
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
    return this.buildSessionExercises().reduce((total, exercise) => total + exerciseVolume(exercise), 0);
  }

  private buildSessionExercises(): WorkoutSessionExercise[] {
    const serialize = (set: WorkoutSet | DropSet): WorkoutSessionSet => firestoreData({
      weight: nonNegative(set.weight), reps: nonNegative(set.reps), completed: set.completed === true,
      ...('type' in set ? { type: set.type } : {}),
      ...(set.superWeight != null || set.superReps != null ? {
        superSet: { weight: nonNegative(set.superWeight), reps: nonNegative(set.superReps), completed: set.superCompleted === true }
      } : {}),
      ...('dropSets' in set ? { dropSets: set.dropSets?.map(serialize) } : {})
    });
    return (this.workout()?.ejercicios ?? []).map((exercise, index) => firestoreData({
      id: exercise.id, nombre: exercise.nombre, grupoMuscular: canonicalMuscle(exercise.grupoMuscular) ?? exercise.grupoMuscular,
      targetSets: exercise.series, tipos: exercise.tipos,
      ...(exercise.superSetEjercicio ? { superSetExercise: {
        id: exercise.superSetEjercicio.id, nombre: exercise.superSetEjercicio.nombre,
        grupoMuscular: canonicalMuscle(exercise.superSetEjercicio.grupoMuscular) ?? exercise.superSetEjercicio.grupoMuscular
      } } : {}),
      sets: (this.activeSets().get(index) ?? []).map(serialize)
    }));
  }

  async finalizeSession(): Promise<void> {
    if (this.isFinalizing()) return;
    const workout = this.workout();
    if (!workout || !this.isActive()) return;
    this.isFinalizing.set(true);
    try {
      // Let earlier progress writes settle before the atomic closing transaction.
      await this.pendingWrites;
      const end = new Date();
      const start = new Date(this.sessionStartTime ?? workout.activeStartTime ?? end);
      const elapsed = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
      this.sessionSeconds.set(elapsed);
      const session: CompletedWorkoutSession = {
        id: this.sessionId ?? workout.activeSessionId ?? `${workout.id}_${start.getTime()}`,
        workoutId: workout.id, originWorkoutId: workout.id, nombre: workout.nombre,
        startTime: start.toISOString(), endTime: end.toISOString(), duration: this.sessionTimeFormatted(),
        totalVolume: this.calculateTotalVolume(), exercises: this.buildSessionExercises(), feeling: 'good'
      };
      session.musclesWorked = Array.from(new Set(session.exercises.flatMap(ex => [ex.grupoMuscular, ex.superSetExercise?.grupoMuscular])
        .filter((group): group is string => !!group)));
      session.calories = sessionCalories(session);
      const saved = await this.completion.complete(session, this.workoutService.workouts());
      // Only a successful commit may stop the session or discard its recoverable state.
      this.stopSessionTimer();
      this.restTimer.stop();
      this.isActive.set(false);
      this.workout.set({ ...workout, status: 'completed', isCompleted: true,
        completedAt: saved.endTime, lastSessionId: saved.id, activeSessionId: undefined,
        activeStartTime: undefined, activeSetsState: undefined });
      this.activeSets.set(new Map());
      this.sessionStartTime = null;
      this.sessionId = null;
      this.trainingSessionService.saveSession(null);
      this.toastService.showSuccess('Sesión guardada. Tonelaje y recuperación actualizados.');
      await this.router.navigate(['/weekly-plan']);
    } catch (error) {
      console.error('Error finalizando la sesión:', error);
      if (this.isActive()) {
        this.toastService.showError('No se pudo guardar la sesión. Sigue activa para que puedas reintentar.');
      } else {
        this.toastService.showInfo('La sesión está guardada. Puedes volver al plan semanal.');
      }
    } finally {
      this.isFinalizing.set(false);
    }
  }

  cancelActiveSession() {
    const w = this.workout();
    if (w) {
      const updatedW: any = { ...w, status: 'idle' };
      delete updatedW.activeStartTime;
      delete updatedW.activeSetsState;
      this.workoutService.updateWorkout(updatedW);
      this.trainingSessionService.saveSession(null);
    }
    this.isActive.set(false);
    this.stopSessionTimer();
    this.restTimer.stop();
    this.router.navigate(['/weekly-plan']);
  }
}
