import { Component, input, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Ejercicio } from '../models/ejercicio.model';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { EditarSuperSetModalComponent } from '../workout-detail/modals/editar-super-set-modal/editar-super-set-modal.component';
import { UiButtonComponent } from '../../../shared/ui/ui-button/ui-button.component';
import { UiCardComponent } from '../../../shared/ui/ui-card/ui-card.component';
import { WorkoutFormComponent } from './ui/workout-form/workout-form.component';
import { WorkoutEditStore } from './store/workout-edit.store';

@Component({
  selector: 'app-workout-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatMenuModule, UiButtonComponent, UiCardComponent, MatDialogModule, WorkoutFormComponent],
  templateUrl: './workout-edit.component.html',
  providers: [WorkoutEditStore]
})
export class WorkoutEditComponent {
  id = input<string>();
  public readonly store = inject(WorkoutEditStore);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  grupoMuscularOpciones = ['otros', 'pecho', 'espalda', 'piernas', 'hombros', 'bíceps', 'tríceps', 'core'];
  nivelesDisponibles: ('principiante' | 'intermedio' | 'avanzado')[] = ['principiante', 'intermedio', 'avanzado'];

  constructor() {
    effect(() => {
      const workoutId = this.id();
      if (workoutId) {
        this.store.loadWorkout(workoutId);
      }
    }, { allowSignalWrites: true });
  }

  saveChanges(): void {
    this.store.saveChanges();
    this.router.navigate(['/workouts']);
  }

  cancel(): void {
    this.router.navigate(['/workouts']);
  }

  isAdvancedOrIntermediate(): boolean {
    const difficulty = this.store.workoutForm()?.nivelDificultad;
    return difficulty === 'intermedio' || difficulty === 'avanzado';
  }

  addSuperSet(index: number): void {
    const workout = this.store.workoutForm();
    if (!workout) return;
    
    const superSetExercise = this.store.createEmptyExercise();
    superSetExercise.nombre = `Super Set de ${workout.ejercicios[index].nombre}`;

    const dialogRef = this.dialog.open(EditarSuperSetModalComponent, {
      width: '500px',
      data: superSetExercise,
      panelClass: 'gravl-dialog-panel',
      backdropClass: 'backdrop-blur-sm'
    });

    dialogRef.afterClosed().subscribe((result: Ejercicio | undefined) => {
      if (result) {
        this.store.updateSuperSet(index, result);
      }
    });
  }

  addDropsetAvanzado(index: number): void {
    const workout = this.store.workoutForm();
    if (!workout) return;

    const currentExercise = workout.ejercicios[index];
    
    const dialogRef = this.dialog.open(EditarSuperSetModalComponent, {
      width: '500px',
      data: { ...currentExercise, nombre: 'Configurar Drop Set' },
      panelClass: 'gravl-dialog-panel',
      backdropClass: 'backdrop-blur-sm'
    });

    dialogRef.afterClosed().subscribe((result: Ejercicio | undefined) => {
      if (result) {
        this.store.updateDropSet(index, result);
      }
    });
  }
}
