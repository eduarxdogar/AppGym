import { ProgressionEngineService } from './progression-engine.service';
import { Workout } from '../models/workout.model';
import { WorkoutSession } from '../models/workout-session.model';

describe('ProgressionEngineService canonical history', () => {
  it('uses workout and exercise IDs even when their names were changed', () => {
    const plan: Workout = { id: 'w1', nombre: 'Renamed Push', nivelDificultad: 'intermedio',
      ejercicios: [{ id: 'press', nombre: 'Renamed Press', grupoMuscular: 'Pecho', series: 1, repeticiones: 10, pesokg: 20 }],
      lastSessionId: 'previous', activeSessionId: 'old-active' };
    const session: WorkoutSession = { id: 's1', originWorkoutId: 'w1', nombre: 'Old Push', endTime: '2030-01-01',
      exercises: [{ id: 'press', nombre: 'Old Press', targetSets: 1, sets: [{ weight: 50, reps: 10, completed: true }] }] };
    const next = new ProgressionEngineService().generateNextMicrocycle([plan],
      { focus: 'weight', frequencyAdjustment: 0 }, new Map([['Old Push', [session]]]));
    expect(next[0].ejercicios[0].pesokg).toBe(52.5);
    expect(next[0].ejercicios[0].id).toBe('press');
    expect(next[0].lastSessionId).toBeUndefined();
    expect(next[0].activeSessionId).toBeUndefined();
  });

  it('does not progress an exercise whose saved sets were not completed', () => {
    const plan: Workout = { id: 'w1', nombre: 'Push', nivelDificultad: 'intermedio',
      ejercicios: [{ id: 1, nombre: 'Press', grupoMuscular: 'Pecho', series: 3, repeticiones: 10, pesokg: 50 }] };
    const session: WorkoutSession = { originWorkoutId: 'w1', nombre: 'Push', exercises: [
      { id: 1, nombre: 'Press', targetSets: 3, sets: [{ weight: 50, reps: 10, completed: false }] }
    ] };
    const next = new ProgressionEngineService().generateNextMicrocycle([plan],
      { focus: 'weight', frequencyAdjustment: 0 }, new Map([['Push', [session]]]));
    expect(next[0].ejercicios[0].pesokg).toBe(50);
  });
});
