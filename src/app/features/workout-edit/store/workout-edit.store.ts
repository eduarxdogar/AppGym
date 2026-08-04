import { Injectable, inject, signal } from '@angular/core';
import { Workout } from '../../../core/models/workout.model';
import { Ejercicio } from '../../../core/models/ejercicio.model';
import { WorkoutService } from '../../../core/services/workout.service';

@Injectable()
export class WorkoutEditStore {
  private readonly workoutService = inject(WorkoutService);

  readonly workoutForm = signal<Workout | null>(null);
  readonly newExercise = signal<Ejercicio>(this.createEmptyExercise());
  readonly editingExerciseIndex = signal<number | null>(null);

  loadWorkout(id: string): void {
    const workoutSignal = this.workoutService.getWorkoutById(id);
    const found = workoutSignal();
    
    if (found) {
      this.workoutForm.set(structuredClone(found));
    }
  }

  createEmptyExercise(): Ejercicio {
    return {
      id: Date.now(),
      nombre: '',
      grupoMuscular: 'otros',
      tipo: 'compuesto',
      series: 3,
      repeticiones: 10,
      descanso: '90s',
      pesokg: 0,
      serieCalentamiento: 0,
      repeticionesCalentamiento: 0,
      videoUrl: '',
    };
  }

  addExercise(): void {
    const currentWorkout = this.workoutForm();
    if (!currentWorkout) return;

    const currentExercise = this.newExercise();
    if (!currentExercise.nombre) return; 

    const updatedWorkout = { ...currentWorkout };
    
    if (this.editingExerciseIndex() !== null) {
      updatedWorkout.ejercicios[this.editingExerciseIndex()!] = { ...currentExercise };
      this.editingExerciseIndex.set(null);
    } else {
      updatedWorkout.ejercicios = [...updatedWorkout.ejercicios, { ...currentExercise, id: Date.now() }];
    }

    this.workoutForm.set(updatedWorkout);
    this.newExercise.set(this.createEmptyExercise());
  }

  editExercise(index: number): void {
    const workout = this.workoutForm();
    if (!workout) return;
    
    this.newExercise.set(structuredClone(workout.ejercicios[index]));
    this.editingExerciseIndex.set(index);
  }

  deleteExercise(index: number): void {
    const workout = this.workoutForm();
    if (!workout) return;

    const updatedWorkout = { ...workout };
    updatedWorkout.ejercicios = workout.ejercicios.filter((_, i) => i !== index);
    this.workoutForm.set(updatedWorkout);
  }

  cancelEdit(): void {
    this.editingExerciseIndex.set(null);
    this.newExercise.set(this.createEmptyExercise());
  }

  saveChanges(): void {
    const finalWorkout = this.workoutForm();
    if (finalWorkout) {
      this.workoutService.updateWorkout(finalWorkout);
    }
  }

  updateSuperSet(index: number, superSetEjercicio: Ejercicio): void {
    const workout = this.workoutForm();
    if (!workout) return;
    const updatedWorkout = { ...workout };
    updatedWorkout.ejercicios[index].superSetEjercicio = superSetEjercicio;
    updatedWorkout.ejercicios[index].superSetEjercicio!.tipos = 'super-serie';
    this.workoutForm.set(updatedWorkout);
  }

  updateDropSet(index: number, result: Ejercicio): void {
    const workout = this.workoutForm();
    if (!workout) return;
    const updatedWorkout = { ...workout };
    updatedWorkout.ejercicios[index].dropSet = {
        sets: [
            { porcentaje: 80, repeticiones: result.repeticiones, peso: result.pesokg },
            { porcentaje: 60, repeticiones: result.repeticiones, peso: (result.pesokg || 0) * 0.8 } 
        ]
    };
    updatedWorkout.ejercicios[index].tipos = 'drop-set';
    this.workoutForm.set(updatedWorkout);
  }
}
