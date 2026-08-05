import { Component, computed, inject, ChangeDetectionStrategy, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { WorkoutService } from '../../workouts/services/workout.service';
import { RecoveryService } from '../services/recovery.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserProfileStateService } from '../../account/services/user-profile-state.service';
import { MetricsService } from '../services/metrics.service';
import { UiButtonComponent } from '../../../shared/ui/ui-button/ui-button.component';
import { StrengthTierWidgetComponent } from '../../../shared/components/strength-tier-widget/strength-tier-widget.component';
import { Workout } from '../../workouts/models/workout.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, UiButtonComponent, StrengthTierWidgetComponent],
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
  private readonly workoutService = inject(WorkoutService);
  private readonly recoveryService = inject(RecoveryService);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly userProfileState = inject(UserProfileStateService);
  private readonly metricsService = inject(MetricsService);

  // Signals
  workouts: Signal<Workout[]> = this.workoutService.workouts;
  muscleStatus = this.recoveryService.getMuscleRecoveryStatus();
  metrics = this.metricsService.weeklyMetrics;

  // Expose User for Template
  currentUser = this.authService.currentUser;
  userProfile = this.userProfileState.profile;

  // Computed: Días restantes de prueba
  trialDaysRemaining = computed(() => {
    const profile = this.userProfile();
    if (profile?.subscriptionStatus === 'trialing' && profile.trialEndsAt) {
      const endsAt = new Date(profile.trialEndsAt);
      const now = new Date();
      const diffTime = endsAt.getTime() - now.getTime();
      const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(days, 0);
    }
    return null;
  });

  // ── Microcycle date range (from the active plan workouts) ──────────────────
  // These become the Single Source of Truth for the Trends section,
  // replacing the fixed 7-day rolling window.
  private readonly sortedPlanWorkouts = computed<Workout[]>(() =>
    [...this.workouts()].sort(
      (a, b) => new Date(a.fecha ?? 0).getTime() - new Date(b.fecha ?? 0).getTime()
    )
  );

  /** Earliest workout date in the current plan (start of active microcycle). */
  cycleStartDate = computed<Date>(() => {
    const ws = this.sortedPlanWorkouts();
    return ws.length > 0 ? new Date(ws[0].fecha!) : new Date();
  });

  /** Latest workout date in the current plan (end of active microcycle). */
  cycleEndDate = computed<Date>(() => {
    const ws = this.sortedPlanWorkouts();
    return ws.length > 0 ? new Date(ws.at(-1)!.fecha!) : new Date();
  });

  // ── Cycle-scoped metrics (SSoT — same query as the summary modal) ──────────

  /** Sessions completed within the current microcycle date range. */
  private readonly cycleSessions = computed(() =>
    this.metricsService.getMicrocycleSessions(this.cycleStartDate(), this.cycleEndDate())
  );

  cycleWorkoutsCount = computed(() => this.cycleSessions().length);

  cycleTotalVolume = computed(() =>
    this.cycleSessions().reduce((total, s) => {
      const exs = s.exercises || s.ejercicios || [];
      return total + exs.reduce((acc: number, ex: any) => {
        const sets = ex.sets || ex.series || [];
        return acc + sets.reduce((sv: number, set: any) => {
          const reps   = Number(set.reps   || set.repeticiones || 0);
          const weight = Number(set.weight || set.peso || set.pesokg || 0);
          return sv + reps * weight;
        }, 0);
      }, 0);
    }, 0)
  );

  cycleEstimatedCalories = computed(() =>
    Math.round(this.cycleSessions().reduce((acc, s) => {
      // Use stored calories if available, otherwise estimate from duration
      if (s.calories && s.calories > 0) return acc + s.calories;
      let durationH = 1;
      if (s.endTime && s.startTime) {
        const ms = new Date(s.endTime).getTime() - new Date(s.startTime).getTime();
        if (ms > 0) durationH = ms / 3_600_000;
      }
      return acc + 5.0 * 75 * durationH; // MET 5 × default weight 75 kg
    }, 0))
  );

  cycleTotalSets = computed(() =>
    this.cycleSessions().reduce((total, s) => {
      const exs = s.exercises || s.ejercicios || [];
      return total + exs.reduce((acc: number, ex: any) => {
        const sets = ex.sets || ex.series || [];
        return acc + sets.filter((set: any) => set.completed !== false).length;
      }, 0);
    }, 0)
  );

  // Computed: Saludo Dinámico (objeto con dos partes para estilizado premium)
  dynamicGreeting = computed<{ prefix: string; highlight: string }>(() => {
    const hours = new Date().getHours();
    if (hours >= 5 && hours < 12) return { prefix: '¡Buenos días,', highlight: 'máquina!' };
    if (hours >= 12 && hours < 18) return { prefix: '¡Buenas tardes,', highlight: 'fiera!' };
    return { prefix: '¡A mutar,', highlight: 'iniciemos la rutina!' };
  });

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
      // Generic shoulder → Hombro Lateral (default head)
      'hombros': 'Hombro Lateral', 'deltoides': 'Hombro Lateral',
      // Specific deltoid heads
      'hombro anterior': 'Hombro Anterior', 'deltoides anterior': 'Hombro Anterior',
      'hombro lateral': 'Hombro Lateral',   'deltoides lateral': 'Hombro Lateral',
      'hombro posterior': 'Hombro Posterior', 'deltoides posterior': 'Hombro Posterior',
      // Arms / legs
      'bíceps': 'Bíceps', 'tríceps': 'Tríceps',
      'cuádriceps': 'Cuádriceps', 'isquios': 'Isquios',
      'glúteos': 'Glúteos', 'gemelos': 'Gemelos', 'core': 'Core'
    };
    const norm = name.toLowerCase().trim();
    return map[norm] || name;
  }

  // Computed: Promedio de recuperación global (SNC)
  recoveryScore = computed(() => {
    const profile = this.userProfile();
    if (profile?.systemRecovery !== undefined) {
      return profile.systemRecovery;
    }

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

