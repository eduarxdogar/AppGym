import { Ejercicio } from './ejercicio.model';

export interface Workout {
  id: number;
  nombre: string;
  ejercicios: Ejercicio[]; 
  musculos?: string[];
}
