import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ExerciseService } from '../../core/services/exercise.service';
import { WorkoutService } from '../../core/services/workout.service';
import { AuthService } from '../../core/services/auth.service';
import { Workout, Ejercicio } from '../../models/workout.model';

export interface CanvasExercise {
  catalogId: number | string;
  nombre: string;
  grupoMuscular: string;
  tipo?: 'compuesto' | 'aislado';
  tipos: 'normal' | 'top-set' | 'back-set' | 'drop-set' | 'super-serie';
  series: number;
  repeticiones: number;
  rir: number;
}

@Component({
  selector: 'app-workout-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './workout-builder.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkoutBuilderComponent {
  private exerciseService = inject(ExerciseService);
  private workoutService = inject(WorkoutService);
  private authService = inject(AuthService);
  private router = inject(Router);

  // State
  searchQuery = signal<string>('');
  selectedMuscle = signal<string>('');
  canvasExercises = signal<CanvasExercise[]>([]);
  workoutName = signal<string>('Mi Rutina Manual');
  isSaving = signal<boolean>(false);

  // Data from catalog
  catalogExercises = this.exerciseService.exercises;

  // Computed
  availableMuscles = computed(() => {
    const all = this.catalogExercises().map(ex => ex.grupoMuscular);
    return Array.from(new Set(all)).sort();
  });

  filteredCatalog = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const muscle = this.selectedMuscle();
    
    return this.catalogExercises().filter(ex => {
      const matchName = ex.nombre.toLowerCase().includes(query);
      const matchMuscle = muscle ? ex.grupoMuscular === muscle : true;
      return matchName && matchMuscle;
    });
  });

  canSave = computed(() => this.canvasExercises().length > 0 && this.workoutName().trim() !== '');

  addToCanvas(ex: Ejercicio) {
    const newCanvasEx: CanvasExercise = {
      catalogId: ex.id,
      nombre: ex.nombre,
      grupoMuscular: ex.grupoMuscular,
      tipo: ex.tipo,
      tipos: 'normal',
      series: 3,
      repeticiones: 10,
      rir: 2
    };
    this.canvasExercises.update(prev => [...prev, newCanvasEx]);
  }

  removeFromCanvas(index: number) {
    this.canvasExercises.update(prev => {
      const copy = [...prev];
      copy.splice(index, 1);
      return copy;
    });
  }

  moveUp(index: number) {
    if (index === 0) return;
    this.canvasExercises.update(prev => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[index - 1];
      copy[index - 1] = temp;
      return copy;
    });
  }

  moveDown(index: number) {
    if (index === this.canvasExercises().length - 1) return;
    this.canvasExercises.update(prev => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[index + 1];
      copy[index + 1] = temp;
      return copy;
    });
  }

  async saveRoutine() {
    if (!this.canSave()) return;

    this.isSaving.set(true);
    try {
      const currentUserId = this.authService.currentUser()?.uid;
      
      const uniqueMuscles = Array.from(new Set(this.canvasExercises().map(e => e.grupoMuscular)));

      const workout: Workout = {
        id: Date.now().toString(),
        nombre: this.workoutName().trim(),
        fecha: new Date().toISOString().split('T')[0],
        nivelDificultad: 'intermedio',
        musculos: uniqueMuscles,
        ejercicios: this.canvasExercises().map((ce, i) => ({
          id: ce.catalogId as number,
          nombre: ce.nombre,
          grupoMuscular: ce.grupoMuscular,
          tipo: ce.tipo,
          tipos: ce.tipos,
          series: ce.series,
          repeticiones: ce.repeticiones,
          rir: ce.rir,
          descanso: '90s'
        }))
      };

      await this.workoutService.addWorkout(workout);
      this.router.navigate(['/workouts', workout.id]);
    } catch (error) {
      console.error('Error al guardar rutina:', error);
    } finally {
      this.isSaving.set(false);
    }
  }
}
