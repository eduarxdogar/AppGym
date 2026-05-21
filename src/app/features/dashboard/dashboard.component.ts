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

  // Computed: Obtener los músculos objetivo con su estado de recuperación REAL
  targetMuscles = computed(() => {
    const w = this.nextWorkout();
    if (!w) return [];

    const statusMap = this.muscleStatus();
    const result: { name: string; percentage: number }[] = [];

    // Extraer músculos del workout
    const workoutMuscles = new Set<string>();
    if (w.musculos?.length) {
      w.musculos.forEach(m => workoutMuscles.add(this.normalizeMuscleName(m)));
    } else {
      w.ejercicios.forEach(ex => {
        if (ex.grupoMuscular) workoutMuscles.add(this.normalizeMuscleName(ex.grupoMuscular));
      });
    }

    workoutMuscles.forEach(m => {
      const status = statusMap.get(m);
      if (status) {
        result.push({
          name: m,
          percentage: status.percentage
        });
      }
    });

    return result;
  });

  private normalizeMuscleName(name: string): string {
    const map: Record<string, string> = {
      'pecho': 'Pecho', 'pectorales': 'Pecho',
      'espalda': 'Espalda', 'dorsales': 'Espalda',
      'hombros': 'Hombros', 'deltoides': 'Hombros',
      'bíceps': 'Bíceps', 'tríceps': 'Tríceps',
      'cuádriceps': 'Cuádriceps', 'isquios': 'Isquios',
      'glúteos': 'Glúteos', 'gemelos': 'Gemelos', 'core': 'Core'
    };
    const norm = name.toLowerCase().trim();
    return map[norm] || name;
  }

  // Computed: Promedio de recuperación global (SNC)
  recoveryScore = computed(() => {
    const statusMap = this.muscleStatus();
    if (statusMap.size === 0) return 100;
    
    let totalPercent = 0;
    let minPercent = 100;
    
    statusMap.forEach(s => {
      totalPercent += s.percentage;
      if (s.percentage < minPercent) minPercent = s.percentage;
    });

    // El score global es un promedio ponderado que castiga más la fatiga extrema (SNC)
    const average = totalPercent / statusMap.size;
    return Math.round((average * 0.7) + (minPercent * 0.3));
  });

  // Computed: Color del anillo basado en score (Cyberpunk Palette)
  recoveryColorClass = computed(() => {
    const score = this.recoveryScore();
    if (score <= 30) return 'text-[#FF0033]'; // Rojo Alerta
    if (score <= 75) return 'text-[#FFB300]'; // Ámbar
    return 'text-[#CCFF00]';                 // Verde Neón
  });

  constructor() {}

  navigateToRecovery() {
    this.router.navigate(['/recovery-detail']);
  }

  generateRoutine() {
    this.router.navigate(['/generator']);
  }
}
