import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { WorkoutService } from '../../core/services/workout.service';
import { RecoveryService } from '../../core/services/recovery.service';
import { AuthService } from '../../core/services/auth.service';
import { UiButtonComponent } from '../../shared/ui/ui-button/ui-button.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, UiButtonComponent],
  templateUrl: './dashboard.component.html',
  styles: [`
    :host { display: block; }
    /* Utilitarios personalizados si Tailwind no alcanza para efectos específicos */
    .glow-text { text-shadow: 0 0 10px rgba(204, 255, 0, 0.5); }
    .bg-grid {
       background-image: linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
       linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
       background-size: 30px 30px;
    }
  `]
})
export class DashboardComponent {
  private workoutService = inject(WorkoutService);
  private recoveryService = inject(RecoveryService);
  private router = inject(Router);
  private authService = inject(AuthService); // Inject Auth

  // Signals
  workouts = this.workoutService.workouts;
  muscleStatus = this.recoveryService.getMuscleRecoveryStatus();

  // Expose User for Template
  currentUser = this.authService.currentUser;

  // Computed: Obtener la última rutina (o la próxima sugerida)
  nextWorkout = computed(() => {
    const all = this.workouts();
    if (all.length === 0) return null;
    // Asumimos que la última creada es la "próxima" o la más relevante por ahora
    // En el futuro, esto podría ser "la rutina de hoy" basada en un calendario.
    return all[0]; 
  });

  // Computed: Promedio de recuperación global (0-100)
  globalRecoveryScore = computed(() => {
    const statusMap = this.muscleStatus();
    if (statusMap.size === 0) return 100; // Asumir fresco si no hay datos
    
    let totalPercent = 0;
    statusMap.forEach(s => totalPercent += s.percentage);
    return Math.round(totalPercent / statusMap.size);
  });

  // Computed: Color del anillo basado en score
  recoveryColorClass = computed(() => {
    const score = this.globalRecoveryScore();
    if (score <= 40) return 'text-red-500';
    if (score <= 80) return 'text-yellow-400';
    return 'text-green-500';
  });

  constructor() {}

  navigateToRecovery() {
    this.router.navigate(['/recovery-detail']);
  }

  generateRoutine() {
    this.router.navigate(['/generator']);
  }
}
