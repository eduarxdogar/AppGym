import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Workout } from '../../models/workout.model';
import { WorkoutService } from '../../core/services/workout.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { UiCardComponent } from '../../shared/ui/ui-card/ui-card.component';
import { UiButtonComponent } from '../../shared/ui/ui-button/ui-button.component';
import { AiCoachService, UserProfile } from '../../core/services/ai-coach.service';
import { MuscleFatigueMapComponent } from '../../shared/ui/muscle-fatigue-map/muscle-fatigue-map.component';

@Component({
  selector: 'app-workout-list',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, UiCardComponent, UiButtonComponent, MuscleFatigueMapComponent],
  templateUrl: './workout-list.component.html',
  styleUrls: ['./workout-list.component.scss'],
})
export class WorkoutListComponent implements OnInit {

  private workoutService = inject(WorkoutService);
  // Exponemos la signal del servicio directamente
  workouts = this.workoutService.workouts;
  private aiCoachService = inject(AiCoachService);
  public router = inject(Router);

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

  ngOnInit(): void {
    // Ya no es necesario inicializar manualmente
  }

  generateAiRoutine() {
    this.router.navigate(['/generator']);
  }

  editWorkout(id: number) {
    this.router.navigate(['/workouts', id]);
  }

  deleteWorkout(id: number) {
    this.workoutService.deleteWorkout(id);
    // La signal se actualiza sola
  }

  addWorkout() {
    const newWorkout: Workout = {
      id: Date.now(),
      fecha: new Date().toISOString(), 
      nombre: 'Nueva Rutina',
      ejercicios: [],
      nivelDificultad: 'principiante', 
    };
    this.workoutService.addWorkout(newWorkout);
    // La signal se actualiza sola
  }
}
