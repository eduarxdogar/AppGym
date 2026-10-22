import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { TrainingClockService } from './training-clock.service';
import { sessionVolume, sessionSetCount, sessionCalories } from '../utils/workout-session.utils';
import { StorageService } from './storage.service';
import { CardioSessionService } from './cardio-session.service';
import { WorkoutSession } from '../models/workout-history.model';
import { WeeklyMetrics } from '../models/stats-data.model';


@Injectable({ providedIn: 'root' })
export class MetricsService {
  private readonly clock = inject(TrainingClockService);
  private readonly storageService = inject(StorageService);
  private readonly cardioService = inject(CardioSessionService);

  // ─── Reactive history signal (from workout_history Firestore collection) ─────
  // This is the TRUE source of completed sessions, updated in real time.
  private readonly history = toSignal(
    this.storageService.getHistory().pipe(
      catchError(() => of([] as WorkoutSession[]))
    ),
    { initialValue: [] as WorkoutSession[] }
  );

  // ─── Utilidades de Fecha ──────────────────────────────────────────────

  private isWithinLastNDays(isoDate: string | undefined, days: number): boolean {
    if (!isoDate) return false;
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return false;
    const now = new Date(Math.max(this.clock.now(), Date.now()));
    if (d.getTime() > now.getTime()) return false;
    const start = new Date(now);
    start.setDate(now.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);
    return d >= start && d <= now;
  }

  // ─── History-based computeds (SOURCE OF TRUTH for completions) ────────

  readonly last7DaysSessions = computed<WorkoutSession[]>(() =>
    (this.history() ?? []).filter(s =>
      this.isWithinLastNDays(s.endTime || s.startTime || s.fecha, 7)
    )
  );

  /** Number of distinct gym sessions in the last 7 days */
  readonly workoutsCount = computed<number>(() => this.last7DaysSessions().length);

  /**
   * Returns sessions completed within an exact microcycle date range.
   * Used by the weekly-summary modal so the count matches the real cycle,
   * not a rolling 7-day window.
   */
  getMicrocycleSessions(startDate: Date, endDate: Date): WorkoutSession[] {
    const start = new Date(startDate).setHours(0, 0, 0, 0);
    // Include the full end day (23:59:59.999)
    const end = new Date(endDate).setHours(23, 59, 59, 999);
    return (this.history() ?? []).filter(s => {
      const raw = s.endTime || s.startTime || s.fecha;
      if (!raw) return false;
      const t = new Date(raw).getTime();
      return t >= start && t <= end;
    });
  }

  /** Total lifted volume from history (reps × weight) in the last 7 days */
  readonly totalVolume = computed(() => this.last7DaysSessions().reduce((sum, session) => sum + sessionVolume(session), 0));
  readonly totalSets = computed(() => this.last7DaysSessions().reduce((sum, session) => sum + sessionSetCount(session), 0));
  readonly gymCalories = computed(() => this.last7DaysSessions().reduce((sum, session) => sum + sessionCalories(session), 0));

  // ─── Cardio computeds ────────────────────────────────────────────────

  readonly last7DaysCardio = computed(() =>
    this.cardioService.cardioSessions().filter(s =>
      this.isWithinLastNDays(s.date, 7)
    )
  );

  readonly cardioSessionsCount = computed(() => this.last7DaysCardio().length);

  readonly cardioCalories = computed<number>(() =>
    this.last7DaysCardio().reduce((sum, s) => sum + (s.caloriesBurned || 0), 0)
  );

  // ─── Unified computed ─────────────────────────────────────────────────

  readonly estimatedCalories = computed<number>(() => {
    return this.gymCalories() + this.cardioCalories();
  });

  readonly weeklyMetrics = computed<WeeklyMetrics>(() => ({
    workoutsCount: this.workoutsCount(),
    totalVolume: this.totalVolume(),
    estimatedCalories: this.estimatedCalories(),
    gymCalories: this.gymCalories(),
    cardioCalories: this.cardioCalories(),
    totalSets: this.totalSets(),
    cardioSessionsCount: this.cardioSessionsCount(),
  }));
}


