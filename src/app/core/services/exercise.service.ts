import { Injectable } from '@angular/core';
import { EXERCISES_CATALOG } from '../../models/exercise-catalog';
import { Ejercicio } from '../../models/workout.model';

@Injectable({ providedIn: 'root' })
export class ExerciseService {
  getAll(): Ejercicio[] {
    return EXERCISES_CATALOG;
  }

  getByGroup(grupo: string): Ejercicio[] {
    return EXERCISES_CATALOG.filter(e => e.grupoMuscular === grupo);
  }
}
