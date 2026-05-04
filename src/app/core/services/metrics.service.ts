import { Injectable, computed, inject } from '@angular/core';
import { WorkoutService } from './workout.service';
import { CardioSessionService } from './cardio-session.service';
import { Workout } from '../../models/workout.model';
import { Ejercicio } from '../../models/ejercicio.model';

export interface WeeklyMetrics {
  workoutsCount: number;
  totalVolume: number;
  estimatedCalories: number;   // Gym + Cardio
  gymCalories: number;
  cardioCalories: number;
  totalSets: number;
  cardioSessionsCount: number;
}

const DEFAULT_USER_WEIGHT_KG = 75;
const RESISTANCE_MET = 5.0;

@Injectable({ providedIn: 'root' })
export class MetricsService {
  private workoutService = inject(WorkoutService);
  private cardioService = inject(CardioSessionService);

  // ─── Utilidades de Fecha ──────────────────────────────────────────────

  private isWithinLastNDays(isoDate: string | undefined, days: number): boolean {
    if (!isoDate) return false;
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    if (d.getTime() > now.getTime()) return false;
    const start = new Date(now);
    start.setDate(now.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);
    return d >= start && d <= now;
  }

  // ─── Gym computeds ───────────────────────────────────────────────────

  readonly last7DaysWorkouts = computed<Workout[]>(() =>
    this.workoutService.workouts().filter(w =>
      w.isCompleted === true && this.isWithinLastNDays(w.fecha, 7)
    )
  );

  readonly workoutsCount = computed<number>(() => this.last7DaysWorkouts().length);

  readonly totalVolume = computed<number>(() =>
    this.last7DaysWorkouts().reduce((acc, w) => {
      const vol = (w.ejercicios ?? []).reduce((s, e) => {
        const peso = e.pesokg ?? 0;
        return s + (peso > 0 ? (e.series ?? 0) * (e.repeticiones ?? 0) * peso : 0);
      }, 0);
      return acc + vol;
    }, 0)
  );

  readonly totalSets = computed<number>(() =>
    this.last7DaysWorkouts().reduce((acc, w) =>
      acc + (w.ejercicios ?? []).reduce((s, e) => s + (e.series ?? 0), 0)
    , 0)
  );

  readonly gymCalories = computed<number>(() => {
    const workouts = this.last7DaysWorkouts();
    if (!workouts.length) return 0;
    return Math.round(workouts.reduce((acc, w) => {
      const durationH = (w.durationMinutes || 60) / 60;
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
    const total = this.gymCalories() + this.cardioCalories();
    console.log(`[MetricsService] Gym: ${this.gymCalories()} + Cardio: ${this.cardioCalories()} = ${total} kcal`);
    return total;
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

  // ─── Helpers ─────────────────────────────────────────────────────────

  formatVolume(kg: number): string {
    return kg >= 1000 ? `${(kg / 1000).toFixed(1)}t` : `${kg.toLocaleString('es-ES')} kg`;
  }

  formatCalories(kcal: number): string {
    return `${kcal.toLocaleString('es-ES')} kcal`;
  }
}
