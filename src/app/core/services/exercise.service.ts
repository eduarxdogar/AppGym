import { Injectable, inject, signal } from '@angular/core';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { EXERCISES_CATALOG } from '../../models/exercise-catalog';
import { Ejercicio } from '../../models/workout.model';

@Injectable({ providedIn: 'root' })
export class ExerciseService {
  private firestore = inject(Firestore);
  private exercisesSignal = signal<Ejercicio[]>([]);
  readonly exercises = this.exercisesSignal.asReadonly();

  constructor() {
    this.loadGlobalExercises();
  }

  private async loadGlobalExercises() {
    try {
      const colRef = collection(this.firestore, 'global_exercises');
      const snap = await getDocs(colRef);
      if (snap.empty) {
        // Fallback si aún no corre el seeder
        this.exercisesSignal.set(EXERCISES_CATALOG);
        return;
      }
      
      const loaded: Ejercicio[] = [];
      snap.forEach(doc => {
        const data = doc.data() as any;
        loaded.push({
          id: data.id || doc.id,
          nombre: data.name,
          grupoMuscular: data.muscleGroup,
          tipo: data.type === 'compound' ? 'compuesto' : 'aislado',
          series: 3,
          repeticiones: 10,
          videoUrl: data.videoUrl,
          imageUrl: data.imageUrl,
          equipmentRequired: data.equipmentRequired || [],
          notas: data.instructions ? data.instructions.join('\n') : ''
        });
      });
      this.exercisesSignal.set(loaded);
    } catch (e) {
      console.error('Error cargando ejercicios:', e);
      this.exercisesSignal.set(EXERCISES_CATALOG);
    }
  }

  getAll(): Ejercicio[] {
    return this.exercisesSignal();
  }

  getByGroup(grupo: string): Ejercicio[] {
    return this.exercisesSignal().filter(e => e.grupoMuscular === grupo);
  }
}
