import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { WorkoutService } from './workout.service';
import { StorageService } from './storage.service';
import { CardioSessionService } from './cardio-session.service';
import { WorkoutSession, WorkoutExercise, WorkoutSet } from '../models/workout-history.model';
import { WeeklyMetrics } from '../models/stats-data.model';

const DEFAULT_USER_WEIGHT_KG = 75;
const RESISTANCE_MET = 6;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class MetricsService {
  private readonly workoutService = inject(WorkoutService);
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
    const now = new Date();
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
    const start = startDate.getTime();
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
  readonly totalVolume = computed<number>(() =>
    this.last7DaysSessions().reduce((total, session) => {
      const exercises = session.exercises || session.ejercicios || [];
      const sessionVol = exercises.reduce((acc, ex) => {
        const sets = ex.sets || ex.series || [];
        return acc + sets.reduce((s, set) => {
          const reps = Number(set.reps || set.repeticiones || 0);
          const weight = Number(set.weight || set.peso || set.pesokg || 0);
          return s + (reps * weight);
        }, 0);
      }, 0);
      return total + sessionVol;
    }, 0)
  );

  /** Total working sets across all sessions in the last 7 days */
  readonly totalSets = computed<number>(() =>
    this.last7DaysSessions().reduce((total, session) => {
      const exercises = session.exercises || session.ejercicios || [];
      return total + (exercises as WorkoutExercise[]).reduce((acc: number, ex: WorkoutExercise) => {
        const sets = ex.sets || ex.series || [];
        return acc + sets.filter((s: WorkoutSet) => s.completed !== false).length;
      }, 0);
    }, 0)
  );

  /** Estimated gym calories from history sessions */
  readonly gymCalories = computed<number>(() => {
    const sessions = this.last7DaysSessions();
    if (!sessions.length) return 0;
    return Math.round(sessions.reduce((acc, s) => {
      // Estimate duration: 60 min default if no timing data
      let durationH = 1;
      if (s.endTime && s.startTime) {
        const ms = new Date(s.endTime).getTime() - new Date(s.startTime).getTime();
        if (ms > 0) durationH = ms / 3_600_000;
      }
      return acc + RESISTANCE_MET * DEFAULT_USER_WEIGHT_KG * durationH;
    }, 0));
  });

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


