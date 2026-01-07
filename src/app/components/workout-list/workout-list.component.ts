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

  workouts: Workout[] = [];
  
  private workoutService = inject(WorkoutService);
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
    this.workouts = this.workoutService.getWorkouts(); 
  }

  generateAiRoutine() {
    this.isGenerating = true;
    
    const mockProfile: UserProfile = {
      weight: 75,
      height: 180,
      fatigueLevels: this.currentFatigue,
      availableDays: ['Hoy'],
      equipment: ['Gym Completo']
    };

    this.aiCoachService.generateRoutine(mockProfile).subscribe({
      next: (routine) => {
        this.workoutService.addWorkout(routine);
        this.workouts = this.workoutService.getWorkouts();
        this.isGenerating = false;
        // Opcional: navegar a la nueva rutina o mostrar notificación
      },
      error: (err) => {
        console.error('Error generating routine', err);
        this.isGenerating = false;
      }
    });
  }

  editWorkout(id: number) {
    this.router.navigate(['/workouts', id]);
  }

  deleteWorkout(id: number) {
    this.workoutService.deleteWorkout(id);
    this.workouts = this.workoutService.getWorkouts(); 
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
    this.workouts = this.workoutService.getWorkouts(); 
  }
}
