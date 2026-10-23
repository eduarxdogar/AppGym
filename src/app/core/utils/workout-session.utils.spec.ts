import { deleteField } from 'firebase/firestore';
import { firestoreData, normalizeSession, planDateRange, sessionVolume } from './workout-session.utils';
import { Workout } from '../models/workout.model';
import { WorkoutSessionSchema } from '../models/workout-session/schemas/session.schema';

describe('Workout execution contract', () => {
  it('normalizes old names and exercise IDs without losing completed loads', () => {
    const session = normalizeSession({ name: 'Push', workoutId: 'w1', exercises: [
      { exerciseId: 'press', name: 'Press', muscleGroup: 'Pecho', sets: [{ peso: 50, repeticiones: 10, completed: true }] }
    ] });
    expect(session.nombre).toBe('Push');
    expect(session.exercises![0].id).toBe('press');
    expect(session.exercises![0].nombre).toBe('Press');
    expect(sessionVolume(session)).toBe(500);
    expect(WorkoutSessionSchema.safeParse(session).success).toBeTrue();
  });

  it('preserves aggregate-only legacy history', () => {
    expect(sessionVolume(normalizeSession({ totalVolume: 1200 }))).toBe(1200);
  });

  it('omits undefined values while preserving Firestore deletion sentinels and dates', () => {
    const deletion = deleteField();
    const date = new Date();
    const data = firestoreData({ deletion, date, missing: undefined, nested: { missing: undefined, value: 1 } });
    expect(data.deletion).toBe(deletion);
    expect(data.date).toBe(date);
    expect(Object.hasOwn(data, 'missing')).toBeFalse();
    expect(Object.hasOwn(data.nested, 'missing')).toBeFalse();
    expect(data.nested.value).toBe(1);
  });

  it('extends a delayed plan summary to its actual completion date', () => {
    const plan: Workout[] = [{ id: 'w1', nombre: 'Push', ejercicios: [], nivelDificultad: 'intermedio',
      fecha: '2030-01-01T12:00:00.000Z', completedAt: '2030-01-10T12:00:00.000Z' }];
    const range = planDateRange(plan);
    expect(range.start.toISOString()).toBe(plan[0].fecha!);
    expect(range.end.toISOString()).toBe(plan[0].completedAt!);
  });
});
