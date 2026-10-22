import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { MetricsService } from '../../../core/services/metrics.service';
import { ProgressionOptions } from '../../../core/models/workout.model';
import { sessionVolume, sessionSetCount, sessionCalories } from '../../../core/utils/workout-session.utils';

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

  // State
  step = signal<1 | 2>(1);
  isGenerating = signal(false);

  // Form Models
  selectedFocus = signal<'weight' | 'volume'>('weight');
  frequencyAdj = signal<number>(0);
  direction = signal<'increment' | 'maintain' | 'deload'>('increment');

  // ── Microcycle-scoped metrics ─────────────────────────────────────────────

  cycleSessionsCount = computed(() =>
    this.metricsService.getMicrocycleSessions(this.cycleStartDate, this.cycleEndDate).length
  );

  cycleVolumeFormatted = computed(() => {
    const vol = this.cycleVolume();
    return vol >= 1000 ? (vol / 1000).toFixed(1) + 't' : Math.round(vol) + 'kg';
  });

  cycleExercisesCount = computed(() => {
    const sessions = this.metricsService.getMicrocycleSessions(this.cycleStartDate, this.cycleEndDate);
    return sessions.reduce((total, session) => total + (session.exercises?.length || session.ejercicios?.length || 0), 0);
  });

  cycleVolume = computed(() => this.metricsService.getMicrocycleSessions(this.cycleStartDate, this.cycleEndDate)
    .reduce((sum, session) => sum + sessionVolume(session), 0));
  cycleCalories = computed(() => this.metricsService.getMicrocycleSessions(this.cycleStartDate, this.cycleEndDate)
    .reduce((sum, session) => sum + sessionCalories(session), 0));
  cycleTotalSets = computed(() => this.metricsService.getMicrocycleSessions(this.cycleStartDate, this.cycleEndDate)
    .reduce((sum, session) => sum + sessionSetCount(session), 0));

  // ── Actions ───────────────────────────────────────────────────────────────

  /** Dismiss the modal without triggering progression/rollover. */
  close() {
    this.closeModal.emit();
  }

  submitRollover() {
    this.isGenerating.set(true);
    this.rollover.emit({
      focus: this.selectedFocus(),
      frequencyAdjustment: this.frequencyAdj()
    });
  }
}
