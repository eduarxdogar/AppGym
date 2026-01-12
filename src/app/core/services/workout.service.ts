import { Injectable, signal, computed, inject, Signal } from '@angular/core';
import { Workout } from '../../models/workout.model';
import { Ejercicio } from '../../models/ejercicio.model'; 
import { StorageService } from './storage.service';

@Injectable({
  providedIn: 'root'
})
export class WorkoutService {
  private storageService = inject(StorageService);
  
  // Signal para manejar el estado de los workouts - inicializamos vacío
  private workoutsSignal = signal<Workout[]>([]);
  
  // Signal computada de solo lectura para exponer los workouts
  readonly workouts = computed(() => this.workoutsSignal());

  constructor() {
    // Suscribirse a los cambios en Firestore
    this.storageService.getWorkouts().subscribe({
      next: (workouts) => {
        console.log('Workouts received from Firestore:', workouts);
        this.workoutsSignal.set(workouts);
      },
      error: (err) => {
        console.error('Error fetching workouts:', err);
      }
    });
  }

  // --- Métodos de Acción Asíncronos ---

  // Agregar (Create) - Guarda en Firestore y la suscripción actualizará la UI
  async addWorkout(workout: Workout) {
    await this.storageService.saveWorkout(workout);
    // No hace falta actualizar localmente porque la suscripción lo hará
  }

  // Editar (Update) - Guarda en Firestore
  async updateWorkout(workout: Workout) {
    await this.storageService.saveWorkout(workout);
  }

  // Eliminar (Delete) - Borra en Firestore
  async deleteWorkout(id: number) {
    await this.storageService.deleteWorkout(id);
  }

  getWorkoutById(id: string | number): Signal<Workout | undefined> {
    return computed(() => 
      this.workoutsSignal().find(w => String(w.id) === String(id))
    );
  }

  getWorkoutsByGrupo(grupo: string): Workout[] {
    return this.workoutsSignal().filter(w =>
      w.nombre.toLowerCase().includes(grupo.toLowerCase())
    );
  }

  // --- Refactorización de Sub-items (Ejercicios) ---
  // Estos métodos modifican el objeto localmente y luego guardan TODO el workout.

  // Agregar un nuevo ejercicio a una rutina específica
  async addExerciseToWorkout(workoutId: number, ejercicio: Ejercicio): Promise<void> {
    const workout = this.getWorkoutById(workoutId)();
    if (!workout) return;

    const updatedWorkout = {
        ...workout,
        ejercicios: [...workout.ejercicios, ejercicio]
    };
    await this.storageService.saveWorkout(updatedWorkout);
  }

  // Editar un ejercicio existente en una rutina
  async editExerciseInWorkout(workoutId: number, ejercicioIndex: number, updatedEjercicio: Ejercicio): Promise<void> {
    const workout = this.getWorkoutById(workoutId)();
    if (!workout || !workout.ejercicios[ejercicioIndex]) return;

    const updatedEjercicios = [...workout.ejercicios];
    updatedEjercicios[ejercicioIndex] = updatedEjercicio;
    const updatedWorkout = { ...workout, ejercicios: updatedEjercicios };
    
    await this.storageService.saveWorkout(updatedWorkout);
  }

  // Eliminar un ejercicio de una rutina
  async deleteExerciseFromWorkout(workoutId: number, ejercicioIndex: number): Promise<void> {
    const workout = this.getWorkoutById(workoutId)();
    if (!workout || !workout.ejercicios[ejercicioIndex]) return;

    const updatedEjercicios = [...workout.ejercicios];
    updatedEjercicios.splice(ejercicioIndex, 1);
    const updatedWorkout = { ...workout, ejercicios: updatedEjercicios };

    await this.storageService.saveWorkout(updatedWorkout);
  }

  // Configurar un ejercicio avanzado (Top Set y Back Set)
  async configureAdvancedExercise(workoutId: number, ejercicioIndex: number): Promise<void> {
    const workout = this.getWorkoutById(workoutId)();
    if (!workout || !workout.ejercicios[ejercicioIndex]) return;

    const updatedEjercicios = [...workout.ejercicios];
    const ejercicio = { ...updatedEjercicios[ejercicioIndex] };

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
      rir: 0, 
      parciales: true,
    };

    updatedEjercicios.push(backSet);
    const updatedWorkout = { ...workout, ejercicios: updatedEjercicios };
    await this.storageService.saveWorkout(updatedWorkout);
  }

  // Añadir una Super Serie a una rutina
  async addSuperSetToWorkout(workoutId: number): Promise<void> {
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
    await this.addExerciseToWorkout(workoutId, superSet);
  }

  async addDropSetToExercise(workoutId: number, ejercicioIndex: number): Promise<void> {
    const workout = this.getWorkoutById(workoutId)();
    if (!workout || !workout.ejercicios[ejercicioIndex]) return;
    
    const ejercicio = { ...workout.ejercicios[ejercicioIndex] };
    if (!ejercicio.pesokg) return;

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
    const updatedWorkout = { ...workout, ejercicios: updatedEjercicios };
    await this.storageService.saveWorkout(updatedWorkout);
  }

  async addSuperSetToExercise(workoutId: number, ejercicioIndex: number, ejercicioVinculado: Ejercicio): Promise<void> {
    const workout = this.getWorkoutById(workoutId)();
    if (!workout || !workout.ejercicios[ejercicioIndex]) return;

    const ejercicio = { ...workout.ejercicios[ejercicioIndex] };
    ejercicio.tipos = 'super-serie';
    ejercicio.superSetEjercicio = ejercicioVinculado;
    
    const updatedEjercicios = [...workout.ejercicios];
    updatedEjercicios[ejercicioIndex] = ejercicio;
    const updatedWorkout = { ...workout, ejercicios: updatedEjercicios };
    await this.storageService.saveWorkout(updatedWorkout);
  }
  
  // Método para verificar si un ejercicio es avanzado
  checkIfAdvanced(workout: Workout): boolean {
    return workout.nivelDificultad === 'avanzado';
  }
}
