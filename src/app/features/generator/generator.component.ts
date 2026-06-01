import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { UiButtonComponent } from '../../shared/ui/ui-button/ui-button.component';
import { UiCardComponent } from '../../shared/ui/ui-card/ui-card.component';
import { TrainerAiService } from '../../core/services/ai/trainer-ai.service';
import { UserProfile } from '../../models/user-profile.model';
import { UserProfileStateService } from '../../core/services/user-profile-state.service';
import { Workout } from '../../models/workout.model';
import { WorkoutService } from '../../core/services/workout.service';
import { RecoveryService, MuscleStatus } from '../../core/services/recovery.service';
import { ProfessionalBodyMapComponent } from '../../shared/components/professional-body-map/professional-body-map.component';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-generator',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatIconModule, ProfessionalBodyMapComponent],
  templateUrl: './generator.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeneratorComponent {
  
  // Dependencies
  public aiService = inject(TrainerAiService);
  private workoutService = inject(WorkoutService);
  private recoveryService = inject(RecoveryService);
  private profileState = inject(UserProfileStateService);
  private router = inject(Router);

  // State
  userPrompt = signal<string>('');
  isLoading = signal<boolean>(false);
  generatedWorkout = signal<Workout | null>(null);
  errorMessage = signal<string | null>(null);

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

    const userProfile = this.profileState.profile();
    if (!userProfile) {
        this.errorMessage.set('Configura tu perfil primero.');
        return;
    }

    this.isLoading.set(true);
    this.generatedWorkout.set(null);
    this.errorMessage.set(null);

    // Convert Map to plain object record for AI
    const fatigueRecord: Record<string, number> = {};
    this.recoveryStatus().forEach((val, key) => {
        fatigueRecord[key] = val.percentage;
    });

    // Create profile with REAL data
    const profile: UserProfile = {
        ...userProfile,
        fatigueLevels: fatigueRecord
    };

    // Call AI Service
    try {
        const workout = await this.aiService.generateWorkout(this.userPrompt(), profile);
        this.generatedWorkout.set(workout);
    } catch (err) {
        console.error(err);
        this.errorMessage.set('Ocurrió un error generando la rutina. Por favor intenta de nuevo.');
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
