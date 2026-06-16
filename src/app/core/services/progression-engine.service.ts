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
          ? this.getPerformedSets(lastSession, index, newEjercicio.nombre)
          : (oldWorkout.activeSetsState?.[index] ?? []);

        const targetsMet = this.didMeetTargets(performedSets, newEjercicio.repeticiones);

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
   * Falls back to the plan template for any field not present in the session.
   *
   * LEGACY GUARD: Very old sessions may have zero exercises stored (pre-logging
   * feature). In that case we always fall back to the plan template so the next
   * microcycle is not accidentally empty.
   */
  private sessionToEjercicios(session: WorkoutSession, planWorkout: Workout): Ejercicio[] {
    const rawExercises: WorkoutExercise[] = session.exercises || session.ejercicios || [];

    // Legacy guard: if the session has no exercise data, use the plan template
    if (rawExercises.length === 0) {
      return planWorkout.ejercicios;
    }

    return rawExercises.map((ex, idx): Ejercicio => {
      // Try to find the matching template exercise by index or name
      const templateEx = planWorkout.ejercicios[idx]
        ?? planWorkout.ejercicios.find(e =>
            e.nombre?.toLowerCase() === (ex.nombre ?? ex.name ?? '').toLowerCase()
          )
        ?? planWorkout.ejercicios[0];

      // Reconstruct from the session data, falling back to the template for
      // fields that aren't stored in WorkoutSession (e.g. imageUrl, videoUrl).
      const reconstructed: Ejercicio = {
        ...templateEx,
        id: templateEx?.id ?? idx,
        nombre: ex.nombre ?? ex.name ?? templateEx?.nombre ?? 'Ejercicio',
        grupoMuscular: ex.grupoMuscular ?? ex.groupMuscular ?? ex.muscleGroup ?? templateEx?.grupoMuscular ?? '',
      };

      // Restore completed set weight & reps from the last set that was logged
      const lastSets = ex.sets ?? ex.series ?? [];
      if (lastSets.length > 0) {
        const completedSets = lastSets.filter(s => s.completed !== false);
        if (completedSets.length > 0) {
          const lastCompleted = completedSets[completedSets.length - 1];
          reconstructed.pesokg = Number(lastCompleted.weight ?? lastCompleted.peso ?? lastCompleted.pesokg ?? reconstructed.pesokg ?? 0);
          reconstructed.series = completedSets.length;
        }
      }

      return reconstructed;
    });
  }

  /**
   * Gets the performed sets for an exercise from a WorkoutSession.
   * Tries index-based lookup first (from activeSetsState), then falls back
   * to the session's exercises array.
   */
  private getPerformedSets(
    session: WorkoutSession,
    exerciseIndex: number,
    exerciseName: string
  ): Array<{ reps: number; weight: number; completed: boolean }> {
    // If the session was saved with activeSetsState (new format)
    const rawEx = (session.exercises ?? session.ejercicios ?? [])[exerciseIndex];
    if (!rawEx) return [];

    const sets = rawEx.sets ?? rawEx.series ?? [];
    return sets.map(s => ({
      reps: Number(s.reps ?? s.repeticiones ?? 0),
      weight: Number(s.weight ?? s.peso ?? s.pesokg ?? 0),
      completed: s.completed !== false
    }));
  }

  /** Returns true if all completed sets hit or exceeded the target reps. */
  private didMeetTargets(
    performedSets: Array<{ reps: number; completed: boolean }>,
    targetReps: number
  ): boolean {
    if (!performedSets || performedSets.length === 0) return false;
    return performedSets.every(s => s.completed && s.reps >= targetReps);
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
