import { Injectable } from '@angular/core';
import { Workout } from '../../models/workout.model';
import { Ejercicio } from '../../models/ejercicio.model'; 
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WorkoutService {
  private workoutsSubject = new BehaviorSubject<Workout[]>(this.loadFromLocalStorage());
  workouts$ = this.workoutsSubject.asObservable();

  private loadFromLocalStorage(): Workout[] {
    const data = localStorage.getItem('workouts');
    return data ? JSON.parse(data) : [];
  }

  private saveToLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.workoutsSubject.value));
  }

  getWorkouts(): Workout[] {
    return this.workoutsSubject.value;
  }

  addWorkout(workout: Workout) {
    const updated = [...this.workoutsSubject.value, workout];
    this.workoutsSubject.next(updated);
    this.saveToLocalStorage();
  }

  updateWorkout(workout: Workout) {
    const updated = this.workoutsSubject.value.map(w => w.id === workout.id ? workout : w);
    this.workoutsSubject.next(updated);
    this.saveToLocalStorage();
  }

  deleteWorkout(id: number) {
    const updated = this.workoutsSubject.value.filter(w => w.id !== id);
    this.workoutsSubject.next(updated);
    this.saveToLocalStorage();
  }

  getWorkoutById(id: number): Workout | undefined {
    return this.workoutsSubject.value.find(w => w.id === id);
  }
  getWorkoutsByGrupo(grupo: string): Workout[] {
    return this.workoutsSubject.value.filter(w =>
      w.nombre.toLowerCase().includes(grupo.toLowerCase())
    );
  }


  // Agregar un nuevo ejercicio a una rutina específica
  addExerciseToWorkout(workoutId: number, ejercicio: Ejercicio): void {
    const workouts = this.workoutsSubject.value;
    const workout = workouts.find(w => w.id === workoutId);

    if (workout) {
      workout.ejercicios = [...workout.ejercicios, ejercicio];
      this.updateWorkout(workout); // Actualiza la rutina con el nuevo ejercicio
    }
  }

  // Editar un ejercicio existente en una rutina
  editExerciseInWorkout(workoutId: number, ejercicioIndex: number, updatedEjercicio: Ejercicio): void {
    const workouts = this.workoutsSubject.value;
    const workout = workouts.find(w => w.id === workoutId);

    if (workout && workout.ejercicios[ejercicioIndex]) {
      workout.ejercicios[ejercicioIndex] = updatedEjercicio;
      this.updateWorkout(workout); // Actualiza la rutina con el ejercicio editado
    }
  }

  // Eliminar un ejercicio de una rutina
  deleteExerciseFromWorkout(workoutId: number, ejercicioIndex: number): void {
    const workouts = this.workoutsSubject.value;
    const workout = workouts.find(w => w.id === workoutId);

    if (workout && workout.ejercicios[ejercicioIndex]) {
      workout.ejercicios.splice(ejercicioIndex, 1);
      this.updateWorkout(workout); // Actualiza la rutina sin el ejercicio eliminado
    }
  }

  // Configurar un ejercicio avanzado (Top Set y Back Set)
  configureAdvancedExercise(workoutId: number, ejercicioIndex: number): void {
    const workouts = this.workoutsSubject.value;
    const workout = workouts.find(w => w.id === workoutId);

    if (workout && workout.ejercicios[ejercicioIndex]) {
      const ejercicio = workout.ejercicios[ejercicioIndex];

      // Configurar como Top Set
      ejercicio.tipo = 'compuesto';
      ejercicio.tipos = 'top-set';
      ejercicio.series = 4;
      ejercicio.repeticiones = 6;
      ejercicio.descanso = '5 min';
      ejercicio.rir = 2; 
      ejercicio.parciales = false;

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

      // Añadir el Back Set a la rutina
      workout.ejercicios.push(backSet);
      this.updateWorkout(workout); // Actualiza la rutina con el ejercicio avanzado
    }
  }

  // Añadir una Super Serie a una rutina
  addSuperSetToWorkout(workoutId: number): void {
    const workouts = this.workoutsSubject.value;
    const workout = workouts.find(w => w.id === workoutId);

    if (workout) {
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

      workout.ejercicios = [...workout.ejercicios, superSet];
      this.updateWorkout(workout); // Actualiza la rutina con la Super Serie
    }
  }
  addDropSetToExercise(workoutId: number, ejercicioIndex: number): void {
    const workouts = this.workoutsSubject.value;
    const workout = workouts.find(w => w.id === workoutId);
  
    if (workout && workout.ejercicios[ejercicioIndex]) {
      const ejercicio = workout.ejercicios[ejercicioIndex];
  
      if (!ejercicio.pesokg) return;
  
      ejercicio.tipos = 'drop-set';
      ejercicio.dropSet = {
        sets: [
          { porcentaje: 1.0, repeticiones: 6 },
          { porcentaje: 0.8, repeticiones: 10 },
          { porcentaje: 0.6, repeticiones: 15 }
        ]
      };
  
      this.updateWorkout(workout);
    }
  }
  addSuperSetToExercise(workoutId: number, ejercicioIndex: number, ejercicioVinculado: Ejercicio): void {
    const workouts = this.workoutsSubject.value;
    const workout = workouts.find(w => w.id === workoutId);
  
    if (workout && workout.ejercicios[ejercicioIndex]) {
      const ejercicio = workout.ejercicios[ejercicioIndex];
      ejercicio.tipos = 'super-serie';
      ejercicio.superSetEjercicio = ejercicioVinculado;
      this.updateWorkout(workout);
    }
  }
    
}
