import { Component, OnInit, ChangeDetectorRef, input, signal, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Workout } from '../../models/workout.model';
import { Ejercicio } from '../../models/ejercicio.model';
import { WorkoutService } from '../../core/services/workout.service';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { EditarSuperSetModalComponent } from '../modals/editar-super-set-modal/editar-super-set-modal.component';
import { UiButtonComponent } from '../../shared/ui/ui-button/ui-button.component';
import { UiCardComponent } from '../../shared/ui/ui-card/ui-card.component';
import { UiInputComponent } from '../../shared/ui/ui-input/ui-input.component';

@Component({
  selector: 'app-workout-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatMenuModule, UiButtonComponent, UiCardComponent, MatDialogModule],
  templateUrl: './workout-edit.component.html',
})
export class WorkoutEditComponent {
  // Input Binding from Router
  id = input<string>();

  // Local Mutable State
  workoutForm = signal<Workout | null>(null);
  
  // Dependencies
  private workoutService = inject(WorkoutService);
  private router = inject(Router);
  private dialog = inject(MatDialog);

  // Constants
  grupoMuscularOpciones = ['otros', 'pecho', 'espalda', 'piernas', 'hombros', 'bíceps', 'tríceps', 'core'];
  nivelesDisponibles: ('principiante' | 'intermedio' | 'avanzado')[] = ['principiante', 'intermedio', 'avanzado'];
  
  // New Exercise State
  newExercise = signal<Ejercicio>(this.createEmptyExercise());
  editingExerciseIndex = signal<number | null>(null);

  constructor() {
    // Effect to load data when ID changes
    effect(() => {
      const workoutId = Number(this.id());
      if (workoutId) {
        const found = this.workoutService.getWorkoutById(workoutId);
        if (found) {
          // Deep clone to avoid mutating service state directly until saved
          this.workoutForm.set(structuredClone(found));
        } else {
          console.error('Workout not found');
          // Handle Error or Redirect?
        }
      }
    }, { allowSignalWrites: true });
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

  // --- Actions ---

  addExercise(): void {
    const currentWorkout = this.workoutForm();
    if (!currentWorkout) return;

    const currentExercise = this.newExercise();
    if (!currentExercise.nombre) return; // Simple validation

    const updatedWorkout = { ...currentWorkout }; // Shallow copy of workout container
    
    if (this.editingExerciseIndex() !== null) {
      // Update existing
      updatedWorkout.ejercicios[this.editingExerciseIndex()!] = { ...currentExercise };
      this.editingExerciseIndex.set(null);
    } else {
      // Add new
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

  // --- Persistence ---

  saveChanges(): void {
    const finalWorkout = this.workoutForm();
    if (finalWorkout) {
      this.workoutService.updateWorkout(finalWorkout);
      console.log('Saved:', finalWorkout);
      this.router.navigate(['/workouts']);
    }
  }

  cancel(): void {
    this.router.navigate(['/workouts']);
  }

  // --- Advanced Features Helpers (SuperSet / DropSet) ---
  // Re-implementing simplified versions for the new structure if needed by the UI
  // Note: Complex logic like specific DropSet arrays might need more UI work, 
  // keeping basic structure for now.

  // Helper to check if advanced features should be enabled
  isAdvancedOrIntermediate(): boolean {
    const difficulty = this.workoutForm()?.nivelDificultad;
    return difficulty === 'intermedio' || difficulty === 'avanzado';
  }

  addSuperSet(index: number): void {
    const workout = this.workoutForm();
    if (!workout) return;
    
    // Create new empty exercise for the Super Set
    const superSetExercise = this.createEmptyExercise();
    superSetExercise.nombre = `Super Set de ${workout.ejercicios[index].nombre}`;

    const dialogRef = this.dialog.open(EditarSuperSetModalComponent, {
      width: '500px',
      data: superSetExercise
    });

    dialogRef.afterClosed().subscribe((result: Ejercicio | undefined) => {
      if (result) {
        const updatedWorkout = { ...workout };
        if (!updatedWorkout.ejercicios[index].superSetEjercicio) {
            // Assign the new super set exercise
            updatedWorkout.ejercicios[index].superSetEjercicio = result;
        } else {
            // If exists, simple update (though logic might vary if you want list)
            updatedWorkout.ejercicios[index].superSetEjercicio = result; 
        }
        // Mark as super-serie type to ensure consistency
        updatedWorkout.ejercicios[index].superSetEjercicio!.tipos = 'super-serie';
        
        this.workoutForm.set(updatedWorkout);
      }
    });
  }

  addDropsetAvanzado(index: number): void {
    const workout = this.workoutForm();
    if (!workout) return;

    // Use current exercise as base for Drop Set config
    const currentExercise = workout.ejercicios[index];
    
    // Pass current exercise (or a specific structure) to modal
    // For now reusing the modal to edit technical details
    const dialogRef = this.dialog.open(EditarSuperSetModalComponent, {
      width: '500px',
      data: { ...currentExercise, nombre: 'Configurar Drop Set' }
    });

    dialogRef.afterClosed().subscribe((result: Ejercicio | undefined) => {
      if (result) {
        const updatedWorkout = { ...workout };
        // Logic: Create a Drop Set structure based on the result
        // For simple MVP: we just create one drop set entry based on the result
        updatedWorkout.ejercicios[index].dropSet = {
            sets: [
                { porcentaje: 80, repeticiones: result.repeticiones, peso: result.pesokg }, // Example logic
                { porcentaje: 60, repeticiones: result.repeticiones, peso: (result.pesokg || 0) * 0.8 } 
            ]
        };
        updatedWorkout.ejercicios[index].tipos = 'drop-set';

        this.workoutForm.set(updatedWorkout);
      }
    });
  }
}
