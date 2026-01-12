import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UiButtonComponent } from '../../shared/ui/ui-button/ui-button.component';
import { UiCardComponent } from '../../shared/ui/ui-card/ui-card.component';
import { AiCoachService, UserProfile } from '../../core/services/ai-coach.service';
import { Workout } from '../../models/workout.model';
import { WorkoutService } from '../../core/services/workout.service';
import { RecoveryService, MuscleStatus } from '../../core/services/recovery.service';
import { ProfessionalBodyMapComponent } from '../../shared/components/professional-body-map/professional-body-map.component';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-generator',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, ProfessionalBodyMapComponent],
  templateUrl: './generator.component.html',
})
export class GeneratorComponent {
  
  // Dependencies
  private aiService = inject(AiCoachService);
  private workoutService = inject(WorkoutService);
  private recoveryService = inject(RecoveryService);
  private router = inject(Router);

  // State
  userPrompt = signal<string>('');
  isLoading = signal<boolean>(false);
  generatedWorkout = signal<Workout | null>(null);

  // Real Data Signals
  recoveryStatus = this.recoveryService.muscleRecoveryStatus; // Signal<Map<string, MuscleStatus>>

  // Computed: Músculos con recuperación > 90% (o 80% si somos menos estrictos)
  readyToTrain = computed(() => {
    const statusMap = this.recoveryStatus();
    const readyMuscles: string[] = [];

    statusMap.forEach((status, key) => {
        if (status.percentage >= 80) { // 80% threshold for "Ready"
            // Capitalizar nombre
            const formattedName = status.name.charAt(0).toUpperCase() + status.name.slice(1);
            if (!readyMuscles.includes(formattedName)) {
                readyMuscles.push(formattedName);
            }
        }
    });

    if (readyMuscles.length === 0) return 'Todo el cuerpo (Fatiga General)';
    return readyMuscles.join(', ');
  });

  async generate() {
    if (!this.userPrompt().trim()) return;

    this.isLoading.set(true);
    this.generatedWorkout.set(null);

    // Convert Map to plain object record for AI
    const fatigueRecord: Record<string, number> = {};
    this.recoveryStatus().forEach((val, key) => {
        fatigueRecord[key] = val.percentage;
    });

    // Create profile with REAL data
    const profile: UserProfile = {
        weight: 75, // TODO: Get from UserService
        height: 180, // TODO: Get from UserService
        fatigueLevels: fatigueRecord,
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
