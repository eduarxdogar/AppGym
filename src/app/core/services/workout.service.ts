import { Injectable, signal, computed, inject } from '@angular/core';
import { Workout } from '../../models/workout.model';
import { Ejercicio } from '../../models/ejercicio.model'; 
import { StorageService } from './storage.service';

@Injectable({
  providedIn: 'root'
})
export class WorkoutService {
  private storageService = inject(StorageService);
  private readonly STORAGE_KEY = 'workouts';

  // Signal para manejar el estado de los workouts
  private workoutsSignal = signal<Workout[]>(this.loadFromLocalStorage());

  // Signal computada de solo lectura para exponer los workouts
  readonly workouts = computed(() => this.workoutsSignal());

  private loadFromLocalStorage(): Workout[] {
    return this.storageService.getItem<Workout[]>(this.STORAGE_KEY) || [];
  }

  private saveToLocalStorage() {
    this.storageService.setItem(this.STORAGE_KEY, this.workoutsSignal());
  }

  getWorkouts(): Workout[] {
    return this.workoutsSignal();
  }

  addWorkout(workout: Workout) {
    this.workoutsSignal.update(workouts => [...workouts, workout]);
    this.saveToLocalStorage();
  }

  updateWorkout(workout: Workout) {
    this.workoutsSignal.update(workouts => 
      workouts.map(w => w.id === workout.id ? workout : w)
    );
    this.saveToLocalStorage();
  }

  deleteWorkout(id: number) {
    this.workoutsSignal.update(workouts => 
      workouts.filter(w => w.id !== id)
    );
    this.saveToLocalStorage();
  }

  getWorkoutById(id: number): Workout | undefined {
    return this.workoutsSignal().find(w => w.id === id);
  }

  getWorkoutsByGrupo(grupo: string): Workout[] {
    return this.workoutsSignal().filter(w =>
      w.nombre.toLowerCase().includes(grupo.toLowerCase())
    );
  }

  // Agregar un nuevo ejercicio a una rutina específica
  addExerciseToWorkout(workoutId: number, ejercicio: Ejercicio): void {
    this.workoutsSignal.update(workouts => {
      return workouts.map(workout => {
        if (workout.id === workoutId) {
          return {
            ...workout,
            ejercicios: [...workout.ejercicios, ejercicio]
          };
        }
        return workout;
      });
    });
    this.saveToLocalStorage();
  }

  // Editar un ejercicio existente en una rutina
  editExerciseInWorkout(workoutId: number, ejercicioIndex: number, updatedEjercicio: Ejercicio): void {
    this.workoutsSignal.update(workouts => {
      return workouts.map(workout => {
        if (workout.id === workoutId && workout.ejercicios[ejercicioIndex]) {
          const updatedEjercicios = [...workout.ejercicios];
          updatedEjercicios[ejercicioIndex] = updatedEjercicio;
          return { ...workout, ejercicios: updatedEjercicios };
        }
        return workout;
      });
    });
    this.saveToLocalStorage();
  }

  // Eliminar un ejercicio de una rutina
  deleteExerciseFromWorkout(workoutId: number, ejercicioIndex: number): void {
    this.workoutsSignal.update(workouts => {
      return workouts.map(workout => {
        if (workout.id === workoutId && workout.ejercicios[ejercicioIndex]) {
          const updatedEjercicios = [...workout.ejercicios];
          updatedEjercicios.splice(ejercicioIndex, 1);
          return { ...workout, ejercicios: updatedEjercicios };
        }
        return workout;
      });
    });
    this.saveToLocalStorage();
  }

  // Configurar un ejercicio avanzado (Top Set y Back Set)
  configureAdvancedExercise(workoutId: number, ejercicioIndex: number): void {
    this.workoutsSignal.update(workouts => {
      return workouts.map(workout => {
        if (workout.id === workoutId && workout.ejercicios[ejercicioIndex]) {
          const updatedEjercicios = [...workout.ejercicios];
          const ejercicio = { ...updatedEjercicios[ejercicioIndex] }; // Copia superficial es ok para props simples, pero cuidado con objetos anidados

          // Configurar como Top Set
          ejercicio.tipo = 'compuesto';
          ejercicio.tipos = 'top-set';
          ejercicio.series = 4;
          ejercicio.repeticiones = 6;
          ejercicio.descanso = '5 min';
          ejercicio.rir = 2; 
          ejercicio.parciales = false;
          updatedEjercicios[ejercicioIndex] = ejercicio;

          // Crear un Back Set basado en el Top Set
          const backSet: Ejercicio = {
            ...ejercicio,
            tipos: 'back-set',
            pesokg: (ejercicio.pesokg ?? 0) * 0.8, // 80% del peso del Top Set
            repeticiones: 12,
            descanso: '15 seg',
            rir: 0, // Sin RIR en el Back Set
            parciales: true, // Activar parciales en el Back Set
          };

          updatedEjercicios.push(backSet);
          return { ...workout, ejercicios: updatedEjercicios };
        }
        return workout;
      });
    });
    this.saveToLocalStorage();
  }

  // Añadir una Super Serie a una rutina
  addSuperSetToWorkout(workoutId: number): void {
    const superSet: Ejercicio = {
      id: Date.now(),
      nombre: 'Super Serie',
      grupoMuscular: 'otros',
      tipo: 'compuesto',
      tipos: 'super-serie',
      series: 4,
      repeticiones: 12,
      descanso: '90 seg',
      pesokg: 0,
      serieCalentamiento: 0,
      repeticionesCalentamiento: 0,
    };
    this.addExerciseToWorkout(workoutId, superSet);
  }

  addDropSetToExercise(workoutId: number, ejercicioIndex: number): void {
     this.workoutsSignal.update(workouts => {
      return workouts.map(workout => {
        if (workout.id === workoutId && workout.ejercicios[ejercicioIndex]) {
          const ejercicio = { ...workout.ejercicios[ejercicioIndex] };
          
          if (!ejercicio.pesokg) return workout;

          ejercicio.tipos = 'drop-set';
          ejercicio.dropSet = {
            sets: [
              { porcentaje: 1.0, repeticiones: 6 },
              { porcentaje: 0.8, repeticiones: 10 },
              { porcentaje: 0.6, repeticiones: 15 }
            ]
          };
          
          const updatedEjercicios = [...workout.ejercicios];
          updatedEjercicios[ejercicioIndex] = ejercicio;
          return { ...workout, ejercicios: updatedEjercicios };
        }
        return workout;
      });
     });
     this.saveToLocalStorage();
  }

  addSuperSetToExercise(workoutId: number, ejercicioIndex: number, ejercicioVinculado: Ejercicio): void {
    this.workoutsSignal.update(workouts => {
      return workouts.map(workout => {
        if (workout.id === workoutId && workout.ejercicios[ejercicioIndex]) {
          const ejercicio = { ...workout.ejercicios[ejercicioIndex] };
          // Aquí forzamos que el ejercicio se marque como de tipo "super-serie"
          ejercicio.tipos = 'super-serie';
          // Se asigna el ejercicio vinculado al campo superSetEjercicio.
          ejercicio.superSetEjercicio = ejercicioVinculado;
          
          const updatedEjercicios = [...workout.ejercicios];
          updatedEjercicios[ejercicioIndex] = ejercicio;
          return { ...workout, ejercicios: updatedEjercicios };
        }
        return workout;
      });
    });
    this.saveToLocalStorage();
  }
  
  // Método para verificar si un ejercicio es avanzado
  checkIfAdvanced(workout: Workout): boolean {
    return workout.nivelDificultad === 'avanzado';
  }
}
