import { Injectable, computed, inject } from '@angular/core';
import { WorkoutService } from './workout.service';
import { Workout } from '../../models/workout.model';
import { Ejercicio } from '../../models/ejercicio.model';

export interface WeeklyMetrics {
  workoutsCount: number;  // # entrenamientos completados en 7 días
  totalVolume: number;    // Tonelaje kg: Σ(series * reps * peso)
  estimatedCalories: number; // Estimación METs-based
  totalSets: number;      // Σ series efectivas
}

// MET approx: entrenamiento de resistencia/hipertrofia moderada → 5.0
// kcal = MET * weight_kg * duration_hours
// Si no hay peso del usuario, usamos 75 kg como estándar.
const DEFAULT_USER_WEIGHT_KG = 75;
const RESISTANCE_MET = 5.0;
// Duración promedio de una sesión si no está especificada: 60 min
const AVG_SESSION_DURATION_H = 1.0;

@Injectable({
  providedIn: 'root'
})
export class MetricsService {
  private workoutService = inject(WorkoutService);

  // ─── Utilidades de Fecha ──────────────────────────────────────────────────

  /** Devuelve true si la fecha ISO cae dentro de los últimos N días (inclusive hoy). */
  private isWithinLastNDays(isoDate: string | undefined, days: number): boolean {
    if (!isoDate) return false;
    const workoutDate = new Date(isoDate);
    if (isNaN(workoutDate.getTime())) return false;

    const now = new Date();
    // Normalizar "ahora" al final del día actual
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    // Inicio de la ventana: N días atrás, comienzo del día
    const startOfWindow = new Date(endOfToday);
    startOfWindow.setDate(endOfToday.getDate() - (days - 1));
    startOfWindow.setHours(0, 0, 0, 0);

    // Omitir entrenamientos futuros (planificados pero no completados)
    if (workoutDate.getTime() > now.getTime()) {
      return false;
    }

    return workoutDate >= startOfWindow && workoutDate <= now;
  }

  // ─── Cálculos por Ejercicio ───────────────────────────────────────────────

  /**
   * Tonelaje de un ejercicio: series * reps * peso.
   * Ejercicios de peso corporal (pesokg = 0 o undefined) se excluyen del
   * tonelaje (no se puede cuantificar sin el BW), pero SÍ se cuentan sus series.
   */
  private exerciseVolume(e: Ejercicio): number {
    const peso = e.pesokg ?? 0;
    if (peso === 0) return 0; // peso corporal → sin tonelaje medible
    return (e.series ?? 0) * (e.repeticiones ?? 0) * peso;
  }

  private exerciseSets(e: Ejercicio): number {
    return e.series ?? 0;
  }

  // ─── Señales Computadas ───────────────────────────────────────────────────

  /** Workouts de los últimos 7 días (Solo completados) */
  readonly last7DaysWorkouts = computed<Workout[]>(() =>
    this.workoutService.workouts().filter(w => w.isCompleted === true && this.isWithinLastNDays(w.fecha, 7))
  );

  /** Número de sesiones en los últimos 7 días */
  readonly workoutsCount = computed<number>(() => this.last7DaysWorkouts().length);

  /**
   * Tonelaje total (kg) = Σ (series * reps * peso) para ejercicios con peso > 0.
   * Ejercicios de peso corporal no inflan artificialmente el número.
   */
  readonly totalVolume = computed<number>(() =>
    this.last7DaysWorkouts().reduce((acc, workout) => {
      const workoutVol = (workout.ejercicios ?? []).reduce(
        (sum, e) => sum + this.exerciseVolume(e),
        0
      );
      return acc + workoutVol;
    }, 0)
  );

  /**
   * Series totales efectivas en los últimos 7 días.
   * Incluye ejercicios de peso corporal.
   */
  readonly totalSets = computed<number>(() =>
    this.last7DaysWorkouts().reduce((acc, workout) => {
      const workoutSets = (workout.ejercicios ?? []).reduce(
        (sum, e) => sum + this.exerciseSets(e),
        0
      );
      return acc + workoutSets;
    }, 0)
  );

  /**
   * Calorías estimadas (kcal) usando el modelo MET:
   *   kcal = MET × peso_usuario_kg × duración_h
   * MET de resistencia/hipertrofia ≈ 5.0
   * Duración asumida por sesión: 60 min (puede mejorarse con campo `duracionMin` en el modelo).
   * Peso del usuario: 75 kg por defecto (reemplazar con perfil del usuario cuando esté disponible).
   */
  readonly estimatedCalories = computed<number>(() => {
    const workouts = this.last7DaysWorkouts();
    if (workouts.length === 0) return 0;

    const totalKcal = workouts.reduce((acc, w) => {
        // Usar durationMinutes si existe, sino 60 min por defecto
        const durationH = (w.durationMinutes || 60) / 60;
        const kcal = RESISTANCE_MET * DEFAULT_USER_WEIGHT_KG * durationH;
        return acc + kcal;
    }, 0);

    const result = Math.round(totalKcal);
    console.log(`[MetricsService] Sesiones completadas: ${workouts.length} -> Calorías estimadas totales: ${result} kcal`);
    return result;
  });

  /** Todas las métricas empaquetadas en un solo objeto (para AI Coach u otros consumidores) */
  readonly weeklyMetrics = computed<WeeklyMetrics>(() => ({
    workoutsCount: this.workoutsCount(),
    totalVolume: this.totalVolume(),
    estimatedCalories: this.estimatedCalories(),
    totalSets: this.totalSets(),
  }));

  // ─── Helpers Públicos ─────────────────────────────────────────────────────

  /** Formatea el volumen con sufijo 'kg' y separador de miles */
  formatVolume(kg: number): string {
    return kg >= 1000
      ? `${(kg / 1000).toFixed(1)}t`
      : `${kg.toLocaleString('es-ES')} kg`;
  }

  /** Formatea calorías con sufijo 'kcal' */
  formatCalories(kcal: number): string {
    return `${kcal.toLocaleString('es-ES')} kcal`;
  }
}
