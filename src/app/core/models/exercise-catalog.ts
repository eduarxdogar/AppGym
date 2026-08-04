import { Ejercicio } from './workout.model';

export interface ExerciseData {
  id?: string;
  name: string;
  discipline: 'gym' | 'calisthenics' | 'boxing';
  muscleGroup: 'pecho' | 'espalda' | 'hombros' | 'bíceps' | 'tríceps' | 'cuádriceps' | 'isquios' | 'glúteos' | 'gemelos' | 'core';
  type: 'compound' | 'isolated';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  instructions: string[];
  equipmentRequired: string[];
  imageUrl: string;
  videoUrl: string;
}

export const EXERCISES_CATALOG: Ejercicio[] = [
  {
    id: 1,
    nombre: 'Press de banca',
    grupoMuscular: 'pecho',
    tipo: 'compuesto',
    series: 4,
    repeticiones: 8-12,
    descanso: '60s',
  },
  {
    id: 2,
    nombre: 'Aperturas con mancuernas',
    grupoMuscular: 'pecho',
    tipo: 'aislado',
    series: 3,
    repeticiones: 12-15,
    descanso: '45s',
  },
  {
    id: 3,
    nombre: 'Dominadas',
    grupoMuscular: 'espalda',
    tipo: 'compuesto',
    series: 4,
    repeticiones: 6-10,
    descanso: '90s',
  },
  {
    id: 4,
    nombre: 'Curl de bíceps',
    grupoMuscular: 'bíceps',
    tipo: 'aislado',
    series: 3,
    repeticiones: 10-12,
    descanso: '45s',
  },
  // Puedes seguir agregando más aquí
];


