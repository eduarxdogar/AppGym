/** Canonical persisted execution contract; legacy aliases are normalized on read. */
export interface WorkoutLoad {
  weight?: number;
  reps?: number;
  completed?: boolean;
}

export interface WorkoutDropSet extends WorkoutLoad {
  superSet?: WorkoutLoad;
  superWeight?: number;
  superReps?: number;
  superCompleted?: boolean;
}

export interface WorkoutSessionSet extends WorkoutDropSet {
  type?: string;
  dropSets?: WorkoutDropSet[];
  rpe?: number;
  repeticiones?: number;
  peso?: number;
  pesokg?: number;
  tipo?: string;
}

export interface SessionExerciseReference {
  id?: string | number;
  nombre?: string;
  grupoMuscular?: string;
}

export interface WorkoutSessionExercise extends SessionExerciseReference {
  targetSets?: number;
  sets?: WorkoutSessionSet[];
  superSetExercise?: SessionExerciseReference;
  tipos?: 'normal' | 'top-set' | 'back-set' | 'drop-set' | 'super-serie';
  notes?: string;
  // Read compatibility only; new writes use id, nombre, grupoMuscular and sets.
  exerciseId?: string | number;
  name?: string;
  groupMuscular?: string;
  muscleGroup?: string;
  series?: WorkoutSessionSet[];
}

export interface WorkoutSession {
  id?: string;
  userId?: string;
  workoutId?: string | number;
  originWorkoutId?: string;
  microcycleId?: string;
  nombre?: string;
  startTime?: string;
  endTime?: string;
  duration?: string;
  totalVolume?: number;
  musclesWorked?: string[];
  exercises?: WorkoutSessionExercise[];
  feeling?: 'good' | 'tired' | 'average' | 'strong';
  calories?: number;
  // Legacy documents remain readable without a database migration.
  name?: string;
  fecha?: string;
  ejercicios?: WorkoutSessionExercise[];
  musculos?: string[];
}

export interface CompletedWorkoutSession extends WorkoutSession {
  id: string;
  workoutId: string;
  nombre: string;
  startTime: string;
  endTime: string;
  duration: string;
  totalVolume: number;
  exercises: WorkoutSessionExercise[];
}
