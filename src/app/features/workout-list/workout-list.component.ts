import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Workout } from '../../core/models/workout.model';
import { WorkoutService } from '../../core/services/workout.service';

import { MatIconModule } from '@angular/material/icon';
import { UiCardComponent } from '../../shared/ui/ui-card/ui-card.component';
import { UiButtonComponent } from '../../shared/ui/ui-button/ui-button.component';

import { RecoveryMonitorComponent } from '../../features/dashboard/components/recovery-monitor/recovery-monitor.component';

@Component({
  selector: 'app-workout-list',
  standalone: true,
  imports: [RouterModule, MatIconModule, UiCardComponent, UiButtonComponent, RecoveryMonitorComponent],
  templateUrl: './workout-list.component.html',
})
export class WorkoutListComponent {

  private readonly workoutService = inject(WorkoutService);
  // Exponemos la signal del servicio directamente
  workouts = this.workoutService.workouts;

  public readonly router = inject(Router);

  // Datos Mock para el mapa de fatiga (luego vendrían de un servicio de historial)
  currentFatigue: Record<string, number> = {
    'pecho': 80,
    'hombros': 65,
    'piernas': 10,
    'core': 30,
    'brazos': 55
  };

  isGenerating = false;

  constructor() {}



  generateAiRoutine() {
    this.router.navigate(['/generator']);
  }

  editWorkout(id: string) {
    this.router.navigate(['/workouts', id]);
  }

  deleteWorkout(id: string) {
    this.workoutService.deleteWorkout(id);
    // La signal se actualiza sola
  }

  addWorkout() {
    const newWorkout: Workout = {
      id: crypto.randomUUID(),
      fecha: new Date().toISOString(), 
      nombre: 'Nueva Rutina',
      ejercicios: [],
      nivelDificultad: 'principiante', 
    };
    this.workoutService.addWorkout(newWorkout);
    // La signal se actualiza sola
  }
}

