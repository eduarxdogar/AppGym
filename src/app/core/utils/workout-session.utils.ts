import { WorkoutDropSet, WorkoutLoad, WorkoutSession, WorkoutSessionExercise, WorkoutSessionSet } from '../models/workout-session.model';
import { Workout } from '../models/workout.model';

export function nonNegative(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function normalizeSet(set: WorkoutSessionSet): WorkoutSessionSet {
  return {
    ...set,
    weight: nonNegative(set.weight ?? set.peso ?? set.pesokg),
    reps: nonNegative(set.reps ?? set.repeticiones),
    completed: set.completed === true,
    type: set.type ?? set.tipo ?? 'effective'
  };
}

export function normalizeSession(session: WorkoutSession): WorkoutSession {
  return {
    ...session,
    nombre: session.nombre ?? session.name ?? '',
    originWorkoutId: session.originWorkoutId ?? (session.workoutId !== undefined ? String(session.workoutId) : undefined),
    ...((session.exercises ?? session.ejercicios) !== undefined ? { exercises: (session.exercises ?? session.ejercicios ?? []).map(ex => ({
      ...ex,
      id: ex.id ?? ex.exerciseId,
      nombre: ex.nombre ?? ex.name ?? '',
      grupoMuscular: ex.grupoMuscular ?? ex.groupMuscular ?? ex.muscleGroup ?? '',
      sets: (ex.sets ?? ex.series ?? []).map(normalizeSet)
    })) } : {})
  };
}

export interface CompletedLoad extends Required<WorkoutLoad> {
  grupoMuscular?: string;
  type: string;
}

/** Every load needs an explicit completion flag, including advanced sets. */
export function completedExerciseLoads(exercise: WorkoutSessionExercise): CompletedLoad[] {
  const result: CompletedLoad[] = [];
  const group = exercise.grupoMuscular ?? exercise.groupMuscular ?? exercise.muscleGroup;
  const add = (load: WorkoutLoad | undefined, type: string, muscle = group) => {
    if (load?.completed === true) {
      result.push({ weight: nonNegative(load.weight), reps: nonNegative(load.reps), completed: true, type, grupoMuscular: muscle });
    }
  };
  const superset = (set: WorkoutDropSet): WorkoutLoad | undefined => set.superSet ?? (
    set.superWeight != null || set.superReps != null
      ? { weight: set.superWeight, reps: set.superReps, completed: set.superCompleted === true }
      : undefined
  );
  for (const raw of exercise.sets ?? exercise.series ?? []) {
    const set = normalizeSet(raw);
    const type = set.type ?? 'effective';
    add(set, type);
    add(superset(set), type, exercise.superSetExercise?.grupoMuscular ?? group);
    for (const drop of set.dropSets ?? []) {
      add(drop, type);
      add(superset(drop), type, exercise.superSetExercise?.grupoMuscular ?? group);
    }
  }
  return result;
}

export function exerciseVolume(exercise: WorkoutSessionExercise): number {
  return completedExerciseLoads(exercise).reduce((total, load) => total + load.weight * load.reps, 0);
}

export function sessionVolume(session: WorkoutSession): number {
  const exercises = session.exercises ?? session.ejercicios;
  // Aggregate-only old records remain readable; executed sets take precedence.
  return exercises === undefined ? nonNegative(session.totalVolume)
    : exercises.reduce((total, exercise) => total + exerciseVolume(exercise), 0);
}

export function sessionSetCount(session: WorkoutSession): number {
  return (session.exercises ?? session.ejercicios ?? [])
    .reduce((total, exercise) => total + completedExerciseLoads(exercise).length, 0);
}

/** Include actual completion dates so finishing a delayed plan still appears in its summary. */
export function planDateRange(workouts: readonly Workout[]): { start: Date; end: Date } {
  const times = workouts.flatMap(workout => [workout.fecha, workout.completedAt])
    .filter((date): date is string => !!date).map(date => new Date(date).getTime()).filter(Number.isFinite);
  return { start: new Date(times.length ? Math.min(...times) : Date.now()),
    end: new Date(times.length ? Math.max(...times) : Date.now()) };
}

export function sessionCalories(session: WorkoutSession): number {
  if (session.calories !== undefined && Number.isFinite(session.calories)) return nonNegative(session.calories);
  const elapsed = new Date(session.endTime ?? '').getTime() - new Date(session.startTime ?? '').getTime();
  const parts = (session.duration ?? '').split(':').map(Number);
  const minutes = Number.isFinite(elapsed) && elapsed >= 0 ? elapsed / 60_000
    : parts.length === 3 ? parts[0] * 60 + parts[1] + parts[2] / 60
    : parts.length === 2 ? parts[0] + parts[1] / 60 : 0;
  return Math.round(nonNegative(minutes) * 5 + sessionVolume(session) * 0.0005);
}

/** Omit undefined fields without destroying Firebase sentinels or SDK objects. */
export function firestoreData<T>(value: T): T {
  if (Array.isArray(value)) return value.map(item => firestoreData(item)) as T;
  if (value === null || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return value;
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)
    .map(([key, item]) => [key, firestoreData(item)])) as T;
}
