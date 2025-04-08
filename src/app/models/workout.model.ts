import { Ejercicio } from './ejercicio.model';

export interface Workout {
  id: number;
  fecha?:Date;
  nombre: string;
  ejercicios: Ejercicio[]; 
  musculos?: string[];
}

export type { Ejercicio };
