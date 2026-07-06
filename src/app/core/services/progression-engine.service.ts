import { Injectable } from '@angular/core';
import { Workout } from '../../models/workout.model';
import { Ejercicio } from '../../models/ejercicio.model';
import { WorkoutSession, WorkoutExercise } from '../models/workout-history.model';

export interface ProgressionOptions {
  focus: 'weight' | 'volume';
  frequencyAdjustment: number; // 0, 1, or -1
}

@Injectable({ providedIn: 'root' })
export class ProgressionEngineService {

  /**
   * Generates the next microcycle (week) applying progressive overload.
   *
   * SOURCE OF TRUTH PRIORITY:
   *   1. Last completed WorkoutSession whose name matches the plan workout.
   *      This preserves any mutations the user made (drop-sets, super-sets,
   *      extra exercises added mid-cycle).
   *   2. Fallback: the plan template (oldWorkout.ejercicios) — same behaviour
   *      as before for new users or unmatched workouts.
   *
   * @param previousWeekWorkouts  The current plan's Workout documents.
   * @param options               Progression focus (weight vs volume) + freq adj.
   * @param historyMap            Optional map of workoutName → sorted sessions
   *                              (newest first). Provided by WeeklyPlanComponent
   *                              so this service stays pure/testable.
   */
  generateNextMicrocycle(
    previousWeekWorkouts: Workout[],
    options: ProgressionOptions = { focus: 'weight', frequencyAdjustment: 0 },
    historyMap: Map<string, WorkoutSession[]> = new Map()
  ): Workout[] {
    const nextMicrocycle: Workout[] = [];
    const now = new Date();
    let dayIndex = 0;

    previousWeekWorkouts.forEach((oldWorkout) => {
      const newDate = new Date(now.getTime() + dayIndex * 24 * 60 * 60 * 1000);
      dayIndex++;

      // ── STEP 1: Determine exercise structure source ──────────────────────
      // Look up the most recent completed session for this workout type.
      // Match by name (case-insensitive, trimmed). If not found, use template.
      const lastSession = this.findLastSession(oldWorkout.nombre, historyMap);
      const sourceEjercicios: Ejercicio[] = lastSession
        ? this.sessionToEjercicios(lastSession, oldWorkout)
        : oldWorkout.ejercicios;

      // ── STEP 2: Apply progressive overload ──────────────────────────────
      const progressedEjercicios = sourceEjercicios.map((ejercicio, index) => {
        const newEjercicio = this.deepCloneEjercicio(ejercicio);

        // Determine if this exercise was performed during the session
        const performedSets = lastSession
          ? this.getPerformedSets(lastSession, newEjercicio)
          : (oldWorkout.activeSetsState?.[index] ?? []);

        const targetsMet = this.didMeetTargets(performedSets, newEjercicio.repeticiones, newEjercicio.series);

        if (targetsMet) {
          this.applyOverload(newEjercicio, options);
        }

        // Apply overload to drop-set weights if present
        if (newEjercicio.tipos === 'drop-set' && newEjercicio.dropSet && targetsMet) {
          newEjercicio.dropSet = this.progressDropSet(newEjercicio.dropSet, newEjercicio.pesokg ?? 0);
        }

        // Apply overload to super-set linked exercise if present
        if (newEjercicio.tipos === 'super-serie' && newEjercicio.superSetEjercicio && targetsMet) {
          newEjercicio.superSetEjercicio = {
            ...newEjercicio.superSetEjercicio,
            pesokg: (newEjercicio.superSetEjercicio.pesokg ?? 0) + 1.25
          };
        }

        return newEjercicio;
      });

      const newWorkout: Workout = {
        ...oldWorkout,
        id: crypto.randomUUID(),
        fecha: newDate.toISOString(),
        isCompleted: false,
        status: 'idle',
        activeStartTime: undefined,
        completedAt: undefined,
        durationMinutes: undefined,
        activeSetsState: {},
        ejercicios: progressedEjercicios
      };

      nextMicrocycle.push(newWorkout);
    });

    // ── Handle Frequency Adjustment ─────────────────────────────────────────
    if (options.frequencyAdjustment > 0 && nextMicrocycle.length > 0) {
      const lastWorkout = nextMicrocycle[nextMicrocycle.length - 1];
      const newDate = new Date(new Date(lastWorkout.fecha!).getTime() + 24 * 60 * 60 * 1000);
      nextMicrocycle.push({
        ...lastWorkout,
        id: crypto.randomUUID(),
        fecha: newDate.toISOString()
      });
    } else if (options.frequencyAdjustment < 0 && nextMicrocycle.length > 1) {
      nextMicrocycle.pop();
    }

    return nextMicrocycle;
  }

  // ── Private Helpers ────────────────────────────────────────────────────────

  /**
   * Finds the most recent completed session whose name fuzzy-matches the workout.
   * Exact match is tried first; falls back to case-insensitive includes().
   */
  private findLastSession(
    workoutName: string,
    historyMap: Map<string, WorkoutSession[]>
  ): WorkoutSession | null {
    const normalized = workoutName.trim().toLowerCase();

    // 1. Exact match
    for (const [key, sessions] of historyMap.entries()) {
      if (key.trim().toLowerCase() === normalized && sessions.length > 0) {
        return sessions[0]; // Already sorted newest-first by the caller
      }
    }

    // 2. Fuzzy: key includes the workout name or vice versa
    for (const [key, sessions] of historyMap.entries()) {
      const kn = key.trim().toLowerCase();
      if ((kn.includes(normalized) || normalized.includes(kn)) && sessions.length > 0) {
        return sessions[0];
      }
    }

    return null;
  }

  /**
   * Converts a WorkoutSession's exercises back to the Ejercicio[] format,
   * preserving advanced set types (drop-set, super-serie) and user-added exercises.
   * MATCHING POR REFERENCIA: Cruza por ID o nombre (normalizado), NO por índice.
   */
  private sessionToEjercicios(session: WorkoutSession, planWorkout: Workout): Ejercicio[] {
    const rawExercises: WorkoutExercise[] = session.exercises || session.ejercicios || [];

    // Legacy guard: if the session has no exercise data, use the plan template
    if (rawExercises.length === 0) {
      return planWorkout.ejercicios;
    }

    return rawExercises.map((ex): Ejercicio => {
      // Find matching template by ID first, then by normalized name
      const normalizedSessionExName = (ex.nombre ?? ex.name ?? '').trim().toLowerCase();
      let templateEx = planWorkout.ejercicios.find(e => e.id && e.id === (ex as any).id);
      
      if (!templateEx && normalizedSessionExName) {
        templateEx = planWorkout.ejercicios.find(e => 
          (e.nombre ?? '').trim().toLowerCase() === normalizedSessionExName
        );
      }

      // Reconstruct from the session data, falling back to the template
      const reconstructed: Ejercicio = {
        ...(templateEx || {}),
        id: (ex as any).id ?? templateEx?.id ?? crypto.randomUUID(), // Ensure ID exists
        nombre: ex.nombre ?? ex.name ?? templateEx?.nombre ?? 'Ejercicio Extra',
        grupoMuscular: ex.grupoMuscular ?? ex.groupMuscular ?? ex.muscleGroup ?? templateEx?.grupoMuscular ?? 'Otro',
        repeticiones: templateEx?.repeticiones ?? 10,
        series: templateEx?.series ?? 3,
        tipos: templateEx?.tipos ?? 'normal'
      } as Ejercicio;

      // Restore completed set weight using MAX EFFORT (Peso Base)
      const lastSets = ex.sets ?? ex.series ?? [];
      const completedSets = lastSets.filter(s => s.completed !== false);
      
      if (completedSets.length > 0) {
        let maxWeight = 0;
        completedSets.forEach(s => {
           const w = Number(s.weight ?? s.peso ?? s.pesokg ?? 0);
           if (w > maxWeight) maxWeight = w;
        });

        reconstructed.pesokg = maxWeight > 0 ? maxWeight : (reconstructed.pesokg ?? 0);
        reconstructed.series = completedSets.length;
      }

      return reconstructed;
    });
  }

  /**
   * Gets the performed sets for an exercise from a WorkoutSession.
   * MATCHING POR REFERENCIA: Busca por ID o nombre.
   */
  private getPerformedSets(
    session: WorkoutSession,
    ejercicio: Ejercicio
  ): Array<{ reps: number; weight: number; completed: boolean }> {
    const rawExercises = session.exercises ?? session.ejercicios ?? [];
    
    const normalizedName = (ejercicio.nombre ?? '').trim().toLowerCase();
    let rawEx = rawExercises.find(e => (e as any).id && (e as any).id === ejercicio.id);
    
    if (!rawEx && normalizedName) {
      rawEx = rawExercises.find(e => (e.nombre ?? e.name ?? '').trim().toLowerCase() === normalizedName);
    }

    if (!rawEx) return [];

    const sets = rawEx.sets ?? rawEx.series ?? [];
    return sets.map(s => ({
      reps: Number(s.reps ?? s.repeticiones ?? 0),
      weight: Number(s.weight ?? s.peso ?? s.pesokg ?? 0),
      completed: s.completed !== false
    }));
  }

  /** 
   * Returns true if total achieved reps >= 80% of total target reps (Tolerance threshold). 
   */
  private didMeetTargets(
    performedSets: Array<{ reps: number; completed: boolean }>,
    targetRepsPerSet: number,
    targetSets: number
  ): boolean {
    if (!performedSets || performedSets.length === 0) return false;
    
    const completedSets = performedSets.filter(s => s.completed);
    if (completedSets.length === 0) return false;

    const totalRepsAchieved = completedSets.reduce((sum, s) => sum + s.reps, 0);
    const totalRepsTarget = targetRepsPerSet * targetSets;

    return totalRepsAchieved >= (totalRepsTarget * 0.8);
  }

  /** Applies progressive overload (weight or volume) to a single ejercicio. */
  private applyOverload(ejercicio: Ejercicio, options: ProgressionOptions): void {
    if (options.focus === 'weight') {
      ejercicio.pesokg = (ejercicio.pesokg ?? 0) + 2.5;
    } else if (options.focus === 'volume') {
      if (ejercicio.repeticiones < 15) {
        ejercicio.repeticiones += 2;
      } else {
        ejercicio.series += 1;
      }
    }
  }

  /**
   * Recalculates a drop-set's per-drop weights based on a new top-set weight.
   * Each drop is computed as: newTopWeight × drop.porcentaje.
   */
  private progressDropSet(
    dropSet: NonNullable<Ejercicio['dropSet']>,
    newTopWeight: number
  ): NonNullable<Ejercicio['dropSet']> {
    return {
      sets: dropSet.sets.map(drop => ({
        ...drop,
        peso: Math.round((newTopWeight * drop.porcentaje) * 2) / 2 // Round to nearest 0.5 kg
      }))
    };
  }

  /** Deep-clones an Ejercicio including nested dropSet and superSetEjercicio. */
  private deepCloneEjercicio(e: Ejercicio): Ejercicio {
    return {
      ...e,
      dropSet: e.dropSet
        ? { sets: e.dropSet.sets.map(s => ({ ...s })) }
        : undefined,
      superSetEjercicio: e.superSetEjercicio
        ? { ...e.superSetEjercicio }
        : undefined
    };
  }
}
