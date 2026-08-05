import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { MetricsService } from '../../../features/metrics/services/metrics.service';
import { ProgressionOptions } from '../../../features/workouts/models/workout.model';

@Component({
  selector: 'app-weekly-summary-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule, FormsModule],
  templateUrl: './weekly-summary-modal.component.html'
})
export class WeeklySummaryModalComponent {
  private readonly metricsService = inject(MetricsService);

  @Output() rollover = new EventEmitter<ProgressionOptions>();
  /** Emitted when the user clicks the X or "Cerrar" without configuring the next cycle. */
  @Output() closeModal = new EventEmitter<void>();

  /** Start date of the current microcycle (earliest workout fecha in the plan). */
  @Input() cycleStartDate: Date = new Date();
  /** End date of the current microcycle (latest workout fecha in the plan). */
  @Input() cycleEndDate: Date = new Date();
  @Input() completedDays: number = 0;
  @Input() totalVolume: number = 0;
  @Input() exercisesCompleted: number = 0;

  // State
  step = signal<1 | 2>(1);
  isGenerating = signal(false);

  // Form Models
  selectedFocus = signal<'weight' | 'volume'>('weight');
  frequencyAdj = signal<number>(0);
  direction = signal<'increment' | 'maintain' | 'deload'>('increment');
  isDropdownOpen = signal<boolean>(false);

  frequencyLabel = computed(() => {
    const val = this.frequencyAdj();
    if (val === 1) return 'Agregar un día más (+1)';
    if (val === -1) return 'Quitar un día de entrenamiento (-1)';
    return 'Mantener frecuencia actual';
  });

  // ── Microcycle-scoped metrics ─────────────────────────────────────────────

  cycleSessionsCount = computed(() => this.completedDays);

  cycleVolumeFormatted = computed(() => {
    const vol = this.totalVolume;
    return vol >= 1000 ? (vol / 1000).toFixed(1) + 't' : Math.round(vol) + 'kg';
  });

  cycleExercisesCount = computed(() => this.exercisesCompleted);

  cycleVolume = computed(() => this.totalVolume);

  /**
   * Real calorie sum from WorkoutSession.calories.
   * Falls back to duration-based estimate (MET 5 × 75 kg) when calories
   * were not stored — consistent with MetricsService.gymCalories logic.
   */
  cycleCalories = computed(() => {
    const sessions = this.metricsService.getMicrocycleSessions(this.cycleStartDate, this.cycleEndDate);
    return Math.round(sessions.reduce((acc, s) => {
      if (s.calories && s.calories > 0) return acc + s.calories;
      // Estimate from session timing
      let durationH = 1;
      if (s.endTime && s.startTime) {
        const ms = new Date(s.endTime).getTime() - new Date(s.startTime).getTime();
        if (ms > 0) durationH = ms / 3_600_000;
      }
      return acc + 5.0 * 75 * durationH;
    }, 0));
  });

  cycleTotalSets = computed(() => {
    const sessions = this.metricsService.getMicrocycleSessions(this.cycleStartDate, this.cycleEndDate);
    return sessions.reduce((total, session) => {
      const exercises = session.exercises || session.ejercicios || [];
      return total + exercises.reduce((acc: number, ex: any) => {
        const sets = ex.sets || ex.series || [];
        return acc + sets.filter((s: any) => s.completed !== false).length;
      }, 0);
    }, 0);
  });

  // ── Actions ───────────────────────────────────────────────────────────────

  /** Dismiss the modal without triggering progression/rollover. */
  close() {
    this.closeModal.emit();
  }

  submitRollover() {
    this.isGenerating.set(true);
    const actionMap: Record<'increment' | 'maintain' | 'deload', 'IA_SOBRECARGA' | 'IA_CONSOLIDAR' | 'IA_DESCARGA'> = {
      increment: 'IA_SOBRECARGA',
      maintain: 'IA_CONSOLIDAR',
      deload: 'IA_DESCARGA'
    };
    const actionStr = actionMap[this.direction()];

    this.rollover.emit({
      focus: this.selectedFocus(),
      frequencyAdjustment: this.frequencyAdj(),
      direction: this.direction(),
      action: actionStr
    });
  }

  maintainPlan() {
    this.isGenerating.set(true);
    this.rollover.emit({
      focus: 'weight',
      frequencyAdjustment: 0,
      direction: 'maintain',
      action: 'MANTENER_PLAN'
    });
  }
}
