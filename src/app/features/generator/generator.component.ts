import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MuscleFatigueMapComponent } from '../../shared/ui/muscle-fatigue-map/muscle-fatigue-map.component';
import { UiButtonComponent } from '../../shared/ui/ui-button/ui-button.component';
import { UiCardComponent } from '../../shared/ui/ui-card/ui-card.component';
import { AiCoachService, UserProfile } from '../../core/services/ai-coach.service';
import { Workout } from '../../models/workout.model';
import { WorkoutService } from '../../core/services/workout.service';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-generator',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MuscleFatigueMapComponent, UiButtonComponent, UiCardComponent],
  templateUrl: './generator.component.html',
})
export class GeneratorComponent {
  
  // Dependencies
  private aiService = inject(AiCoachService);
  private workoutService = inject(WorkoutService);
  private router = inject(Router);

  // State
  userPrompt = signal<string>('');
  isLoading = signal<boolean>(false);
  generatedWorkout = signal<Workout | null>(null);

  // Mock Fatigue Data
  // In a real app, this would come from a store or service based on user history
  currentFatigue = signal<Record<string, number>>({
    'pecho': 80,
    'hombros': 65,
    'piernas': 10,
    'espalda': 10,
    'core': 30,
    'brazos': 45
  });

  get readyToTrain(): string {
     // Simple logic to suggest fresh muscles
     const fresh = Object.entries(this.currentFatigue())
        .filter(([_, val]) => val < 40)
        .map(([key]) => key.charAt(0).toUpperCase() + key.slice(1)); // Capitalize
     
     if (fresh.length === 0) return 'Descanso Activo / Cardio';
     return fresh.join(', ');
  }

  async generate() {
    if (!this.userPrompt().trim()) return;

    this.isLoading.set(true);
    this.generatedWorkout.set(null);

    // Create a dummy profile for the mock
    const profile: UserProfile = {
        weight: 75,
        height: 180,
        fatigueLevels: this.currentFatigue(),
        availableDays: ['Hoy'],
        equipment: ['Gym Completo']
    };

    // Call AI Service
    try {
        const workout = await this.aiService.generateWorkout(this.userPrompt(), profile);
        this.generatedWorkout.set(workout);
    } catch (err) {
        console.error(err);
        alert('Ocurrió un error generando la rutina. Por favor intenta de nuevo.');
    } finally {
        this.isLoading.set(false);
    }
  }

  saveAndStart() {
    const workout = this.generatedWorkout();
    if (workout) {
        this.workoutService.addWorkout(workout);
        // Navigate to edit/detail of the new workout
        this.router.navigate(['/workouts', workout.id]);
    }
  }
}
