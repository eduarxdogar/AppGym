import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { WorkoutSessionService } from './workout-session.service';
import { WorkoutService } from '../../../../core/services/workout.service';
import { WorkoutCompletionService } from '../../../../core/services/workout-completion.service';
import { TrainingSessionService } from '../../../../core/services/training-session.service';
import { RestTimerService } from '../../../../core/services/rest-timer.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Workout } from '../../../../core/models/workout.model';
import { CompletedWorkoutSession, WorkoutSession } from '../../../../core/models/workout-session.model';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { MetricsService } from '../../../../core/services/metrics.service';
import { RecoveryService } from '../../../../core/services/recovery.service';
import { TrainingHistoryService } from '../../../../core/services/training-history.service';
import { GamificationService } from '../../../../core/services/gamification.service';
import { StorageService } from '../../../../core/services/storage.service';
import { UserProfileStateService } from '../../../../core/services/user-profile-state.service';
import { TrainingClockService } from '../../../../core/services/training-clock.service';
import { CardioSessionService } from '../../../../core/services/cardio-session.service';

describe('WorkoutSessionService closing a routine', () => {
  let service: WorkoutSessionService;
  let completion: jasmine.SpyObj<WorkoutCompletionService>;
  let training: TrainingSessionService;
  let toast: jasmine.SpyObj<ToastService>;
  let rest: jasmine.SpyObj<RestTimerService>;
  let router: jasmine.SpyObj<Router>;
  let history: BehaviorSubject<WorkoutSession[]>;
  const plan = signal<Workout[]>([]);

  const workout = (id = 'workout-1'): Workout => ({ id, nombre: 'Push', nivelDificultad: 'intermedio',
    ejercicios: [{ id: 1, nombre: 'Press', grupoMuscular: 'Pecho', series: 1, repeticiones: 10, pesokg: 50,
      superSetEjercicio: { id: 2, nombre: 'Remo', grupoMuscular: 'Espalda', series: 1, repeticiones: 10, pesokg: 30 } }]
  });

  beforeEach(() => {
    localStorage.removeItem('currentTrainingSession');
    plan.set([workout()]);
    history = new BehaviorSubject<WorkoutSession[]>([]);
    completion = jasmine.createSpyObj('WorkoutCompletionService', ['complete']);
    completion.complete.and.callFake(async session => session);
    toast = jasmine.createSpyObj('ToastService', ['showSuccess', 'showError', 'showInfo']);
    rest = jasmine.createSpyObj('RestTimerService', ['stop']);
    router = jasmine.createSpyObj('Router', ['navigate']);
    router.navigate.and.resolveTo(true);
    TestBed.configureTestingModule({ providers: [
      WorkoutSessionService, TrainingSessionService,
      { provide: WorkoutCompletionService, useValue: completion },
      { provide: WorkoutService, useValue: { workouts: plan,
        getWorkoutById: (id: string) => computed(() => plan().find(w => w.id === id)), updateWorkout: async () => undefined } },
      { provide: AuthService, useValue: { currentUser: signal({ uid: 'user-1' }) } },
      { provide: RestTimerService, useValue: rest }, { provide: ToastService, useValue: toast },
      { provide: Router, useValue: router },
      { provide: StorageService, useValue: { getHistory: () => history } },
      { provide: UserProfileStateService, useValue: { profile: signal(null) } },
      { provide: TrainingClockService, useValue: { now: signal(Date.now()) } },
      { provide: CardioSessionService, useValue: { cardioSessions: signal([]) } }
    ] });
    service = TestBed.inject(WorkoutSessionService);
    training = TestBed.inject(TrainingSessionService);
    service.loadWorkout('workout-1');
  });

  afterEach(() => localStorage.removeItem('currentTrainingSession'));

  it('returns zero when no sets were completed', () => {
    expect(service.calculateTotalVolume()).toBe(0);
  });

  it('completes all loads under the existing checkbox and persists their canonical contract', async () => {
    service.startRoutine();
    service.addDropSet(0);
    service.updateDropSet(0, 0, 0, 40, 10);
    service.toggleSetComplete(0, 0);
    expect(service.calculateTotalVolume()).toBe(1536); // 500 + 300 + 400 + 24*14
    await service.finalizeSession();
    const saved = completion.complete.calls.mostRecent().args[0];
    expect(saved.nombre).toBe('Push');
    expect(saved.name).toBeUndefined();
    expect(saved.exercises[0].id).toBe(1);
    expect(saved.exercises[0].exerciseId).toBeUndefined();
    expect(saved.exercises[0].sets![0].dropSets![0].completed).toBeTrue();
    expect(saved.exercises[0].sets![0].superSet!.completed).toBeTrue();
    expect(saved.totalVolume).toBe(1536);
  });

  it('removes all linked volume when the group is unchecked', () => {
    service.addDropSet(0);
    service.toggleSetComplete(0, 0);
    service.toggleSetComplete(0, 0);
    expect(service.calculateTotalVolume()).toBe(0);
  });

  it('keeps the session active and state recoverable until the transaction commits', async () => {
    let resolve!: (session: WorkoutSession) => void;
    completion.complete.and.returnValue(new Promise<WorkoutSession>(done => resolve = done));
    service.startRoutine();
    await service.persistSetsState();
    const closing = service.finalizeSession();
    await Promise.resolve();
    expect(service.isActive()).toBeTrue();
    expect(service.isFinalizing()).toBeTrue();
    expect(rest.stop).not.toHaveBeenCalled();
    expect(training.getCurrentSession()).not.toBeNull();
    expect(router.navigate).not.toHaveBeenCalled();
    resolve(completion.complete.calls.mostRecent().args[0]);
    await closing;
    expect(service.isActive()).toBeFalse();
    expect(service.activeSets().size).toBe(0);
    expect(training.getCurrentSession()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/weekly-plan']);
  });

  it('preserves the ID, checks and timer after failure so a retry cannot create a second session', async () => {
    spyOn(console, 'error');
    completion.complete.and.rejectWith(new Error('offline'));
    service.startRoutine();
    service.toggleSetComplete(0, 0);
    await service.finalizeSession();
    const first = completion.complete.calls.mostRecent().args[0];
    expect(service.isActive()).toBeTrue();
    expect(service.isFinalizing()).toBeFalse();
    expect(service.activeSets().get(0)![0].completed).toBeTrue();
    expect(rest.stop).not.toHaveBeenCalled();
    expect(toast.showError).toHaveBeenCalled();
    completion.complete.and.callFake(async session => session);
    await service.finalizeSession();
    expect(completion.complete.calls.mostRecent().args[0].id).toBe(first.id);
  });

  it('blocks a second close request while the first transaction is in flight', async () => {
    let resolve!: (session: WorkoutSession) => void;
    completion.complete.and.returnValue(new Promise<WorkoutSession>(done => resolve = done));
    service.startRoutine();
    await service.persistSetsState();
    const closing = service.finalizeSession();
    await service.finalizeSession();
    expect(completion.complete).toHaveBeenCalledTimes(1);
    resolve(completion.complete.calls.mostRecent().args[0]);
    await closing;
  });

  it('restores the original session ID and start timestamp after a reload', async () => {
    const start = new Date(Date.now() - 3_600_000).toISOString();
    plan.set([{ ...workout(), status: 'active', activeStartTime: start, activeSessionId: 'stable-session',
      activeSetsState: { 0: [{ weight: 50, reps: 10, completed: true }] } }]);
    const restored = TestBed.runInInjectionContext(() => new WorkoutSessionService());
    restored.loadWorkout('workout-1');
    expect(restored.sessionSeconds()).toBeGreaterThanOrEqual(3600);
    await restored.finalizeSession();
    const saved: CompletedWorkoutSession = completion.complete.calls.mostRecent().args[0];
    expect(saved.id).toBe('stable-session');
    expect(saved.startTime).toBe(start);
    expect(saved.totalVolume).toBe(500);
  });

  it('does not carry checked sets into a different routine', () => {
    service.toggleSetComplete(0, 0);
    plan.set([workout(), workout('workout-2')]);
    service.loadWorkout('workout-2');
    expect(service.calculateTotalVolume()).toBe(0);
    expect(service.activeSets().get(0)![0].completed).toBeFalse();
  });

  it('feeds the same completed tonnage into history, metrics, rank and the 3D recovery model', async () => {
    const metrics = TestBed.inject(MetricsService);
    const recovery = TestBed.inject(RecoveryService);
    const trainingHistory = TestBed.inject(TrainingHistoryService);
    const rank = TestBed.inject(GamificationService);
    completion.complete.and.callFake(async session => {
      history.next([{ ...session, userId: 'user-1' }]);
      return session;
    });
    service.startRoutine();
    service.addDropSet(0);
    service.updateDropSet(0, 0, 0, 40, 10);
    service.toggleSetComplete(0, 0);
    await service.finalizeSession();
    expect(metrics.totalVolume()).toBe(1536);
    expect(rank.currentTonnage()).toBe(1536);
    const stats = await firstValueFrom(trainingHistory.getStats('volume', 'total'));
    expect(stats.total).toBe(1536);
    expect(recovery.getStatusForMesh('Pectoral_L')!.totalVolume).toBe(900);
    expect(recovery.getStatusForMesh('Pectoral_L')!.percentage).toBeLessThan(100);
    expect(recovery.getStatusForMesh('Pectoral_L')!.recoveryEtaHours).toBeGreaterThan(0);
  });
});
