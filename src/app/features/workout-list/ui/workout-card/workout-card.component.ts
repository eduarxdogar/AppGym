import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { UiCardComponent } from '../../../../shared/ui/ui-card/ui-card.component';
import { UiButtonComponent } from '../../../../shared/ui/ui-button/ui-button.component';
import { Workout } from '../../../../core/models/workout.model';

@Component({
  selector: 'app-workout-card',
  standalone: true,
  imports: [CommonModule, MatIconModule, UiCardComponent, UiButtonComponent],
  template: `
    <app-ui-card
      [title]="workout().nombre"
      [description]="'Ejercicios: ' + workout().ejercicios.length"
      customClass="bg-white/5 backdrop-blur-sm border-none shadow-md hover:shadow-xl transition duration-300"
      [hasFooter]="true"
    >
      <div class="text-gray-300">
        <p>Nivel: {{ workout().nivelDificultad }}</p>
      </div>
      <div footer class="flex flex-wrap gap-3 justify-end">
        <app-ui-button
          variant="primary"
          customClass="flex items-center gap-1 bg-blue-600 hover:bg-blue-700"
          (clicked)="view.emit(workout().id)"
        >
          <mat-icon>visibility</mat-icon> Ver
        </app-ui-button>
        <app-ui-button
          variant="secondary"
          customClass="flex items-center gap-1 bg-yellow-500 hover:bg-yellow-600"
          (clicked)="edit.emit(workout().id)"
        >
          <mat-icon>edit</mat-icon> Editar
        </app-ui-button>
        <app-ui-button
          variant="danger"
          customClass="flex items-center gap-1 bg-red-600 hover:bg-red-700"
          (clicked)="delete.emit(workout().id)"
        >
          <mat-icon>delete</mat-icon> Eliminar
        </app-ui-button>
      </div>
    </app-ui-card>
  `
})
export class WorkoutCardComponent {
  workout = input.required<Workout>();
  
  view = output<string>();
  edit = output<string>();
  delete = output<string>();
}
