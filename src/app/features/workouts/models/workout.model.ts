import { Ejercicio } from './ejercicio.model';

export interface ActiveSetState {
  reps: number;
  weight: number;
  completed: boolean;
  isDropset?: boolean;
}

export interface ProgressionOptions {
  focus: 'weight' | 'volume';
  frequencyAdjustment: number; // 0, 1, or -1
  direction: 'increment' | 'maintain' | 'deload';
}

export interface Workout {
  id: string;
  fecha?: string;
  nombre: string;
  ejercicios: Ejercicio[]; 
  nivelDificultad: 'principiante' | 'intermedio' | 'avanzado'; 
  musculos?: string[];
  frequency?: number;
  isCompleted?: boolean;
  completedAt?: string;
  durationMinutes?: number;
  // Session persistence
  status?: 'idle' | 'active' | 'completed';
  activeStartTime?: string;           // ISO string when session started
  activeSetsState?: Record<number, ActiveSetState[]>; // Persisted sets progress
}

export type { Ejercicio };
