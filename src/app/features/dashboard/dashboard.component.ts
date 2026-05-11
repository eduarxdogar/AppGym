import { Component, computed, inject, ChangeDetectionStrategy, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { WorkoutService } from '../../core/services/workout.service';
import { RecoveryService } from '../../core/services/recovery.service';
import { AuthService } from '../../core/services/auth.service';
import { MetricsService } from '../../core/services/metrics.service';
import { UiButtonComponent } from '../../shared/ui/ui-button/ui-button.component';
import { Workout, Ejercicio } from '../../models/workout.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, UiButtonComponent],
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  private authService = inject(AuthService);
  private metricsService = inject(MetricsService);

  // Signals
  workouts: Signal<Workout[]> = this.workoutService.workouts;
  muscleStatus = this.recoveryService.getMuscleRecoveryStatus();
  metrics = this.metricsService.weeklyMetrics;

  // Expose User for Template
  currentUser = this.authService.currentUser;

  // Computed: Obtener la última rutina (o la próxima sugerida)
  nextWorkout = computed(() => {
    const all = this.workouts();
    if (all.length === 0) return null;
    
    // Check if there is an explicitly active workout right now
    const active = all.find(w => w.status === 'active');
    if (active) return active;

    // Sort workouts by date ascending to ensure logical sequence (Día 1, Día 2...)
    const sorted = [...all].sort((a, b) => {
       const timeA = a.fecha ? new Date(a.fecha).getTime() : 0;
       const timeB = b.fecha ? new Date(b.fecha).getTime() : 0;
       return timeA - timeB;
    });

    // Find the first workout that has not been completed
    const nextPending = sorted.find(w => !w.isCompleted);

    // If there is a pending workout, return it.
    // If all are completed, return null or an empty marker instead of day 1 to avoid confusion
    return nextPending || null;
  });

  // Computed: Obtener los músculos objetivo dinámicamente según la próxima rutina
  targetMuscles = computed(() => {
    const w = this.nextWorkout();
    if (!w) return [];

    const result: { name: string; percentage: number }[] = [];
    const baseMap: Record<string, number> = {
        'Pectorales': 94, 'Deltoides': 83, 'Tríceps': 78,
        'Espalda': 88, 'Bíceps': 91, 'Cuádriceps': 65, 'Isquios': 70
    };

    // 1. Intentar con la propiedad `musculos` en la raíz del workout
    const musculos = w.musculos || [];
    
    if (musculos.length > 0) {
      musculos.forEach((m: string) => {
        result.push({
          name: m,
          percentage: baseMap[m] || 70 + (m.charCodeAt(0) % 30)
        });
      });
    } else {
      // 2. Si no hay array en la raíz, extraer de los ejercicios
      const extraidos = new Set<string>();
      w.ejercicios.forEach((ex: Ejercicio) => {
        if (ex.grupoMuscular && ex.grupoMuscular !== 'General' && ex.grupoMuscular !== 'otros') {
          extraidos.add(ex.grupoMuscular);
        }
      });
      extraidos.forEach((m: string) => {
        result.push({
          name: m,
          percentage: baseMap[m] || 70 + (m.charCodeAt(0) % 30)
        });
      });
    }

    return result;
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
