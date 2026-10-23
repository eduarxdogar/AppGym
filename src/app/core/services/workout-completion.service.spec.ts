import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { initializeApp, deleteApp, FirebaseApp } from 'firebase/app';
import { getFirestore, DocumentReference, Transaction, DocumentSnapshot } from 'firebase/firestore';
import { WorkoutCompletionService, WORKOUT_TRANSACTION_RUNNER } from './workout-completion.service';
import { AuthService } from './auth.service';
import { CompletedWorkoutSession, WorkoutSession } from '../models/workout-session.model';
import { Workout } from '../models/workout.model';

describe('WorkoutCompletionService atomic persistence', () => {
  let app: FirebaseApp;
  let service: WorkoutCompletionService;
  let documents: Map<string, Record<string, unknown>>;
  let pending: Array<{ path: string; data: Record<string, unknown> }>;
  let fail: boolean;
  const workout: Workout = { id: 'w1', nombre: 'Push', nivelDificultad: 'intermedio', ejercicios: [], fecha: '2030-01-01T12:00:00.000Z' };
  const session: CompletedWorkoutSession = { id: 'stable', workoutId: 'w1', nombre: 'Push',
    startTime: '2030-01-03T11:00:00.000Z', endTime: '2030-01-03T12:00:00.000Z',
    duration: '01:00:00', totalVolume: 500, exercises: [] };

  beforeEach(() => {
    app = initializeApp({ projectId: 'local-unit-tests' }, `completion-${crypto.randomUUID()}`);
    documents = new Map([
      ['workouts/w1', { ...workout, userId: 'u1', activeSessionId: 'stable', status: 'active' }],
      ['workouts/w2', { id: 'w2', userId: 'u1', fecha: '2030-01-02T12:00:00.000Z', status: 'idle' }]
    ]);
    pending = []; fail = false;
    // Only the transaction callback runs. No SDK reads or writes leave this test.
    const run = async (operation: (transaction: Transaction) => Promise<WorkoutSession>) => {
      pending = [];
      const transaction = {
        get: async (ref: DocumentReference) => {
          if (pending.length) throw new Error('Read after write');
          return { ref, exists: () => documents.has(ref.path), data: () => documents.get(ref.path),
            get: (field: string) => documents.get(ref.path)?.[field] } as unknown as DocumentSnapshot;
        },
        set: (ref: DocumentReference, data: Record<string, unknown>) => pending.push({ path: ref.path, data }),
        update: (ref: DocumentReference, data: Record<string, unknown>) => pending.push({ path: ref.path, data })
      } as unknown as Transaction;
      const result = await operation(transaction);
      if (fail) throw new Error('Commit failed');
      for (const write of pending) documents.set(write.path, { ...documents.get(write.path), ...write.data });
      return result;
    };
    TestBed.configureTestingModule({ providers: [WorkoutCompletionService,
      { provide: Firestore, useValue: getFirestore(app) },
      { provide: AuthService, useValue: { currentUser: () => ({ uid: 'u1' }) } },
      { provide: WORKOUT_TRANSACTION_RUNNER, useValue: run }
    ] });
    service = TestBed.inject(WorkoutCompletionService);
  });

  afterEach(async () => { await deleteApp(app); });

  it('commits history, workout completion and the delayed calendar together', async () => {
    await service.complete(session, [workout, { ...workout, id: 'w2' }]);
    expect(pending.map(write => write.path)).toEqual(['workout_history/stable', 'workouts/w1', 'workouts/w2']);
    expect(documents.get('workout_history/stable')!['userId']).toBe('u1');
    expect(documents.get('workouts/w1')!['status']).toBe('completed');
    expect(documents.get('workouts/w2')!['fecha']).toBe('2030-01-04T12:00:00.000Z');
  });

  it('does not change any document when the commit fails', async () => {
    fail = true;
    await expectAsync(service.complete(session, [workout, { ...workout, id: 'w2' }])).toBeRejected();
    expect(documents.has('workout_history/stable')).toBeFalse();
    expect(documents.get('workouts/w1')!['status']).toBe('active');
    expect(documents.get('workouts/w2')!['fecha']).toBe('2030-01-02T12:00:00.000Z');
  });

  it('does not duplicate history or shift the calendar again on retry', async () => {
    const plan = [workout, { ...workout, id: 'w2' }];
    await service.complete(session, plan);
    await service.complete({ ...session, id: 'different-client-id' }, plan);
    expect(pending).toEqual([]);
    expect(documents.has('workout_history/different-client-id')).toBeFalse();
    expect(documents.get('workouts/w2')!['fecha']).toBe('2030-01-04T12:00:00.000Z');
  });

  it('rejects a changed session ID without writing', async () => {
    await expectAsync(service.complete({ ...session, id: 'other-session' }, [])).toBeRejected();
    expect(pending).toEqual([]);
  });

  it('rejects a workout owned by another account', async () => {
    documents.get('workouts/w1')!['userId'] = 'another-user';
    await expectAsync(service.complete(session, [])).toBeRejected();
    expect(pending).toEqual([]);
  });
});
