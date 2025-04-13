import { Ejercicio } from './ejercicio.model';

export interface Workout {
  id: number;
  fecha?:Date;
  nombre: string;
  ejercicios: Ejercicio[]; 
  nivelDificultad: 'principiante' | 'intermedio' | 'avanzado'; 
  musculos?: string[];
  frequency?: number;
}

export type { Ejercicio };
